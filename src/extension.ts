import * as vscode from 'vscode';
import { JupyterClient, type SessionProbeResult } from './client';
import {
  getAutoCdRemoteDir,
  getConcurrency,
  getConflictPolicy,
  getExclude,
  getKeepAliveEnabled,
  getKeepAliveIntervalMinutes,
  getMaxFileSizeMB,
  getPathMode,
  getProbeTimeoutMs,
  getRemoteDir,
  getRetryCount,
  getSkipUnchanged,
  getTimeoutMs,
  SECRET_KEY,
  setRemoteDir
} from './config';
import { ConnectionState } from './core/connectionState';
import { describeError, isConnectionError, isSessionError, KaggleError, shortError } from './core/errors';
import { displayServerUrl, normalizeRemotePath, normalizeServerUrl } from './core/url';
import { KaggleJupyterServers } from './jupyter';
import { KeepAliveManager } from './keepAlive';
import { ProbeCoordinator } from './probe';
import { resolveProxy } from './proxy';
import { KaggleRemoteFileSystemProvider, REMOTE_SCHEME } from './remoteFs';
import { RemoteWorkspaceService } from './remoteWorkspaceService';
import {
  collectSelections,
  executeUpload,
  planUploads,
  preflightUploads,
  type PlannedFile,
  type UploadConfig,
  type UploadSummary
} from './upload';
import { ConnectionViewProvider } from './webview';
import { WorkingDirSyncManager } from './workingDirSync';
import { WorkspaceViewProvider } from './workspaceWebview';

let output: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;
let remoteFileSystem: KaggleRemoteFileSystemProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('Kaggle Connector');
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(output, statusBar);

  const connectionState = new ConnectionState();
  const probes = new ProbeCoordinator({
    clientFactory: createClient,
    getTimeoutMs: getProbeTimeoutMs,
    state: connectionState
  });
  const jupyterServers = new KaggleJupyterServers({
    loadUrl: async () => (await context.secrets.get(SECRET_KEY)) ?? '',
    log
  });
  context.subscriptions.push(jupyterServers);

  const keepAlive = new KeepAliveManager({
    clientFactory: createClient,
    loadUrl: async () => (await context.secrets.get(SECRET_KEY)) ?? '',
    isEnabled: getKeepAliveEnabled,
    getIntervalMs: () => getKeepAliveIntervalMinutes() * 60 * 1000,
    getDeadlineMs: getProbeTimeoutMs,
    state: connectionState,
    log
  });
  context.subscriptions.push(keepAlive);

  const workingDirSync = new WorkingDirSyncManager({
    clientFactory: createClient,
    loadUrl: async () => (await context.secrets.get(SECRET_KEY)) ?? '',
    getRemoteDir,
    isEnabled: getAutoCdRemoteDir,
    state: connectionState,
    log
  });
  context.subscriptions.push(workingDirSync);

  let workspaceView: WorkspaceViewProvider;

  const applyUrlToJupyter = (url: string, explicit: boolean): void => {
    jupyterServers.setUrl(url);
    if (!url) {
      workingDirSync.reset();
      return;
    }
    void jupyterServers.ensureRegistered({ promptIfMissing: explicit }).catch((error) => {
      log(`注册 Jupyter 内核来源失败: ${shortError(error)}`);
    });
  };

  const remoteService = new RemoteWorkspaceService({
    context,
    clientFactory: createClient,
    connectionState,
    probes,
    log,
    showOutput: () => output.show(),
    onMutated: (hint) => {
      void workspaceView.handleMutationHint(hint);
    },
    onRemoteDirUpdated: () => {
      updateStatusBar();
      void provider.refresh();
      void workingDirSync.sync({ force: true });
    },
    onWorkingDirCreated: () => {
      void workingDirSync.onRemoteDirCreated();
    }
  });

  workspaceView = new WorkspaceViewProvider({
    context,
    extensionUri: context.extensionUri,
    clientFactory: createClient,
    connectionState,
    probes,
    service: remoteService,
    log,
    onWorkingDirCreated: () => {
      void workingDirSync.onRemoteDirCreated();
    }
  });
  context.subscriptions.push(
    workspaceView,
    vscode.window.registerWebviewViewProvider(WorkspaceViewProvider.viewType, workspaceView, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  context.subscriptions.push(
    connectionState.onDidChange((connected) => {
      void vscode.commands
        .executeCommand('setContext', 'kaggleConnector.connected', connected)
        .then(undefined, () => undefined);
      updateStatusBar();
      keepAlive.sync();
      void workspaceView.refreshContents();
      if (connected) {
        void workingDirSync.sync();
      }
    })
  );
  // Until a URL is persisted and the session answers, the explorer item stays
  // visible (when-condition) but greyed out (enablement).
  void vscode.commands
    .executeCommand('setContext', 'kaggleConnector.connected', false)
    .then(undefined, () => undefined);

  const provider = new ConnectionViewProvider(
    context,
    context.extensionUri,
    createClient,
    () => {
      updateStatusBar();
      void workspaceView.refreshContents();
    },
    applyUrlToJupyter,
    log,
    connectionState,
    probes,
    (options) => {
      void workingDirSync.sync({ force: options?.force });
    }
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ConnectionViewProvider.viewType, provider, {
      // Keep unsaved input while switching between sidebar views. Persisted
      // URL/REMOTE_DIR are rehydrated through the webview's "ready" handshake.
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('kaggleConnector.upload', upload),
    vscode.commands.registerCommand('kaggleConnector.uploadCurrent', uploadCurrent),
    vscode.commands.registerCommand('kaggleConnector.setServerUrl', setServerUrl),
    vscode.commands.registerCommand('kaggleConnector.setRemoteDir', setRemoteDirCommand),
    vscode.commands.registerCommand('kaggleConnector.testConnection', testConnection),
    vscode.commands.registerCommand('kaggleConnector.clearServerUrl', clearServerUrl),
    vscode.commands.registerCommand('kaggleConnector.syncKernelWorkingDir', syncKernelWorkingDir),
    vscode.commands.registerCommand('kaggleConnector.remote.refresh', () => {
      probes.invalidate();
      void workspaceView.refreshContents();
    }),
    vscode.commands.registerCommand('kaggleConnector.remote.newFile', () => {
      workspaceView.startInlineCreate(false);
    }),
    vscode.commands.registerCommand('kaggleConnector.remote.newFolder', () => {
      workspaceView.startInlineCreate(true);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('kaggleConnector')) {
        // Do not refresh the webview here: auto-save writes settings while
        // the user is editing, and a state push would reset the form.
        updateStatusBar();
      }
      if (
        event.affectsConfiguration('kaggleConnector.keepAlive') ||
        event.affectsConfiguration('kaggleConnector.keepAliveIntervalMinutes')
      ) {
        keepAlive.sync();
      }
      if (event.affectsConfiguration('kaggleConnector.remoteDir')) {
        void workspaceView.refreshContents();
      }
      if (
        event.affectsConfiguration('kaggleConnector.remoteDir') ||
        event.affectsConfiguration('kaggleConnector.autoCdRemoteDir')
      ) {
        void workingDirSync.sync({ force: true });
      }
      if (
        event.affectsConfiguration('kaggleConnector.proxy') ||
        event.affectsConfiguration('kaggleConnector.requestTimeoutMs') ||
        event.affectsConfiguration('kaggleConnector.sessionProbeTimeoutMs')
      ) {
        // Connectivity inputs changed: cached liveness may no longer hold.
        probes.invalidate();
        void initializeConnectionState();
      }
      if (event.affectsConfiguration('workbench.iconTheme')) {
        workspaceView.invalidateIconTheme();
        void workspaceView.refreshContents();
      }
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      workspaceView.invalidateIconTheme();
      void workspaceView.refreshContents();
    })
  );

  updateStatusBar();
  void initializeConnectionState().then(() => {
    keepAlive.sync();
  });

  // Register the Kaggle session as a kernel source only when notebooks are in
  // play; a plain startup with a saved URL must not activate the Jupyter
  // extension. ensureRegistered() also no-ops without a saved URL.
  const ensureKernelSource = (): void => {
    void jupyterServers.ensureRegistered().catch((error) => {
      log(`注册 Jupyter 内核来源失败: ${shortError(error)}`);
    });
  };
  context.subscriptions.push(
    vscode.workspace.onDidOpenNotebookDocument(() => ensureKernelSource())
  );
  if (vscode.workspace.notebookDocuments.length > 0) {
    ensureKernelSource();
  }

  function createClient(serverUrl: string): JupyterClient {
    const normalized = normalizeServerUrl(serverUrl);
    return new JupyterClient(normalized, {
      proxy: resolveProxy(new URL(normalized)),
      timeoutMs: getTimeoutMs()
    });
  }

  // Remote files opened from the workspace tree are backed by this provider;
  // saving writes back through the same client/proxy configuration.
  const remoteFs = new KaggleRemoteFileSystemProvider(
    async () => {
      const url = await context.secrets.get(SECRET_KEY);
      if (!url) {
        throw new KaggleError('badRequest', '尚未设置 Jupyter URL', {
          hint: '在侧栏填入 Jupyter URL 并保存后再打开远端文件。'
        });
      }
      return createClient(url);
    },
    log,
    () => workspaceView.scheduleRefresh(),
    (error) => {
      connectionState.markDisconnected();
      probes.invalidate();
      log(`远端文件操作检测到连接问题: ${shortError(error)}`);
    }
  );
  remoteFileSystem = remoteFs;
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(REMOTE_SCHEME, remoteFs, {
      isCaseSensitive: true
    }),
    remoteFs,
    vscode.commands.registerCommand('kaggleConnector.saveRemoteNow', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.scheme !== REMOTE_SCHEME) {
        await vscode.commands.executeCommand('workbench.action.files.save');
        return;
      }
      const key = editor.document.uri.toString();
      try {
        // Flush any pending debounced content immediately.
        await remoteFs.flushPending(key);
      } catch (error) {
        void vscode.window.showErrorMessage(`保存远端文件失败：${shortError(error)}`);
        return;
      }
      if (editor.document.isDirty) {
        // The next writeFile is a manual save: skip the debounce and reset
        // the 5s/2min timers after uploading.
        remoteFs.beginManualSave(key);
        try {
          await vscode.commands.executeCommand('workbench.action.files.save');
        } finally {
          remoteFs.clearManualSave(key);
        }
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.uri.scheme === REMOTE_SCHEME) {
        void remoteFs.flushPending(document.uri.toString()).catch((error) => {
          log(`关闭远端文档时上传失败: ${shortError(error)}`);
        });
      }
    }),
    vscode.window.onDidChangeWindowState((state) => {
      if (!state.focused) {
        // No reliable "window will close" hook; losing focus is the best
        // available signal for a quick exit.
        void remoteFs.flushAll().catch((error) => {
          log(`窗口失焦时上传失败: ${shortError(error)}`);
        });
      }
    })
  );

  function updateStatusBar(): void {
    const remoteDir = getRemoteDir();
    const connectionText = connectionState.connected
      ? 'Kaggle 已连接'
      : 'Kaggle 未连接（在侧栏设置 URL 并连接）';
    const remoteDirText = remoteDir ? `REMOTE_DIR: ${remoteDir}` : '尚未设置 REMOTE_DIR';
    statusBar.text = '$(cloud-upload) Kaggle';
    statusBar.tooltip = `${connectionText}\n${remoteDirText}\n上传当前文件到 Kaggle`;
    statusBar.command = 'kaggleConnector.uploadCurrent';
    statusBar.show();
  }

  /**
   * Re-read the persisted URL and reflect it in the connection state. Kept
   * silent: a failed background probe must not nag the user. A future command
   * or sidebar refresh will surface the real error.
   */
  async function initializeConnectionState(): Promise<void> {
    const url = (await context.secrets.get(SECRET_KEY)) ?? '';
    connectionState.syncUrl(url);
    if (!url) {
      return;
    }
    await probes.probe(url);
  }

  async function setServerUrl(): Promise<void> {
    const current = (await context.secrets.get(SECRET_KEY)) ?? '';
    const value = await vscode.window.showInputBox({
      title: '设置 Kaggle Jupyter URL',
      prompt: '粘贴 Kaggle Notebook → Run → Kaggle Jupyter Server 中的 “VS Code Compatible URL”',
      value: current,
      ignoreFocusOut: true,
      validateInput: (text) => {
        try {
          normalizeServerUrl(text);
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    });
    if (value === undefined) {
      return;
    }

    const normalized = normalizeServerUrl(value);
    await context.secrets.store(SECRET_KEY, normalized);
    connectionState.syncUrl(normalized);
    probes.invalidate();
    applyUrlToJupyter(normalized, true);
    log(`已更新 Jupyter URL: ${displayServerUrl(normalized)}`);
    updateStatusBar();
    await provider.refresh();
    void workspaceView.refreshContents();
    void probes.probe(normalized);
    vscode.window.setStatusBarMessage('$(check) Kaggle Jupyter URL 已保存', 3000);
  }

  async function setRemoteDirCommand(): Promise<void> {
    const value = await vscode.window.showInputBox({
      title: '设置工作目录 (REMOTE_DIR)',
      prompt: '相对于 Jupyter 根目录，例如 news_recommender 或 news_recommender/src',
      value: getRemoteDir(),
      ignoreFocusOut: true,
      validateInput: (text) => {
        try {
          return normalizeRemotePath(text) ? undefined : 'REMOTE_DIR 不能为空';
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    });
    if (value === undefined) {
      return;
    }

    try {
      await setRemoteDir(value);
    } catch (error) {
      void vscode.window.showErrorMessage(shortError(error));
      return;
    }

    updateStatusBar();
    await provider.refresh();
    void workspaceView.refreshContents();
    vscode.window.setStatusBarMessage(`$(check) REMOTE_DIR: ${getRemoteDir()}`, 3000);
  }

  async function clearServerUrl(): Promise<void> {
    const stored = await context.secrets.get(SECRET_KEY);
    if (!stored) {
      vscode.window.setStatusBarMessage('当前没有保存 Jupyter URL', 3000);
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      '确定清除已保存的 Kaggle Jupyter URL？',
      { modal: true },
      '清除'
    );
    if (choice !== '清除') {
      return;
    }

    await context.secrets.delete(SECRET_KEY);
    connectionState.syncUrl('');
    probes.invalidate();
    applyUrlToJupyter('', true);
    updateStatusBar();
    await provider.refresh();
    void workspaceView.refreshContents();
    vscode.window.setStatusBarMessage('$(check) 已清除 Jupyter URL', 3000);
  }

  async function testConnection(): Promise<void> {
    const url = await context.secrets.get(SECRET_KEY);
    if (!url) {
      await promptForUrl();
      return;
    }

    const remoteDir = getRemoteDir();
    if (!remoteDir) {
      await promptForRemoteDir();
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '测试 Kaggle 连接',
        cancellable: false
      },
      async () => {
        try {
          connectionState.syncUrl(url);
          const client = createClient(url);
          const probe = await probes.probeFresh(url);
          if (!probe.alive) {
            connectionState.markDisconnected();
            probes.invalidate();
            await offerProbeRecovery(probe);
            return;
          }
          connectionState.markConnected(connectionState.captureTicket());
          let result = await client.test(remoteDir);
          if (!result.exists && remoteDir) {
            await client.ensureDirectories([remoteDir]);
            log(`远端工作目录不存在，已自动创建并进入: ${remoteDir}`);
            result = await client.test(remoteDir);
            void workspaceView.refreshContents();
          }
          void workingDirSync.sync({ force: true });
          if (result.writable === false) {
            void vscode.window.showWarningMessage(
              `连接成功，但目录 “${result.path}” 不可写（Kaggle 只能写 /kaggle/working）。`
            );
          } else {
            vscode.window.setStatusBarMessage(
              `$(check) 连接成功：${result.path}${result.writable === true ? '（可写）' : ''}`,
              3000
            );
          }
        } catch (error) {
          logError(error);
          if (isConnectionError(error)) {
            connectionState.markDisconnected();
            probes.invalidate();
          }
          if (await offerSessionRecovery(error)) {
            return;
          }
          const choice = await vscode.window.showErrorMessage(
            `连接失败：${shortError(error)}`,
            '查看日志'
          );
          if (choice === '查看日志') {
            output.show();
          }
        }
      }
    );
  }

  async function upload(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<void> {
    const candidates = (uris && uris.length > 0 ? uris : uri ? [uri] : []).filter(
      (item) => item.scheme === 'file'
    );

    if (candidates.length === 0) {
      const active = vscode.window.activeTextEditor?.document.uri;
      if (active && active.scheme === 'file') {
        candidates.push(active);
      }
    }

    if (candidates.length === 0) {
      void vscode.window.showWarningMessage('请先在资源管理器中选择要上传的文件或文件夹。');
      return;
    }

    const url = await context.secrets.get(SECRET_KEY);
    if (!url) {
      await promptForUrl();
      return;
    }

    const remoteDir = getRemoteDir();
    if (!remoteDir) {
      await promptForRemoteDir();
      return;
    }

    const config: UploadConfig = {
      remoteDir,
      pathMode: getPathMode(),
      exclude: getExclude(),
      maxFileSizeMB: getMaxFileSizeMB(),
      concurrency: getConcurrency(),
      timeoutMs: getTimeoutMs(),
      skipUnchanged: getSkipUnchanged(),
      conflictPolicy: getConflictPolicy(),
      retryCount: getRetryCount()
    };

    log(
      `开始上传：${candidates.length} 个选择，REMOTE_DIR=${remoteDir}，路径模式=${config.pathMode}，排除规则=${config.exclude.length} 条，跳过未修改=${config.skipUnchanged}，冲突策略=${config.conflictPolicy}，重试=${config.retryCount}`
    );
    const client = createClient(url);

    connectionState.syncUrl(url);
    // Always probe fresh before an upload so a cached "alive" never masks a
    // session that just expired.
    const probe = await probes.probeFresh(url);
    if (!probe.alive) {
      connectionState.markDisconnected();
      probes.invalidate();
      await offerProbeRecovery(probe);
      return;
    }

    const summary = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '上传到 Kaggle',
        cancellable: true
      },
      async (progress, token): Promise<UploadSummary> => {
        progress.report({ message: '扫描文件…' });
        const collected = await collectSelections(candidates, config, token, log);

        if (token.isCancellationRequested) {
          return {
            total: collected.failures.length + collected.skipped,
            uploaded: 0,
            failed: collected.failures.length,
            skipped: collected.skipped,
            unchanged: 0,
            skippedNewer: 0,
            cancelled: true,
            sessionExpired: false,
            failures: collected.failures
          };
        }

        const planned = planUploads(collected.files, config, log);
        const allFailures = [...collected.failures, ...planned.failures];

        if (planned.plans.length === 0) {
          return {
            total: allFailures.length + collected.skipped,
            uploaded: 0,
            failed: allFailures.length,
            skipped: collected.skipped,
            unchanged: 0,
            skippedNewer: 0,
            cancelled: false,
            sessionExpired: false,
            failures: allFailures
          };
        }

        progress.report({ message: '检查远端文件…' });
        const pre = await preflightUploads(client, planned.plans, config, token, log);
        const baseTotal = planned.plans.length + allFailures.length + collected.skipped;

        if (pre.fatalError) {
          // The session is unusable: every planned file fails, including the
          // ones that preflight had already classified.
          const fatalFailures = planned.plans.map((plan) => ({
            localPath: plan.localPath,
            remotePath: plan.remotePath,
            error: pre.fatalError
          }));
          const failures = [...allFailures, ...fatalFailures];
          return {
            total: allFailures.length + collected.skipped + fatalFailures.length,
            uploaded: 0,
            failed: failures.length,
            skipped: collected.skipped,
            unchanged: 0,
            skippedNewer: 0,
            cancelled: false,
            sessionExpired: pre.sessionExpired,
            failures
          };
        }

        if (pre.cancelled) {
          const failed = allFailures.length + pre.failures.length;
          return {
            total: baseTotal,
            uploaded: 0,
            failed,
            skipped: baseTotal - failed,
            unchanged: pre.unchanged.length,
            skippedNewer: pre.remoteNewer.length,
            cancelled: true,
            sessionExpired: false,
            failures: [...allFailures, ...pre.failures]
          };
        }

        let uploads: PlannedFile[] = pre.uploads;
        let skippedNewer = 0;

        if (pre.remoteNewer.length > 0) {
          if (config.conflictPolicy === 'skipNewer') {
            skippedNewer = pre.remoteNewer.length;
            log(`跳过 ${skippedNewer} 个远端较新的文件（冲突策略：skipNewer）。`);
          } else if (config.conflictPolicy === 'ask') {
            const decision = await confirmRemoteNewer(pre.remoteNewer);
            if (decision === 'cancel') {
              const failed = allFailures.length + pre.failures.length;
              return {
                total: baseTotal,
                uploaded: 0,
                failed,
                skipped: baseTotal - failed,
                unchanged: pre.unchanged.length,
                skippedNewer: 0,
                cancelled: true,
                sessionExpired: false,
                failures: [...allFailures, ...pre.failures]
              };
            }
            if (decision === 'skip') {
              skippedNewer = pre.remoteNewer.length;
              log(`跳过 ${skippedNewer} 个远端较新的文件（用户选择）。`);
            } else {
              log(`用户选择覆盖 ${pre.remoteNewer.length} 个远端较新的文件。`);
              uploads = uploads.concat(pre.remoteNewer);
            }
          } else {
            uploads = uploads.concat(pre.remoteNewer);
          }
        }

        if (uploads.length === 0) {
          const failed = allFailures.length + pre.failures.length;
          return {
            total: baseTotal,
            uploaded: 0,
            failed,
            skipped: baseTotal - failed,
            unchanged: pre.unchanged.length,
            skippedNewer,
            cancelled: false,
            sessionExpired: false,
            failures: [...allFailures, ...pre.failures]
          };
        }

        const result = await executeUpload(
          client,
          uploads,
          [...allFailures, ...pre.failures],
          config,
          progress,
          token,
          log
        );

        return {
          ...result,
          total: result.total + collected.skipped + pre.unchanged.length + skippedNewer,
          skipped: result.skipped + collected.skipped + pre.unchanged.length + skippedNewer,
          unchanged: pre.unchanged.length,
          skippedNewer
        };
      }
    );

    await notifySummary(summary, remoteDir);

    if (summary.sessionExpired) {
      connectionState.markDisconnected();
      probes.invalidate();
    }

    if (summary.uploaded > 0) {
      void workingDirSync.onRemoteDirCreated();
      void workspaceView.refreshContents();
    }
  }

  async function syncKernelWorkingDir(): Promise<void> {
    const url = await context.secrets.get(SECRET_KEY);
    if (!url) {
      await promptForUrl();
      return;
    }

    const remoteDir = getRemoteDir();
    if (!remoteDir) {
      await promptForRemoteDir();
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '同步远端内核工作目录',
        cancellable: false
      },
      async () => {
        connectionState.syncUrl(url);
        const probe = await probes.probeFresh(url);
        if (!probe.alive) {
          connectionState.markDisconnected();
          probes.invalidate();
          await offerProbeRecovery(probe);
          return;
        }
        if (!getAutoCdRemoteDir()) {
          void vscode.window.showWarningMessage(
            '已关闭 “自动切换远端内核工作目录 (kaggleConnector.autoCdRemoteDir)”。如需同步，请先在设置中启用。'
          );
          return;
        }
        const result = await workingDirSync.sync({ force: true });
        if (!result) {
          const choice = await vscode.window.showErrorMessage(
            '同步远端内核工作目录失败。',
            '查看日志'
          );
          if (choice === '查看日志') {
            output.show();
          }
          return;
        }
        const target = result.projPath || remoteDir;
        if (!result.dirExists) {
          vscode.window.setStatusBarMessage(
            `$(check) 已配置内核启动目录 ${target}（远端目录尚未创建，上传后自动生效）`,
            5000
          );
          return;
        }
        vscode.window.setStatusBarMessage(
          `$(check) 内核工作目录已同步：${target}`,
          4000
        );
      }
    );
  }

  async function uploadCurrent(): Promise<void> {
    const active = vscode.window.activeTextEditor?.document.uri;
    if (!active || active.scheme !== 'file') {
      void vscode.window.showWarningMessage('当前没有可上传的本地文件。');
      return;
    }
    await upload(active, [active]);
  }

  async function promptForUrl(): Promise<void> {
    const choice = await vscode.window.showErrorMessage('尚未设置 Kaggle Jupyter URL。', '设置 URL');
    if (choice === '设置 URL') {
      await setServerUrl();
      await vscode.commands.executeCommand('kaggleConnector.connection.focus');
    }
  }

  async function promptForRemoteDir(): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      '尚未设置工作目录 (REMOTE_DIR)。',
      '设置目录'
    );
    if (choice === '设置目录') {
      await setRemoteDirCommand();
      await vscode.commands.executeCommand('kaggleConnector.connection.focus');
    }
  }

  async function offerSessionRecovery(error: unknown): Promise<boolean> {
    if (!isSessionError(error)) {
      return false;
    }

    const choice = await vscode.window.showErrorMessage(
      `Kaggle 会话可能已过期：${shortError(error)}`,
      '更新 Jupyter URL',
      '查看日志'
    );
    if (choice === '更新 Jupyter URL') {
      await setServerUrl();
      await vscode.commands.executeCommand('kaggleConnector.connection.focus');
    } else if (choice === '查看日志') {
      output.show();
    }
    return true;
  }

  /**
   * Recovery prompt for a failed session probe. "Likely expired" (auth /
   * redirect / nonJson / proxy-404 / probe timeout) offers a URL update;
   * pure network problems do not, since a new URL would not help.
   */
  async function offerProbeRecovery(probe: SessionProbeResult): Promise<void> {
    const error = probe.error;
    if (!error) {
      return;
    }
    logError(error);
    if (probe.likelyExpired) {
      const choice = await vscode.window.showErrorMessage(
        `Kaggle 会话可能已失效：${shortError(error)}`,
        '更新 Jupyter URL',
        '查看日志'
      );
      if (choice === '更新 Jupyter URL') {
        await setServerUrl();
        await vscode.commands.executeCommand('kaggleConnector.connection.focus');
      } else if (choice === '查看日志') {
        output.show();
      }
      return;
    }
    const choice = await vscode.window.showErrorMessage(
      `连接失败：${shortError(error)}`,
      '查看日志'
    );
    if (choice === '查看日志') {
      output.show();
    }
  }

  async function notifySummary(summary: UploadSummary, remoteDir: string): Promise<void> {
    log(
      `结果：总计 ${summary.total}，成功 ${summary.uploaded}，失败 ${summary.failed}，跳过 ${summary.skipped}（未修改 ${summary.unchanged}，远端较新 ${summary.skippedNewer}），取消=${summary.cancelled}，会话过期=${summary.sessionExpired}`
    );

    if (summary.sessionExpired) {
      const choice = await vscode.window.showErrorMessage(
        `上传中断：Kaggle 会话可能已过期。成功 ${summary.uploaded}，失败 ${summary.failed}，跳过 ${summary.skipped}。`,
        '更新 Jupyter URL',
        '查看日志'
      );
      if (choice === '更新 Jupyter URL') {
        await setServerUrl();
        await vscode.commands.executeCommand('kaggleConnector.connection.focus');
      } else if (choice === '查看日志') {
        output.show();
      }
      return;
    }

    if (summary.cancelled) {
      const choice = await vscode.window.showWarningMessage(
        `已取消上传：成功 ${summary.uploaded}，失败 ${summary.failed}，跳过 ${summary.skipped}。`,
        '查看日志'
      );
      if (choice === '查看日志') {
        output.show();
      }
      return;
    }

    if (summary.failed === 0) {
      const skipDetails: string[] = [];
      if (summary.unchanged > 0) {
        skipDetails.push(`${summary.unchanged} 个未修改`);
      }
      if (summary.skippedNewer > 0) {
        skipDetails.push(`${summary.skippedNewer} 个远端较新`);
      }
      const otherSkipped = Math.max(
        0,
        summary.skipped - summary.unchanged - summary.skippedNewer
      );
      if (otherSkipped > 0) {
        skipDetails.push(`${otherSkipped} 个被排除/符号链接`);
      }
      const skippedText = skipDetails.length ? `；跳过 ${skipDetails.join('、')}` : '';

      if (summary.uploaded === 0) {
        vscode.window.setStatusBarMessage(
          `没有需要上传的文件：${skipDetails.length ? skipDetails.join('，') : '0 个文件'}`,
          5000
        );
        return;
      }

      vscode.window.setStatusBarMessage(
        `$(check) 已上传 ${summary.uploaded} 个文件到 “${remoteDir}”${skippedText}`,
        6000
      );
      return;
    }

    const details = summary.failures.slice(0, 3).map((failure) => {
      const target = failure.remotePath ?? failure.localPath;
      const message = shortError(failure.error);
      return `${target}: ${message.length > 160 ? `${message.slice(0, 160)}…` : message}`;
    });
    const choice = await vscode.window.showWarningMessage(
      `上传完成：成功 ${summary.uploaded}，失败 ${summary.failed}，跳过 ${summary.skipped}。\n${details.join('\n')}`,
      '查看日志'
    );
    if (choice === '查看日志') {
      output.show();
    }
  }
}

async function confirmRemoteNewer(
  files: readonly PlannedFile[]
): Promise<'overwrite' | 'skip' | 'cancel'> {
  const names = files.slice(0, 5).map((file) => file.remotePath);
  const detail =
    files.length > 5
      ? `${names.join('\n')}\n… 另有 ${files.length - 5} 个`
      : names.join('\n');
  const choice = await vscode.window.showWarningMessage(
    `${files.length} 个远端文件比本地新，继续上传会覆盖 Kaggle 上的改动。`,
    { modal: true, detail },
    '覆盖并上传',
    '跳过这些文件',
    '取消上传'
  );
  if (choice === '覆盖并上传') {
    return 'overwrite';
  }
  if (choice === '跳过这些文件') {
    return 'skip';
  }
  return 'cancel';
}

function log(message: string): void {
  output.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function logError(error: unknown): void {
  output.appendLine(`[${new Date().toISOString()}] [ERROR] ${describeError(error)}`);
  if (error instanceof Error && error.stack) {
    output.appendLine(error.stack);
  }
}

export function deactivate(): Thenable<void> | undefined {
  // Best effort: push any debounced content before the extension host exits.
  return remoteFileSystem?.flushAll().catch(() => undefined);
}
