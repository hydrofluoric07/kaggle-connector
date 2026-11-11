import { createHash, getHashes } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { JupyterClient, type JupyterContentsEntry } from './client';
import { isExcluded } from './core/exclude';
import { KaggleError, isSessionError, shortError } from './core/errors';
import { withRetries } from './core/retry';
import {
  decideUpload,
  UPLOAD_MTIME_TOLERANCE_MS,
  type ConflictPolicy
} from './core/uploadPolicy';
import {
  childRemoteBase,
  isInsideOrEqual,
  localRelative,
  selectionRemoteBase,
  type PathMode
} from './core/paths';
import { dirnameRemotePath, joinRemotePath, normalizeRemotePath } from './core/url';

export interface UploadConfig {
  remoteDir: string;
  pathMode: PathMode;
  exclude: string[];
  maxFileSizeMB: number;
  concurrency: number;
  timeoutMs: number;
  skipUnchanged: boolean;
  conflictPolicy: ConflictPolicy;
  retryCount: number;
}

export interface UploadFailure {
  localPath: string;
  remotePath?: string;
  error: unknown;
}

export interface SelectedRoot {
  uri: vscode.Uri;
  isDirectory: boolean;
  workspaceRoot?: string;
}

export interface CollectedFile {
  uri: vscode.Uri;
  selectionRoot: SelectedRoot;
  size: number;
  mtime: number;
}

export interface CollectResult {
  files: CollectedFile[];
  failures: UploadFailure[];
  skipped: number;
}

export interface PlannedFile {
  uri: vscode.Uri;
  localPath: string;
  remotePath: string;
  size: number;
  mtime: number;
}

export interface PlanResult {
  plans: PlannedFile[];
  failures: UploadFailure[];
}

export interface UploadSummary {
  total: number;
  uploaded: number;
  failed: number;
  skipped: number;
  /** Files skipped because the remote copy was unchanged. */
  unchanged: number;
  /** Files skipped because the remote copy was newer than the local file. */
  skippedNewer: number;
  cancelled: boolean;
  sessionExpired: boolean;
  failures: UploadFailure[];
}

export interface PreflightResult {
  uploads: PlannedFile[];
  unchanged: PlannedFile[];
  remoteNewer: PlannedFile[];
  failures: UploadFailure[];
  cancelled: boolean;
  sessionExpired: boolean;
  fatalError?: unknown;
}

const MAX_DEPTH = 100;

/**
 * Expand the Explorer selection into files. Directly selected files are
 * processed before folders, so an explicitly selected file wins when it is
 * also inside a selected folder.
 */
export async function collectSelections(
  selections: readonly vscode.Uri[],
  config: UploadConfig,
  token: vscode.CancellationToken,
  log: (message: string) => void
): Promise<CollectResult> {
  const uniqueSelections = new Map<string, vscode.Uri>();
  for (const uri of selections) {
    if (uri.scheme === 'file') {
      uniqueSelections.set(uri.fsPath, uri);
    }
  }

  const roots: SelectedRoot[] = [];
  const failures: UploadFailure[] = [];
  let skipped = 0;

  for (const uri of uniqueSelections.values()) {
    if (token.isCancellationRequested) {
      break;
    }

    let stat: vscode.FileStat;
    try {
      stat = await vscode.workspace.fs.stat(uri);
    } catch (error) {
      failures.push({
        localPath: uri.fsPath,
        error: localFileError('读取本地文件信息失败', error)
      });
      continue;
    }

    if ((stat.type & vscode.FileType.SymbolicLink) !== 0) {
      skipped += 1;
      log(`跳过符号链接: ${uri.fsPath}`);
      continue;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const root: SelectedRoot = {
      uri,
      isDirectory: (stat.type & vscode.FileType.Directory) !== 0,
      workspaceRoot: workspaceFolder?.uri.fsPath
    };

    if (!root.isDirectory && (stat.type & vscode.FileType.File) === 0) {
      skipped += 1;
      log(`跳过未知文件类型: ${uri.fsPath}`);
      continue;
    }

    roots.push(root);
  }

  // Directly selected files win over the same file discovered inside a
  // selected folder (relevant for basename path mode).
  roots.sort((left, right) => {
    const directoryOrder = Number(left.isDirectory) - Number(right.isDirectory);
    return directoryOrder !== 0 ? directoryOrder : left.uri.fsPath.localeCompare(right.uri.fsPath);
  });

  const files: CollectedFile[] = [];

  for (const root of roots) {
    if (token.isCancellationRequested) {
      break;
    }

    if (!root.isDirectory) {
      try {
        const stat = await vscode.workspace.fs.stat(root.uri);
        files.push({
          uri: root.uri,
          selectionRoot: root,
          size: stat.size,
          mtime: stat.mtime
        });
      } catch (error) {
        failures.push({
          localPath: root.uri.fsPath,
          error: localFileError('读取本地文件信息失败', error)
        });
      }
      continue;
    }

    await walkDirectory(root.uri, root, config, token, files, failures, log, 0, (count) => {
      skipped += count;
    });
  }

  return { files, failures, skipped };
}

async function walkDirectory(
  directory: vscode.Uri,
  root: SelectedRoot,
  config: UploadConfig,
  token: vscode.CancellationToken,
  files: CollectedFile[],
  failures: UploadFailure[],
  log: (message: string) => void,
  depth: number,
  addSkipped: (count: number) => void
): Promise<void> {
  if (token.isCancellationRequested) {
    return;
  }
  if (depth > MAX_DEPTH) {
    failures.push({
      localPath: directory.fsPath,
      error: new KaggleError('unknown', `目录层级超过 ${MAX_DEPTH} 层，已跳过`)
    });
    return;
  }

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(directory);
  } catch (error) {
    failures.push({
      localPath: directory.fsPath,
      error: localFileError('读取本地目录失败', error)
    });
    return;
  }

  for (const [name, type] of entries) {
    if (token.isCancellationRequested) {
      return;
    }

    const child = vscode.Uri.joinPath(directory, name);

    if ((type & vscode.FileType.SymbolicLink) !== 0) {
      addSkipped(1);
      log(`跳过符号链接: ${child.fsPath}`);
      continue;
    }

    const relative = exclusionPath(child, root);
    const isDirectory = (type & vscode.FileType.Directory) !== 0;
    const isFile = (type & vscode.FileType.File) !== 0;

    if (isDirectory) {
      if (isExcluded(relative, config.exclude, true)) {
        addSkipped(1);
        log(`排除目录: ${relative}`);
        continue;
      }
      await walkDirectory(child, root, config, token, files, failures, log, depth + 1, addSkipped);
      continue;
    }

    if (!isFile) {
      addSkipped(1);
      log(`跳过未知文件类型: ${child.fsPath}`);
      continue;
    }

    if (isExcluded(relative, config.exclude, false)) {
      addSkipped(1);
      log(`排除文件: ${relative}`);
      continue;
    }

    try {
      const stat = await vscode.workspace.fs.stat(child);
      files.push({
        uri: child,
        selectionRoot: root,
        size: stat.size,
        mtime: stat.mtime
      });
    } catch (error) {
      failures.push({
        localPath: child.fsPath,
        error: localFileError('读取本地文件信息失败', error)
      });
    }
  }
}

function exclusionPath(uri: vscode.Uri, root: SelectedRoot): string {
  if (root.workspaceRoot && isInsideOrEqual(root.workspaceRoot, uri.fsPath)) {
    const relative = localRelative(root.workspaceRoot, uri.fsPath);
    return relative || path.basename(uri.fsPath);
  }
  if (isInsideOrEqual(root.uri.fsPath, uri.fsPath)) {
    const relative = localRelative(root.uri.fsPath, uri.fsPath);
    return relative || path.basename(uri.fsPath);
  }
  return path.basename(uri.fsPath);
}

/**
 * Turn collected files into remote paths, applying path mode, REMOTE_DIR,
 * size limits and collision detection.
 */
export function planUploads(
  files: readonly CollectedFile[],
  config: UploadConfig,
  log: (message: string) => void
): PlanResult {
  const uniqueFiles = new Map<string, CollectedFile>();
  for (const file of files) {
    if (!uniqueFiles.has(file.uri.fsPath)) {
      uniqueFiles.set(file.uri.fsPath, file);
    }
  }

  const plans: PlannedFile[] = [];
  const failures: UploadFailure[] = [];
  const remoteOwners = new Map<string, string>();
  const maxBytes = config.maxFileSizeMB > 0 ? config.maxFileSizeMB * 1024 * 1024 : 0;

  for (const file of uniqueFiles.values()) {
    const selection = file.selectionRoot;
    const base = selectionRemoteBase({
      localPath: selection.uri.fsPath,
      isDirectory: selection.isDirectory,
      workspaceRoot: selection.workspaceRoot,
      mode: config.pathMode
    });

    let relative: string;
    try {
      relative = selection.isDirectory
        ? childRemoteBase(base, selection.uri.fsPath, file.uri.fsPath)
        : base;
    } catch (error) {
      failures.push({ localPath: file.uri.fsPath, error });
      continue;
    }

    let remotePath: string;
    try {
      remotePath = joinRemotePath(config.remoteDir, relative);
    } catch (error) {
      failures.push({ localPath: file.uri.fsPath, error });
      continue;
    }

    if (!remotePath) {
      failures.push({
        localPath: file.uri.fsPath,
        error: new KaggleError('unknown', '计算出的远程路径为空')
      });
      continue;
    }

    if (maxBytes > 0 && file.size > maxBytes) {
      failures.push({
        localPath: file.uri.fsPath,
        remotePath,
        error: new KaggleError(
          'tooLarge',
          `文件大小 ${formatSize(file.size)} 超过上限 ${config.maxFileSizeMB} MB，已跳过`,
          { hint: '调大 kaggleConnector.maxFileSizeMB，或改用 Kaggle Dataset 上传大文件。' }
        )
      });
      continue;
    }

    const owner = remoteOwners.get(remotePath);
    if (owner) {
      failures.push({
        localPath: file.uri.fsPath,
        remotePath,
        error: new KaggleError(
          'unknown',
          `远程路径冲突：${remotePath} 已被 ${owner} 占用`,
          { hint: '使用 “保留工作区相对路径” 模式，或避免在选择多个同名文件时使用 “仅文件名” 模式。' }
        )
      });
      continue;
    }

    remoteOwners.set(remotePath, file.uri.fsPath);
    plans.push({
      uri: file.uri,
      localPath: file.uri.fsPath,
      remotePath,
      size: file.size,
      mtime: file.mtime
    });
  }

  log(`计划上传 ${plans.length} 个文件，${failures.length} 个在规划阶段被跳过。`);
  return { plans, failures };
}

/**
 * Check remote copies before uploading. Only directories that receive files
 * are listed; a missing remote directory simply means "nothing to skip".
 * Failures to check a directory are non-fatal (the files are uploaded) unless
 * the Kaggle session itself is no longer valid.
 */
export async function preflightUploads(
  client: JupyterClient,
  plans: readonly PlannedFile[],
  config: UploadConfig,
  token: vscode.CancellationToken,
  log: (message: string) => void
): Promise<PreflightResult> {
  const result: PreflightResult = {
    uploads: [],
    unchanged: [],
    remoteNewer: [],
    failures: [],
    cancelled: false,
    sessionExpired: false
  };

  const detectRemoteNewer = config.conflictPolicy !== 'overwrite';
  if (!config.skipUnchanged && !detectRemoteNewer) {
    result.uploads = [...plans];
    return result;
  }

  const controller = new AbortController();
  const cancellation = token.onCancellationRequested(() => controller.abort());
  const directoryCache = new Map<string, Map<string, JupyterContentsEntry> | null>();

  try {
    for (const plan of plans) {
      if (token.isCancellationRequested || controller.signal.aborted) {
        result.cancelled = true;
        return result;
      }

      const directory = dirnameRemotePath(plan.remotePath);
      if (!directoryCache.has(directory)) {
        try {
          const entries = await client.listDirectory(directory, controller.signal, {
            // Hashes are the most reliable "unchanged" signal. Servers that
            // ignore hash=1 return null, and we fall back to size + mtime.
            hash: true
          });
          directoryCache.set(
            directory,
            new Map(entries.map((entry) => [entry.name, entry]))
          );
        } catch (error) {
          if (isSessionError(error)) {
            result.sessionExpired = true;
            result.fatalError = error;
            return result;
          }
          if (error instanceof KaggleError && error.kind === 'cancelled') {
            result.cancelled = true;
            return result;
          }
          if (error instanceof KaggleError && error.kind === 'notFound') {
            directoryCache.set(directory, new Map());
          } else {
            log(
              `无法检查工作目录 “${directory || '/'}”，该目录下的文件将直接上传：${shortError(error)}`
            );
            directoryCache.set(directory, null);
          }
        }
      }

      const entries = directoryCache.get(directory) ?? null;
      if (!entries) {
        result.uploads.push(plan);
        continue;
      }

      const name = plan.remotePath.slice(plan.remotePath.lastIndexOf('/') + 1);
      const remote = entries.get(name);
      if (!remote) {
        result.uploads.push(plan);
        continue;
      }

      const clockOffsetMs = client.getClockOffsetMs();
      const remoteMtime =
        typeof remote.lastModified === 'number'
          ? remote.lastModified - clockOffsetMs
          : undefined;
      const mtimeSuggestsUnchanged =
        remoteMtime === undefined ||
        remoteMtime >= plan.mtime - UPLOAD_MTIME_TOLERANCE_MS;

      let localHash: string | undefined;
      if (
        remote.hash &&
        remote.hashAlgorithm &&
        (remote.size === undefined || remote.size === plan.size) &&
        // Avoid hashing (reading) files that are clearly newer locally.
        mtimeSuggestsUnchanged &&
        (config.skipUnchanged || detectRemoteNewer)
      ) {
        try {
          localHash = await hashLocalFile(plan.uri, remote.hashAlgorithm);
          if (localHash === undefined) {
            log(
              `Jupyter 返回的 hash 算法 “${remote.hashAlgorithm}” 不受支持，改用大小/时间判断：${plan.remotePath}`
            );
          }
        } catch (error) {
          // Never hide an unreadable local file by skipping it; let the
          // upload attempt surface the real error.
          log(
            `无法读取本地文件计算 hash，将直接上传：${plan.localPath}：${shortError(error)}`
          );
          result.uploads.push(plan);
          continue;
        }
      }

      const decision = decideUpload({
        localSize: plan.size,
        localMtime: plan.mtime,
        remote,
        localHash,
        clockOffsetMs
      });

      if (decision === 'unchanged') {
        if (config.skipUnchanged) {
          result.unchanged.push(plan);
          log(`跳过未修改文件：${plan.remotePath}`);
        } else {
          result.uploads.push(plan);
        }
      } else if (decision === 'remoteNewer') {
        if (detectRemoteNewer) {
          result.remoteNewer.push(plan);
        } else {
          result.uploads.push(plan);
        }
      } else if (decision === 'remoteIsDirectory') {
        result.failures.push({
          localPath: plan.localPath,
          remotePath: plan.remotePath,
          error: new KaggleError(
            'badRequest',
            `远端同路径已存在一个目录：${plan.remotePath}`,
            { hint: '请修改本地文件名，或先在远端删除同名目录。' }
          )
        });
      } else {
        result.uploads.push(plan);
      }
    }
  } finally {
    cancellation.dispose();
  }

  log(
    `远端检查完成：待上传 ${result.uploads.length}，未修改 ${result.unchanged.length}，远端较新 ${result.remoteNewer.length}，路径冲突 ${result.failures.length}。`
  );
  return result;
}

async function hashLocalFile(
  uri: vscode.Uri,
  algorithm: string
): Promise<string | undefined> {
  const name = normalizeHashAlgorithm(algorithm);
  if (!name) {
    return undefined;
  }
  const bytes = await vscode.workspace.fs.readFile(uri);
  return createHash(name).update(bytes).digest('hex');
}

function normalizeHashAlgorithm(value: string): string | undefined {
  const algorithm = value.trim().toLowerCase();
  return getHashes().includes(algorithm) ? algorithm : undefined;
}

export async function executeUpload(
  client: JupyterClient,
  plans: readonly PlannedFile[],
  initialFailures: readonly UploadFailure[],
  config: UploadConfig,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken,
  log: (message: string) => void
): Promise<UploadSummary> {
  const controller = new AbortController();
  const cancellation = token.onCancellationRequested(() => controller.abort());
  const failures: UploadFailure[] = [...initialFailures];

  let uploaded = 0;
  let fileFailures = 0;
  let completed = 0;
  let sessionExpired = false;

  try {
    const directories = [
      ...new Set(plans.map((plan) => dirnameRemotePath(plan.remotePath)).filter(Boolean))
    ];

    if (directories.length > 0) {
      progress.report({ message: '创建工作目录…' });
      try {
        await withRetries(
          () => client.ensureDirectories(directories, controller.signal),
          config.retryCount,
          controller.signal,
          {
            cancelMessage: '上传已取消',
            onRetry: (attempt, error, delayMs) => {
              log(
                `创建工作目录失败，${delayMs} ms 后重试（${attempt}/${config.retryCount}）：${shortError(error)}`
              );
            }
          }
        );
      } catch (error) {
        if (!(error instanceof KaggleError && error.kind === 'cancelled')) {
          for (const plan of plans) {
            failures.push({
              localPath: plan.localPath,
              remotePath: plan.remotePath,
              error
            });
          }
          fileFailures = plans.length;
          sessionExpired = isSessionError(error);
          log(`创建工作目录失败: ${String(error)}`);
        }
      }
    }

    if (!controller.signal.aborted && fileFailures === 0 && plans.length > 0) {
      let cursor = 0;
      const largestFile = plans.reduce((max, plan) => Math.max(max, plan.size), 0);
      const largeFileLimit =
        largestFile > 50 * 1024 * 1024 ? 1 : largestFile > 20 * 1024 * 1024 ? 2 : config.concurrency;
      const workerCount = Math.max(
        1,
        Math.min(config.concurrency, largeFileLimit, plans.length)
      );

      const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
          if (controller.signal.aborted) {
            return;
          }

          const index = cursor;
          cursor += 1;
          if (index >= plans.length) {
            return;
          }

          const plan = plans[index];
          try {
            let bytes: Uint8Array;
            try {
              bytes = await vscode.workspace.fs.readFile(plan.uri);
            } catch (error) {
              throw localFileError('读取本地文件失败', error);
            }
            // Build a Buffer view instead of copying the whole file again.
            const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            await withRetries(
              () => client.putFile(plan.remotePath, buffer, controller.signal),
              config.retryCount,
              controller.signal,
              {
                cancelMessage: '上传已取消',
                onRetry: (attempt, error, delayMs) => {
                  log(
                    `上传失败，${delayMs} ms 后重试（${attempt}/${config.retryCount}）：${plan.remotePath}：${shortError(error)}`
                  );
                }
              }
            );
            uploaded += 1;
            log(`上传成功: ${plan.localPath} -> ${plan.remotePath}`);
          } catch (error) {
            if (!(error instanceof KaggleError && error.kind === 'cancelled')) {
              failures.push({
                localPath: plan.localPath,
                remotePath: plan.remotePath,
                error
              });
              fileFailures += 1;
              log(`上传失败: ${plan.localPath} -> ${plan.remotePath}: ${String(error)}`);

              if (isSessionError(error)) {
                sessionExpired = true;
                controller.abort();
              }
            }
          } finally {
            completed += 1;
            progress.report({
              increment: 100 / Math.max(plans.length, 1),
              message: `${completed}/${plans.length} ${path.basename(plan.localPath)}`
            });
          }
        }
      });

      await Promise.all(workers);
    }
  } finally {
    cancellation.dispose();
  }

  return {
    total: plans.length + initialFailures.length,
    uploaded,
    failed: initialFailures.length + fileFailures,
    skipped: plans.length - uploaded - fileFailures,
    unchanged: 0,
    skippedNewer: 0,
    cancelled: token.isCancellationRequested && !sessionExpired,
    sessionExpired,
    failures
  };
}

function localFileError(message: string, error: unknown): KaggleError {
  return new KaggleError('unknown', message, {
    detail: error instanceof Error ? error.message : String(error),
    hint: '检查本地文件是否存在、是否可读，以及是否被其他程序占用。',
    cause: error
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeUploadConfig(config: UploadConfig): UploadConfig {
  return {
    ...config,
    remoteDir: normalizeRemotePath(config.remoteDir)
  };
}
