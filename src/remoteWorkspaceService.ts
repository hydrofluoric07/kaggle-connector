import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { JupyterClient } from './client';
import {
  getConcurrency,
  getRetryCount,
  SECRET_KEY,
  setRemoteDir
} from './config';
import type { ConnectionState } from './core/connectionState';
import {
  describeError,
  isConnectionError,
  isSessionError,
  KaggleError,
  shortError
} from './core/errors';
import {
  filterOutNestedRemotePaths,
  isRemoteInsideOrEqual,
  planBatchTransfer,
  planMultiDownloadTargets,
  remoteBasename,
  safeLocalName,
  uniqueCopyPath,
  validateEntryName,
  type RemoteSelectionItem
} from './core/remoteActions';
import { withRetries } from './core/retry';
import { dirnameRemotePath, joinRemotePath, normalizeRemotePath } from './core/url';
import {
  downloadRemoteDirectory,
  downloadRemoteSelections,
  SYSTEM_ENTRIES,
  type DownloadSummary
} from './download';
import type { ProbeCoordinator } from './probe';
import { REMOTE_SCHEME } from './remoteFs';
import { formatSize } from './upload';

export interface RemoteMutationHint {
  invalidate?: readonly string[];
  parents?: readonly string[];
  fullRefresh?: boolean;
}

export interface RemoteWorkspaceServiceOptions {
  context: vscode.ExtensionContext;
  clientFactory: (serverUrl: string) => JupyterClient;
  connectionState: ConnectionState;
  probes: ProbeCoordinator;
  log: (message: string) => void;
  showOutput: () => void;
  onMutated: (hint?: RemoteMutationHint) => void;
  onRemoteDirUpdated: () => void;
  onWorkingDirCreated: () => void;
}

/**
 * Implements remote file/folder actions (open, download, create, rename,
 * delete, copy, move) used by the Explorer Kaggle Workspace tree view.
 */
export class RemoteWorkspaceService {
  private operationInProgress = false;

  constructor(private readonly options: RemoteWorkspaceServiceOptions) {}

  async openItems(rawItems: readonly RemoteSelectionItem[]): Promise<void> {
    const files = rawItems.filter((item) => item.entryType !== 'directory' && !item.isRoot);
    if (files.length === 0) {
      return;
    }
    if (files.length > 10) {
      const choice = await vscode.window.showWarningMessage(
        `确定同时打开选中的 ${files.length} 个远端文件？`,
        { modal: true },
        '继续打开',
        '取消'
      );
      if (choice !== '继续打开') {
        return;
      }
    }

    const showOptions: vscode.TextDocumentShowOptions | undefined =
      files.length > 1 ? { preview: false } : undefined;
    for (const item of files) {
      const normalized = normalizeRemotePath(item.path);
      if (!normalized) {
        continue;
      }
      const uri = vscode.Uri.from({
        scheme: REMOTE_SCHEME,
        path: `/${normalized}`
      });
      // "default" forces the text editor so .ipynb opens as raw JSON.
      await vscode.commands.executeCommand('vscode.openWith', uri, 'default', showOptions);
      const editor =
        vscode.window.visibleTextEditors.find(
          (candidate) => candidate.document.uri.toString() === uri.toString()
        ) ?? vscode.window.activeTextEditor;
      if (editor && editor.document.uri.toString() === uri.toString()) {
        const languageId = languageIdForRemotePath(normalized);
        if (languageId && editor.document.languageId !== languageId) {
          await vscode.languages.setTextDocumentLanguage(editor.document, languageId);
        }
      }
      this.options.log(`打开远端文件: ${normalized}`);
    }
  }

  async downloadItems(rawItems: readonly RemoteSelectionItem[]): Promise<void> {
    const items = normalizeSelectionItems(rawItems);
    if (items.length === 0) {
      return;
    }
    await this.withRemoteClient(async (client) => {
      if (items.length === 1) {
        const only = items[0];
        if (only.entryType === 'directory' || only.isRoot) {
          await this.downloadDirectory(client, only.path);
        } else {
          await this.downloadFile(client, only.path, only.entryType, only.entrySize);
        }
        return;
      }
      await this.downloadMultiple(client, items);
    });
  }

  async createEntry(
    parent: string,
    isDirectory: boolean,
    inlineName?: string
  ): Promise<void> {
    const targetParent = normalizeRemotePath(parent);
    let name: string;
    if (inlineName !== undefined) {
      const validation = validateEntryName(inlineName);
      if (validation) {
        void vscode.window.showErrorMessage(validation);
        return;
      }
      name = inlineName.trim();
    } else {
      const input = await vscode.window.showInputBox({
        title: isDirectory ? '新建远端文件夹' : '新建远端文件',
        prompt: `在 “${targetParent || '/'}” 下创建${isDirectory ? '文件夹' : '文件'}。`,
        placeHolder: isDirectory ? '文件夹名' : '文件名，例如 notes.md',
        ignoreFocusOut: true,
        validateInput: validateEntryName
      });
      if (input === undefined) {
        return;
      }
      name = input.trim();
    }

    await this.withRemoteClient(async (client) => {
      const target = joinRemotePath(targetParent, name);
      if (await remoteExists(client, target)) {
        throw new KaggleError('badRequest', `目标路径已存在：${target}`);
      }

      const retryCount = getRetryCount();
      if (isDirectory) {
        await withRetries(() => client.putDirectory(target), retryCount);
        this.options.log(`新建远端文件夹: ${target}`);
      } else {
        const bytes = name.toLowerCase().endsWith('.ipynb')
          ? Buffer.from(
              `${JSON.stringify(
                { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 },
                null,
                2
              )}\n`,
              'utf8'
            )
          : Buffer.alloc(0);
        await withRetries(() => client.putFile(target, bytes), retryCount);
        this.options.log(`新建远端文件: ${target}`);
      }

      this.options.onMutated({ parents: [targetParent] });
      if (isDirectory) {
        this.options.onWorkingDirCreated();
      }
      vscode.window.setStatusBarMessage(`$(check) 已创建 ${target}`, 3000);
      if (!isDirectory && inlineName === undefined) {
        await this.openItems([
          {
            path: target,
            entryType: name.toLowerCase().endsWith('.ipynb') ? 'notebook' : 'file'
          }
        ]);
      }
    });
  }

  async renameItem(item: RemoteSelectionItem, inlineNewName?: string): Promise<void> {
    const remotePath = normalizeRemotePath(item.path);
    if (!remotePath) {
      return;
    }

    const isRoot = Boolean(item.isRoot);
    const isDirectory = item.entryType === 'directory' || isRoot;
    const base = remoteBasename(remotePath);

    let normalizedTarget: string;
    if (inlineNewName !== undefined) {
      const validation = validateEntryName(inlineNewName);
      if (validation) {
        void vscode.window.showErrorMessage(validation);
        return;
      }
      normalizedTarget = joinRemotePath(dirnameRemotePath(remotePath), inlineNewName.trim());
    } else if (isRoot) {
      const target = await vscode.window.showInputBox({
        title: '重命名 / 移动远端工作目录',
        prompt: '输入新的完整远端路径；可以改名，也可以移动到其他目录。',
        value: remotePath,
        ignoreFocusOut: true,
        validateInput: (value) => {
          try {
            const normalized = normalizeRemotePath(value);
            if (!normalized) {
              return '目标路径不能为空';
            }
            if (normalized !== remotePath && isRemoteInsideOrEqual(remotePath, normalized)) {
              return '不能把文件夹移动到它自己内部';
            }
            return undefined;
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        }
      });
      if (target === undefined) {
        return;
      }
      normalizedTarget = normalizeRemotePath(target);
    } else {
      const dot = !isDirectory ? base.lastIndexOf('.') : -1;
      const input = await vscode.window.showInputBox({
        title: `重命名${isDirectory ? '文件夹' : '文件'}`,
        prompt: `输入 “${base}” 的新名称`,
        value: base,
        valueSelection: dot > 0 ? [0, dot] : undefined,
        ignoreFocusOut: true,
        validateInput: validateEntryName
      });
      if (input === undefined) {
        return;
      }
      normalizedTarget = joinRemotePath(dirnameRemotePath(remotePath), input.trim());
    }

    if (!normalizedTarget || normalizedTarget === remotePath) {
      return;
    }

    await this.withRemoteClient(async (client) => {
      await prepareRemoteTarget(client, normalizedTarget);
      if (await remoteExists(client, normalizedTarget)) {
        throw new KaggleError('badRequest', `目标路径已存在：${normalizedTarget}`);
      }

      this.options.log(`重命名/移动远端: ${remotePath} -> ${normalizedTarget}`);
      await withRetries(
        () => client.renameContents(remotePath, normalizedTarget),
        getRetryCount()
      );

      if (isRoot) {
        await setRemoteDir(normalizedTarget);
        this.options.onRemoteDirUpdated();
        this.options.onMutated({ fullRefresh: true });
        vscode.window.setStatusBarMessage(
          `$(check) 已移动工作目录，并更新为 “${normalizedTarget}”`,
          4000
        );
        return;
      }

      this.options.onMutated({
        invalidate: [remotePath],
        parents: [dirnameRemotePath(remotePath), dirnameRemotePath(normalizedTarget)]
      });
      vscode.window.setStatusBarMessage(
        `$(check) 已重命名为 ${remoteBasename(normalizedTarget)}`,
        3000
      );
    });
  }

  async deleteItems(rawItems: readonly RemoteSelectionItem[]): Promise<void> {
    const items = normalizeSelectionItems(rawItems);
    if (items.length === 0) {
      return;
    }

    await this.withRemoteClient(async (client) => {
      if (items.length === 1) {
        await this.deleteSingle(client, items[0]);
        return;
      }
      await this.deleteMultiple(client, items);
    });
  }

  async transferItems(
    rawItems: readonly RemoteSelectionItem[],
    targetDir: string,
    mode: 'copy' | 'move'
  ): Promise<boolean> {
    const items = normalizeSelectionItems(rawItems);
    if (items.length === 0) {
      return false;
    }
    if (items.some((item) => item.isRoot)) {
      void vscode.window.showErrorMessage('不支持复制或移动工作区根目录。');
      return false;
    }

    const normalizedTargetDir = normalizeRemotePath(targetDir);
    let completedCleanly = false;

    await this.withRemoteClient(async (client) => {
      const retryCount = getRetryCount();
      const targetEntries = await withRetries(
        () => client.listDirectory(normalizedTargetDir),
        retryCount
      );
      const existingNames = new Set(targetEntries.map((entry) => entry.name));
      const plan = planBatchTransfer(items, normalizedTargetDir, mode, existingNames);

      if (plan.selfContainmentErrors.length > 0) {
        throw new KaggleError('badRequest', plan.selfContainmentErrors[0]);
      }
      if (plan.duplicateTargetErrors.length > 0) {
        throw new KaggleError('badRequest', plan.duplicateTargetErrors[0]);
      }
      if (plan.entries.length === 0) {
        completedCleanly = plan.skippedSameParent > 0;
        return;
      }

      type PlannedExecution = {
        source: string;
        target: string;
        isDirectory: boolean;
        overwrite: boolean;
      };

      const conflicts = plan.entries.filter((entry) => entry.conflict);
      let conflictAction: 'keepBoth' | 'overwrite' | 'skip' = 'skip';
      if (conflicts.length > 0) {
        const detail = conflicts
          .slice(0, 5)
          .map((entry) => entry.baseName)
          .join('\n');
        const options =
          mode === 'copy'
            ? ['保留两者（副本）', '覆盖', '跳过冲突', '取消']
            : ['覆盖', '跳过冲突', '取消'];
        const choice = await vscode.window.showWarningMessage(
          `目标目录 “${normalizedTargetDir || '/'}” 中已存在 ${conflicts.length} 个同名项目：`,
          {
            modal: true,
            detail:
              conflicts.length > 5
                ? `${detail}\n… 另有 ${conflicts.length - 5} 项`
                : detail
          },
          ...options
        );
        if (!choice || choice === '取消') {
          return;
        }
        if (choice === '覆盖') {
          conflictAction = 'overwrite';
        } else if (choice === '保留两者（副本）') {
          conflictAction = 'keepBoth';
        } else {
          conflictAction = 'skip';
        }
      }

      const reservedNames = new Set(existingNames);
      const executions: PlannedExecution[] = [];
      for (const entry of plan.entries) {
        if (!entry.conflict) {
          reservedNames.add(entry.baseName);
          executions.push({
            source: entry.source,
            target: entry.target,
            isDirectory: entry.isDirectory,
            overwrite: false
          });
          continue;
        }
        if (conflictAction === 'skip') {
          continue;
        }
        if (conflictAction === 'overwrite') {
          executions.push({
            source: entry.source,
            target: entry.target,
            isDirectory: entry.isDirectory,
            overwrite: true
          });
          continue;
        }
        const uniqueTarget = uniqueCopyPath(
          normalizedTargetDir,
          entry.baseName,
          entry.isDirectory,
          reservedNames
        );
        reservedNames.add(remoteBasename(uniqueTarget));
        executions.push({
          source: entry.source,
          target: uniqueTarget,
          isDirectory: entry.isDirectory,
          overwrite: false
        });
      }

      if (executions.length === 0) {
        return;
      }

      let succeededCount = 0;
      let copiedFilesCount = 0;
      const movedSources: string[] = [];
      const sourceParents = new Set<string>();
      const failures: Array<{ source: string; error: unknown }> = [];
      let sessionExpiredError: unknown;
      let cancelled = false;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title:
            mode === 'move'
              ? `移动 ${executions.length} 个远端项目`
              : `复制 ${executions.length} 个远端项目`,
          cancellable: true
        },
        async (progress, token) => {
          const controller = new AbortController();
          const cancellation = token.onCancellationRequested(() => controller.abort());
          try {
            for (let index = 0; index < executions.length; index += 1) {
              if (controller.signal.aborted) {
                cancelled = true;
                break;
              }
              const item = executions[index];
              progress.report({
                increment: 100 / executions.length,
                message: `${index + 1}/${executions.length} ${remoteBasename(item.source)}`
              });

              try {
                if (item.overwrite) {
                  try {
                    await this.deleteSingleRemotePath(
                      client,
                      item.target,
                      true,
                      retryCount,
                      controller.signal
                    );
                  } catch (error) {
                    if (!(error instanceof KaggleError && error.kind === 'notFound')) {
                      throw error;
                    }
                  }
                }

                if (mode === 'move') {
                  this.options.log(`移动远端: ${item.source} -> ${item.target}`);
                  await withRetries(
                    () => client.renameContents(item.source, item.target, controller.signal),
                    retryCount,
                    controller.signal,
                    {
                      cancelMessage: '移动已取消',
                      onRetry: (attempt, error, delayMs) => {
                        this.options.log(
                          `移动失败，${delayMs} ms 后重试（${attempt}/${retryCount}）：${item.source}：${shortError(error)}`
                        );
                      }
                    }
                  );
                  succeededCount += 1;
                  movedSources.push(item.source);
                  sourceParents.add(dirnameRemotePath(item.source));
                } else {
                  this.options.log(`复制远端: ${item.source} -> ${item.target}`);
                  try {
                    copiedFilesCount += await copyRemoteTree(
                      client,
                      item.source,
                      item.target,
                      item.isDirectory,
                      retryCount,
                      controller.signal,
                      progress,
                      this.options.log
                    );
                  } catch (error) {
                    try {
                      await this.deleteSingleRemotePath(
                        client,
                        item.target,
                        item.isDirectory,
                        0
                      );
                    } catch {
                      // Best-effort partial copy cleanup.
                    }
                    throw error;
                  }
                  succeededCount += 1;
                  movedSources.push(item.source);
                  sourceParents.add(dirnameRemotePath(item.source));
                }
              } catch (error) {
                if (error instanceof KaggleError && error.kind === 'cancelled') {
                  cancelled = true;
                  break;
                }
                failures.push({ source: item.source, error });
                this.options.log(
                  `${mode === 'move' ? '移动' : '复制'}失败: ${item.source}: ${describeError(error)}`
                );
                if (isSessionError(error)) {
                  sessionExpiredError = error;
                  controller.abort();
                  break;
                }
              }
            }
          } finally {
            cancellation.dispose();
          }
        }
      );

      if (succeededCount > 0) {
        this.options.onMutated({
          invalidate: mode === 'move' ? movedSources : [],
          parents: [...sourceParents, normalizedTargetDir]
        });
      }

      if (sessionExpiredError) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
        await this.promptFailure(
          `${mode === 'move' ? '移动' : '复制'}中断：Kaggle 会话可能已过期（成功 ${succeededCount}，失败 ${failures.length}）。`,
          { offerUpdateUrl: true, level: 'error' }
        );
        return;
      }

      if (cancelled) {
        vscode.window.setStatusBarMessage(
          `已取消${mode === 'move' ? '移动' : '复制'}（已完成 ${succeededCount} 项）`,
          3000
        );
        return;
      }

      if (failures.length > 0) {
        const detailText = failures
          .slice(0, 3)
          .map((item) => `${item.source}: ${shortError(item.error)}`)
          .join('\n');
        await this.promptFailure(
          `${mode === 'move' ? '移动' : '复制'}完成：成功 ${succeededCount}，失败 ${failures.length}。\n${detailText}`,
          { level: 'warning' }
        );
        return;
      }

      completedCleanly = true;
      if (mode === 'move') {
        vscode.window.setStatusBarMessage(
          executions.length === 1
            ? `$(check) 已移动到 ${executions[0].target}`
            : `$(check) 已移动 ${succeededCount} 个项目到 ${normalizedTargetDir || '根目录'}`,
          3000
        );
      } else {
        vscode.window.setStatusBarMessage(
          `$(check) 已复制 ${succeededCount} 个项目（${copiedFilesCount} 个文件）到 ${normalizedTargetDir || '根目录'}`,
          3000
        );
      }
    });

    return completedCleanly;
  }

  private async withRemoteClient(
    action: (client: JupyterClient) => Promise<void>
  ): Promise<void> {
    if (this.operationInProgress) {
      vscode.window.setStatusBarMessage('另一个远端操作正在进行，请稍候。', 3000);
      return;
    }
    this.operationInProgress = true;
    let client: JupyterClient | undefined;
    try {
      const url = (await this.options.context.secrets.get(SECRET_KEY)) ?? '';
      if (!url) {
        void vscode.window.showErrorMessage('尚未设置 Kaggle Jupyter URL。', '设置 URL').then(
          (choice) => {
            if (choice === '设置 URL') {
              void vscode.commands.executeCommand('kaggleConnector.setServerUrl');
            }
          }
        );
        return;
      }

      client = this.options.clientFactory(url);
      const probe = await this.options.probes.probe(url);
      if (!probe.alive) {
        await this.promptFailure(
          probe.likelyExpired
            ? `Kaggle 会话可能已失效：${shortError(probe.error)}`
            : `连接失败：${shortError(probe.error)}`,
          { offerUpdateUrl: probe.likelyExpired, level: 'error' }
        );
        return;
      }

      await action(client);
    } catch (error) {
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      if (error instanceof KaggleError && error.kind === 'cancelled') {
        vscode.window.setStatusBarMessage('已取消', 2000);
        return;
      }
      this.options.log(`远端操作失败: ${describeError(error)}`);
      await this.promptFailure(`操作失败：${shortError(error)}`, {
        offerUpdateUrl: isSessionError(error),
        level: 'error'
      });
    } finally {
      this.operationInProgress = false;
      void client?.dispose();
    }
  }

  private defaultLocalFolder(): vscode.Uri {
    return vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(os.homedir());
  }

  private async downloadDirectory(client: JupyterClient, remotePath: string): Promise<void> {
    const name = remoteBasename(remotePath) || 'kaggle-working';
    const destination = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: '下载到此文件夹',
      defaultUri: this.defaultLocalFolder()
    });
    if (!destination || destination.length === 0) {
      return;
    }

    const targetDirectory = vscode.Uri.joinPath(destination[0], safeLocalName(name));
    const existing = await statSafe(targetDirectory);
    if (existing && (existing.type & vscode.FileType.Directory) === 0) {
      throw new KaggleError(
        'badRequest',
        `本地目标已存在且不是文件夹：${targetDirectory.fsPath}`
      );
    }
    if (existing) {
      const choice = await vscode.window.showWarningMessage(
        `本地文件夹 “${targetDirectory.fsPath}” 已存在，继续会覆盖同名文件。`,
        { modal: true },
        '继续下载',
        '取消'
      );
      if (choice !== '继续下载') {
        return;
      }
    }

    const concurrency = getConcurrency();
    const retryCount = getRetryCount();
    this.options.log(
      `下载远端文件夹: ${remotePath} -> ${targetDirectory.fsPath}（并发=${concurrency}，重试=${retryCount}）`
    );

    const summary = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `下载 ${name}`,
        cancellable: true
      },
      async (progress, token): Promise<DownloadSummary> => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        let lastCompleted = 0;
        const uriFor = (parts: readonly string[]) =>
          parts.length > 0 ? vscode.Uri.joinPath(targetDirectory, ...parts) : targetDirectory;
        try {
          return await downloadRemoteDirectory({
            client,
            remotePath,
            concurrency,
            retryCount,
            signal: controller.signal,
            ensureDirectory: (parts) => ensureLocalDirectory(uriFor(parts)),
            writeFile: async (parts, bytes) => {
              const target = uriFor(parts);
              try {
                await vscode.workspace.fs.writeFile(target, bytes);
              } catch (error) {
                throw localFileSystemError('写入本地文件失败', target, error);
              }
            },
            formatLocalPath: (parts) => uriFor(parts).fsPath,
            onProgress: (event) => {
              if (event.phase === 'scanning') {
                progress.report({
                  message: `正在扫描远端目录（已发现 ${event.filesFound} 个文件）…`
                });
                return;
              }
              const delta = Math.max(0, event.completed - lastCompleted);
              lastCompleted = event.completed;
              progress.report({
                increment: (delta * 100) / Math.max(event.total, 1),
                message: `${event.completed}/${event.total} ${remoteBasename(event.currentPath)}`
              });
            },
            log: this.options.log
          });
        } finally {
          cancellation.dispose();
        }
      }
    );

    await this.notifyDownloadSummary(summary, targetDirectory);
  }

  private async downloadFile(
    client: JupyterClient,
    remotePath: string,
    entryType?: 'file' | 'directory' | 'notebook',
    entrySize?: number
  ): Promise<void> {
    const name = remoteBasename(remotePath) || 'kaggle-working';
    const retryCount = getRetryCount();
    const defaultUri = vscode.Uri.file(
      path.join(this.defaultLocalFolder().fsPath, safeLocalName(name))
    );
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      saveLabel: '下载'
    });
    if (!saveUri) {
      return;
    }

    this.options.log(`下载远端文件: ${remotePath} -> ${saveUri.fsPath}`);
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `下载 ${name}`,
          cancellable: true
        },
        async (_progress, token) => {
          const controller = new AbortController();
          const cancellation = token.onCancellationRequested(() => controller.abort());
          try {
            const bytes = await withRetries(
              () =>
                client.downloadFile(remotePath, {
                  signal: controller.signal,
                  type: entryType,
                  sizeHint: entrySize
                }),
              retryCount,
              controller.signal,
              {
                cancelMessage: '下载已取消',
                onRetry: (attempt, error, delayMs) => {
                  this.options.log(
                    `下载失败，${delayMs} ms 后重试（${attempt}/${retryCount}）：${remotePath}：${shortError(error)}`
                  );
                }
              }
            );
            try {
              await vscode.workspace.fs.writeFile(saveUri, bytes);
            } catch (error) {
              throw localFileSystemError('写入本地文件失败', saveUri, error);
            }
            vscode.window.setStatusBarMessage(
              `$(check) 已下载 ${name}（${formatSize(bytes.length)}）`,
              3000
            );
            void vscode.window
              .showInformationMessage(
                `已下载到 “${saveUri.fsPath}”。`,
                '打开',
                '在文件夹中显示'
              )
              .then((choice) => {
                if (choice === '打开') {
                  void vscode.commands.executeCommand('vscode.open', saveUri);
                } else if (choice === '在文件夹中显示') {
                  void vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
              });
          } finally {
            cancellation.dispose();
          }
        }
      );
    } catch (error) {
      if (error instanceof KaggleError && error.kind === 'cancelled') {
        vscode.window.setStatusBarMessage('已取消下载', 2000);
        return;
      }
      this.options.log(`下载文件失败: ${remotePath}: ${describeError(error)}`);
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      await this.promptFailure(
        isSessionError(error)
          ? `下载失败：Kaggle 会话可能已过期（${shortError(error)}）。`
          : `下载 ${name} 失败：${shortError(error)}`,
        { offerUpdateUrl: isSessionError(error), level: 'error' }
      );
    }
  }

  private async downloadMultiple(
    client: JupyterClient,
    rawItems: readonly RemoteSelectionItem[]
  ): Promise<void> {
    const planned = planMultiDownloadTargets(rawItems);
    if (planned.length === 0) {
      return;
    }

    const destination = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: '下载到此文件夹',
      defaultUri: this.defaultLocalFolder()
    });
    if (!destination || destination.length === 0) {
      return;
    }

    const rootTarget = destination[0];
    const existingNames: string[] = [];
    for (const entry of planned) {
      const targetUri = vscode.Uri.joinPath(rootTarget, ...entry.localParts);
      if (await statSafe(targetUri)) {
        existingNames.push(entry.localParts.join(path.sep));
      }
    }
    if (existingNames.length > 0) {
      const preview = existingNames.slice(0, 5).join('\n');
      const detail =
        existingNames.length > 5
          ? `${preview}\n… 另有 ${existingNames.length - 5} 项`
          : preview;
      const choice = await vscode.window.showWarningMessage(
        `目标文件夹中已存在 ${existingNames.length} 个同名文件或文件夹，继续会覆盖同名文件。`,
        { modal: true, detail },
        '继续下载',
        '取消'
      );
      if (choice !== '继续下载') {
        return;
      }
    }

    const concurrency = getConcurrency();
    const retryCount = getRetryCount();
    this.options.log(
      `批量下载 ${planned.length} 个远端项目 -> ${rootTarget.fsPath}（并发=${concurrency}，重试=${retryCount}）`
    );

    const summary = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `下载 ${planned.length} 个项目`,
        cancellable: true
      },
      async (progress, token): Promise<DownloadSummary> => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        let lastCompleted = 0;
        const uriFor = (parts: readonly string[]) =>
          parts.length > 0 ? vscode.Uri.joinPath(rootTarget, ...parts) : rootTarget;
        try {
          return await downloadRemoteSelections({
            client,
            entries: planned.map(({ item, localParts }) => ({
              remotePath: item.path,
              relativeParts: localParts,
              type:
                item.entryType === 'directory'
                  ? 'directory'
                  : item.entryType === 'notebook'
                    ? 'notebook'
                    : 'file',
              size: item.entrySize
            })),
            concurrency,
            retryCount,
            signal: controller.signal,
            ensureDirectory: (parts) => ensureLocalDirectory(uriFor(parts)),
            writeFile: async (parts, bytes) => {
              const target = uriFor(parts);
              try {
                await vscode.workspace.fs.writeFile(target, bytes);
              } catch (error) {
                throw localFileSystemError('写入本地文件失败', target, error);
              }
            },
            formatLocalPath: (parts) => uriFor(parts).fsPath,
            onProgress: (event) => {
              if (event.phase === 'scanning') {
                progress.report({
                  message: `正在扫描远端目录（已发现 ${event.filesFound} 个文件）…`
                });
                return;
              }
              const delta = Math.max(0, event.completed - lastCompleted);
              lastCompleted = event.completed;
              progress.report({
                increment: (delta * 100) / Math.max(event.total, 1),
                message: `${event.completed}/${event.total} ${remoteBasename(event.currentPath)}`
              });
            },
            log: this.options.log
          });
        } finally {
          cancellation.dispose();
        }
      }
    );

    await this.notifyDownloadSummary(summary, rootTarget);
  }

  private async notifyDownloadSummary(
    summary: DownloadSummary,
    targetDirectory: vscode.Uri
  ): Promise<void> {
    this.options.log(
      `下载结果：总计 ${summary.total}，成功 ${summary.downloaded}，失败 ${summary.failed}，跳过 ${summary.skipped}，取消=${summary.cancelled}，会话过期=${summary.sessionExpired}`
    );

    if (summary.sessionExpired) {
      this.options.connectionState.markDisconnected();
      this.options.probes.invalidate();
      await this.promptFailure(
        `下载中断：Kaggle 会话可能已过期。成功 ${summary.downloaded}，失败 ${summary.failed}，跳过 ${summary.skipped}。`,
        {
          offerUpdateUrl: true,
          revealUri: summary.downloaded > 0 ? targetDirectory : undefined,
          level: 'error'
        }
      );
      return;
    }

    if (summary.cancelled) {
      if (summary.downloaded > 0 || summary.failed > 0) {
        await this.promptFailure(
          `已取消下载：成功 ${summary.downloaded}，失败 ${summary.failed}，跳过 ${summary.skipped}。`,
          {
            revealUri: summary.downloaded > 0 ? targetDirectory : undefined,
            level: 'warning'
          }
        );
      }
      return;
    }

    const allConnectionFailed =
      summary.downloaded === 0 &&
      summary.failed > 0 &&
      summary.failures.every((failure) => isConnectionError(failure.error));

    if (summary.abortedByConnection || allConnectionFailed) {
      this.options.connectionState.markDisconnected();
      this.options.probes.invalidate();
      const headline = shortError(summary.fatalError ?? summary.failures[0]?.error);
      const prefix =
        summary.downloaded > 0
          ? `下载中断（已保存 ${summary.downloaded}，失败 ${summary.failed}，跳过 ${summary.skipped}）`
          : '下载失败';
      await this.promptFailure(`${prefix}：${headline}`, {
        revealUri: summary.downloaded > 0 ? targetDirectory : undefined,
        level: 'error'
      });
      return;
    }

    if (summary.failed > 0) {
      const details = summary.failures.slice(0, 3).map((failure) => {
        const message = shortError(failure.error);
        return `${failure.remotePath}: ${message.length > 160 ? `${message.slice(0, 160)}…` : message}`;
      });
      await this.promptFailure(
        `下载完成：成功 ${summary.downloaded}，失败 ${summary.failed}。\n${details.join('\n')}`,
        {
          revealUri: summary.downloaded > 0 ? targetDirectory : undefined,
          level: 'warning'
        }
      );
      return;
    }

    void vscode.window
      .showInformationMessage(
        `已下载 ${summary.downloaded} 个文件到 “${targetDirectory.fsPath}”。`,
        '在文件夹中显示'
      )
      .then((choice) => {
        if (choice === '在文件夹中显示') {
          void vscode.commands.executeCommand('revealFileInOS', targetDirectory);
        }
      });
  }

  private async deleteSingle(
    client: JupyterClient,
    item: RemoteSelectionItem
  ): Promise<void> {
    const remotePath = item.path;
    const isRoot = Boolean(item.isRoot);
    const isDirectory = item.entryType === 'directory' || isRoot;

    let detail = isDirectory
      ? `${remotePath}\n文件夹及其内容会被递归删除，且无法恢复。`
      : `${remotePath}\n删除后无法恢复。`;
    if (isRoot) {
      detail +=
        '\n\n这是当前工作目录；删除后工作区会回退到 Jupyter 根目录，下次上传会自动重建。';
    }

    const choice = await vscode.window.showWarningMessage(
      `确定删除远端${isDirectory ? '文件夹' : '文件'}？`,
      { modal: true, detail },
      '删除',
      '取消'
    );
    if (choice !== '删除') {
      return;
    }

    this.options.log(`删除远端: ${remotePath}${isDirectory ? '（目录）' : ''}`);
    await this.deleteSingleRemotePath(client, remotePath, isDirectory, getRetryCount());

    if (isRoot) {
      this.options.onMutated({ fullRefresh: true });
      vscode.window.setStatusBarMessage(
        `已删除工作目录 “${remotePath}”；重新加载时会自动重建。`,
        4000
      );
      return;
    }

    this.options.onMutated({
      invalidate: [remotePath],
      parents: [dirnameRemotePath(remotePath)]
    });
    vscode.window.setStatusBarMessage(`$(check) 已删除 ${remotePath}`, 3000);
  }

  private async deleteMultiple(
    client: JupyterClient,
    rawItems: readonly RemoteSelectionItem[]
  ): Promise<void> {
    const items = filterOutNestedRemotePaths(rawItems);
    if (items.length === 0) {
      return;
    }

    const preview = items.slice(0, 5).map((item) => item.path).join('\n');
    const detail =
      (items.length > 5 ? `${preview}\n… 另有 ${items.length - 5} 项` : preview) +
      '\n\n文件夹及其内容会被递归删除，且无法恢复。';

    const choice = await vscode.window.showWarningMessage(
      `确定删除选中的 ${items.length} 个远端项目？`,
      { modal: true, detail },
      '删除',
      '取消'
    );
    if (choice !== '删除') {
      return;
    }

    const retryCount = getRetryCount();
    const deletedPaths: string[] = [];
    const parentDirs: string[] = [];
    const failures: Array<{ path: string; error: unknown }> = [];
    let sessionExpiredError: unknown;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `删除 ${items.length} 个远端项目`,
        cancellable: true
      },
      async (progress, token) => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        try {
          for (let index = 0; index < items.length; index += 1) {
            if (controller.signal.aborted) {
              break;
            }
            const item = items[index];
            progress.report({
              increment: 100 / items.length,
              message: `${index + 1}/${items.length} ${remoteBasename(item.path)}`
            });
            try {
              const isDirectory = item.entryType === 'directory' || Boolean(item.isRoot);
              this.options.log(`批量删除远端: ${item.path}${isDirectory ? '（目录）' : ''}`);
              await this.deleteSingleRemotePath(
                client,
                item.path,
                isDirectory,
                retryCount,
                controller.signal
              );
              deletedPaths.push(item.path);
              parentDirs.push(dirnameRemotePath(item.path));
            } catch (error) {
              if (error instanceof KaggleError && error.kind === 'cancelled') {
                break;
              }
              failures.push({ path: item.path, error });
              this.options.log(`删除失败: ${item.path}: ${describeError(error)}`);
              if (isSessionError(error)) {
                sessionExpiredError = error;
                controller.abort();
                break;
              }
            }
          }
        } finally {
          cancellation.dispose();
        }
      }
    );

    if (deletedPaths.length > 0) {
      this.options.onMutated({
        invalidate: deletedPaths,
        parents: parentDirs
      });
    }

    if (sessionExpiredError) {
      this.options.connectionState.markDisconnected();
      this.options.probes.invalidate();
      await this.promptFailure(
        `删除中断：Kaggle 会话可能已过期（已删除 ${deletedPaths.length}，失败 ${failures.length}）。`,
        { offerUpdateUrl: true, level: 'error' }
      );
      return;
    }

    if (failures.length > 0) {
      const detailText = failures
        .slice(0, 3)
        .map((item) => `${item.path}: ${shortError(item.error)}`)
        .join('\n');
      await this.promptFailure(
        `批量删除完成：成功 ${deletedPaths.length}，失败 ${failures.length}。\n${detailText}`,
        { level: 'warning' }
      );
      return;
    }

    vscode.window.setStatusBarMessage(`$(check) 已删除 ${deletedPaths.length} 个项目`, 3000);
  }

  private async deleteSingleRemotePath(
    client: JupyterClient,
    remotePath: string,
    isDirectory: boolean,
    retryCount: number,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      await withRetries(
        () => client.deleteContents(remotePath, signal),
        retryCount,
        signal,
        {
          cancelMessage: '删除已取消',
          onRetry: (attempt, error, delayMs) => {
            this.options.log(
              `删除失败，${delayMs} ms 后重试（${attempt}/${retryCount}）：${remotePath}：${shortError(error)}`
            );
          }
        }
      );
    } catch (error) {
      if (!isDirectory || !isNonEmptyDirectoryError(error)) {
        throw error;
      }
      this.options.log(`服务器拒绝直接删除非空目录，改为逐项删除: ${remotePath}`);
      await deleteRemoteTree(client, remotePath, this.options.log, retryCount, signal);
    }
  }

  private async promptFailure(
    message: string,
    options: {
      offerUpdateUrl?: boolean;
      revealUri?: vscode.Uri;
      level: 'error' | 'warning';
    }
  ): Promise<void> {
    const actions: string[] = [];
    if (options.offerUpdateUrl) {
      actions.push('更新 Jupyter URL');
    }
    if (options.revealUri) {
      actions.push('在文件夹中显示');
    }
    actions.push('查看日志');

    const show =
      options.level === 'error'
        ? vscode.window.showErrorMessage
        : vscode.window.showWarningMessage;
    const choice = await show(message, ...actions);
    if (choice === '更新 Jupyter URL') {
      await vscode.commands.executeCommand('kaggleConnector.setServerUrl');
    } else if (choice === '在文件夹中显示' && options.revealUri) {
      void vscode.commands.executeCommand('revealFileInOS', options.revealUri);
    } else if (choice === '查看日志') {
      this.options.showOutput();
    }
  }
}

function normalizeSelectionItems(
  rawItems: readonly RemoteSelectionItem[]
): RemoteSelectionItem[] {
  const result: RemoteSelectionItem[] = [];
  for (const item of rawItems) {
    const normalized = normalizeRemotePath(item.path);
    if (!normalized) {
      continue;
    }
    result.push({
      path: normalized,
      entryType: item.entryType,
      entrySize: item.entrySize,
      isRoot: Boolean(item.isRoot)
    });
  }
  return result;
}

function isNonEmptyDirectoryError(error: unknown): boolean {
  return (
    error instanceof KaggleError &&
    error.status === 400 &&
    /not empty/i.test(error.detail ?? error.message)
  );
}

async function prepareRemoteTarget(
  client: JupyterClient,
  target: string
): Promise<void> {
  const parent = dirnameRemotePath(target);
  if (!parent) {
    return;
  }

  try {
    const model = await client.getContents(parent);
    if (!model || typeof model !== 'object' || (model as { type?: unknown }).type !== 'directory') {
      throw new KaggleError('badRequest', `目标父路径不是目录：${parent}`);
    }
  } catch (error) {
    if (error instanceof KaggleError && error.kind === 'notFound') {
      const choice = await vscode.window.showWarningMessage(
        `目标目录 “${parent}” 不存在，是否创建？`,
        { modal: true },
        '创建并继续',
        '取消'
      );
      if (choice !== '创建并继续') {
        throw new KaggleError('cancelled', '已取消');
      }
      await client.ensureDirectories([parent]);
      return;
    }
    throw error;
  }
}

async function remoteExists(client: JupyterClient, remotePath: string): Promise<boolean> {
  try {
    await client.getContents(remotePath);
    return true;
  } catch (error) {
    if (error instanceof KaggleError && error.kind === 'notFound') {
      return false;
    }
    throw error;
  }
}

async function deleteRemoteTree(
  client: JupyterClient,
  remotePath: string,
  log: (message: string) => void,
  retryCount = 0,
  signal?: AbortSignal
): Promise<void> {
  const entries = await withRetries(
    () => client.listDirectory(remotePath, signal),
    retryCount,
    signal,
    { cancelMessage: '删除已取消' }
  );
  for (const entry of entries) {
    if (signal?.aborted) {
      throw new KaggleError('cancelled', '删除已取消');
    }
    if (entry.type === 'directory') {
      await deleteRemoteTree(client, entry.path, log, retryCount, signal);
    } else {
      await withRetries(
        () => client.deleteContents(entry.path, signal),
        retryCount,
        signal,
        { cancelMessage: '删除已取消' }
      );
    }
  }
  await withRetries(
    () => client.deleteContents(remotePath, signal),
    retryCount,
    signal,
    { cancelMessage: '删除已取消' }
  );
  log(`删除目录完成: ${remotePath}`);
}

async function copyRemoteTree(
  client: JupyterClient,
  source: string,
  target: string,
  isDirectory: boolean,
  retryCount: number,
  signal: AbortSignal,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  log: (message: string) => void
): Promise<number> {
  if (signal.aborted) {
    throw new KaggleError('cancelled', '复制已取消');
  }

  const retry = <T>(label: string, action: () => Promise<T>): Promise<T> =>
    withRetries(action, retryCount, signal, {
      cancelMessage: '复制已取消',
      onRetry: (attempt, error, delayMs) => {
        log(
          `${label}失败，${delayMs} ms 后重试（${attempt}/${retryCount}）：${shortError(error)}`
        );
      }
    });

  if (isDirectory) {
    await retry(`创建目录 ${target}`, () => client.putDirectory(target, signal));
    const entries = await retry(`列出目录 ${source}`, () =>
      client.listDirectory(source, signal)
    );
    let files = 0;
    for (const entry of entries) {
      if (SYSTEM_ENTRIES.has(entry.name)) {
        continue;
      }
      if (signal.aborted) {
        throw new KaggleError('cancelled', '复制已取消');
      }
      files += await copyRemoteTree(
        client,
        entry.path,
        joinRemotePath(target, entry.name),
        entry.type === 'directory',
        retryCount,
        signal,
        progress,
        log
      );
    }
    return files;
  }

  const bytes = await retry(`读取 ${source}`, () => client.readFile(source, signal));
  await retry(`写入 ${target}`, () => client.putFile(target, bytes, signal));
  progress.report({ message: `已复制：${target}` });
  log(`复制文件: ${source} -> ${target}`);
  return 1;
}

async function statSafe(uri: vscode.Uri): Promise<vscode.FileStat | undefined> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch {
    return undefined;
  }
}

async function ensureLocalDirectory(uri: vscode.Uri): Promise<void> {
  const stat = await statSafe(uri);
  if (stat) {
    if ((stat.type & vscode.FileType.Directory) === 0) {
      throw new KaggleError('badRequest', `本地路径不是文件夹：${uri.fsPath}`);
    }
    return;
  }
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch (error) {
    throw localFileSystemError('创建本地文件夹失败', uri, error);
  }
}

function localFileSystemError(
  action: string,
  uri: vscode.Uri,
  error: unknown
): KaggleError {
  return new KaggleError('unknown', `${action}：${uri.fsPath}`, {
    detail: error instanceof Error ? error.message : String(error),
    hint: '检查本地路径、写入权限和磁盘空间。',
    cause: error
  });
}

function languageIdForRemotePath(remotePath: string): string | undefined {
  const name = remotePath.toLowerCase();
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1) : '';
  switch (extension) {
    case 'py':
      return 'python';
    case 'ipynb':
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'toml':
      return 'toml';
    case 'ts':
      return 'typescript';
    case 'js':
      return 'javascript';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'sh':
    case 'bash':
      return 'shellscript';
    case 'sql':
      return 'sql';
    case 'r':
      return 'r';
    case 'txt':
    case 'log':
      return 'plaintext';
    default:
      return undefined;
  }
}

