import * as vscode from 'vscode';
import { JupyterClient } from './client';
import {
  getPathMode,
  getProbeTimeoutMs,
  getRemoteDir,
  SECRET_KEY,
  setPathMode,
  setRemoteDir
} from './config';
import type { ConnectionState } from './core/connectionState';
import {
  describeError,
  isConnectionError,
  KaggleError,
  shortError
} from './core/errors';
import type { PathMode } from './core/paths';
import { normalizeRemotePath, normalizeServerUrl } from './core/url';
import type { ProbeCoordinator } from './probe';

interface ViewState {
  url: string;
  remoteDir: string;
  pathMode: PathMode;
  hasUrl: boolean;
}

interface SaveMessage {
  type: 'save' | 'test';
  url?: string;
  remoteDir?: string;
  pathMode?: string;
}

interface ClearMessage {
  type: 'clearUrl';
}

interface ReadyMessage {
  type: 'ready';
}

interface AutosaveMessage {
  type: 'autosave';
  url?: string;
  remoteDir?: string;
  pathMode?: string;
}

type IncomingMessage =
  | SaveMessage
  | ClearMessage
  | ReadyMessage
  | AutosaveMessage;

export class ConnectionViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'kaggleConnector.connection';

  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    private readonly clientFactory: (serverUrl: string) => JupyterClient,
    private readonly onChanged: () => void,
    /** Notified whenever the persisted URL changes; `explicit` marks Save/Test/Clear. */
    private readonly onUrlChange: (url: string, explicit: boolean) => void,
    private readonly log: (message: string) => void,
    private readonly connectionState: ConnectionState,
    private readonly probes: ProbeCoordinator,
    private readonly onWorkingDirSync?: (options?: { force?: boolean }) => void
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    // Register the listener before loading HTML so the webview's initial
    // "ready" message cannot race with provider setup.
    view.webview.onDidReceiveMessage((message: IncomingMessage) => {
      void this.handleMessage(message);
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
      }
    });
    view.webview.html = this.html(view.webview);
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    await this.post({
      type: 'state',
      state: await this.state()
    });
  }

  private async state(): Promise<ViewState> {
    const url = (await this.context.secrets.get(SECRET_KEY)) ?? '';
    return {
      url,
      remoteDir: getRemoteDir(),
      pathMode: getPathMode(),
      hasUrl: Boolean(url)
    };
  }

  private async handleMessage(message: IncomingMessage): Promise<void> {
    try {
      if (message.type === 'ready') {
        await this.refresh();
        return;
      }

      if (message.type === 'autosave') {
        await this.autosave(message);
        return;
      }

      if (message.type === 'clearUrl') {
        await this.context.secrets.delete(SECRET_KEY);
        this.connectionState.syncUrl('');
        this.probes.invalidate();
        this.onUrlChange('', true);
        this.onChanged();
        await this.refresh();
        this.postStatus('info', '已清除 Jupyter URL');
        return;
      }

      const url = normalizeServerUrl(message.url ?? '');
      const remoteDir = normalizeRemotePath(message.remoteDir ?? '');
      if (!remoteDir) {
        throw new KaggleError('badRequest', '工作目录不能为空', {
          hint: '填写一个可写目录，例如 news_recommender；Kaggle 上实际位于 /kaggle/working。'
        });
      }

      if (message.type === 'save') {
        const pathMode: PathMode =
          message.pathMode === 'basename' ? 'basename' : 'workspaceRelative';
        await this.context.secrets.store(SECRET_KEY, url);
        this.connectionState.syncUrl(url);
        this.probes.invalidate();
        this.onUrlChange(url, true);
        await setRemoteDir(remoteDir);
        await setPathMode(pathMode);
        this.onChanged();
        await this.refresh();
        const probe = await this.probes.probe(url);
        if (probe.alive) {
          this.onWorkingDirSync?.({ force: true });
        }
        this.postStatus(
          'success',
          '已保存。URL 存放在 VS Code SecretStorage，不会写入 settings.json。'
        );
        return;
      }

      if (message.type === 'test') {
        const client = this.clientFactory(url);
        // A test may target an unsaved draft; only a probe of the persisted
        // URL is allowed to flip the global connection state.
        const persistedUrl = (await this.context.secrets.get(SECRET_KEY)) ?? '';
        const probe =
          persistedUrl === url
            ? await this.probes.probeFresh(url)
            : await client.probeSession(getProbeTimeoutMs());
        if (!probe.alive) {
          this.postStatus('error', shortError(probe.error));
          return;
        }
        if (persistedUrl === url) {
          // A successful test of the saved URL is an explicit intent to use
          // this session, just like Save.
          this.onUrlChange(url, true);
          this.onWorkingDirSync?.({ force: true });
        }
        let result = await client.test(remoteDir);
        if (!result.exists && persistedUrl === url && remoteDir) {
          await client.ensureDirectories([remoteDir]);
          this.log(`远端工作目录不存在，已自动创建并进入: ${remoteDir}`);
          result = await client.test(remoteDir);
          this.onChanged();
        }
        if (!result.exists) {
          this.postStatus(
            'warning',
            `连接成功，但工作目录 “${result.path}” 尚不存在，保存或上传时会自动创建。`
          );
        } else if (result.writable === false) {
          this.postStatus(
            'warning',
            `连接成功，但目录 “${result.path}” 不可写（Kaggle 只能写 /kaggle/working）。`
          );
        } else {
          this.postStatus(
            'success',
            `连接成功：${result.path || 'Jupyter 根目录'}${result.writable === true ? '（可写）' : ''}`
          );
        }
      }
    } catch (error) {
      if (isConnectionError(error)) {
        this.connectionState.markDisconnected();
        this.probes.invalidate();
      }
      if (error instanceof KaggleError && error.kind === 'cancelled') {
        this.postStatus('info', '已取消');
        return;
      }
      this.log(`操作失败: ${describeError(error)}`);
      this.postStatus('error', shortError(error));
    }
  }

  /**
   * Persist committed field values without resetting the form. This makes
   * valid values survive a VS Code restart even if the user never pressed
   * "保存". Invalid/partial input is ignored.
   */
  private async autosave(message: AutosaveMessage): Promise<void> {
    try {
      const url = normalizeServerUrl(message.url ?? '');
      const remoteDir = normalizeRemotePath(message.remoteDir ?? '');
      if (!remoteDir) {
        return;
      }
      const pathMode: PathMode =
        message.pathMode === 'basename' ? 'basename' : 'workspaceRelative';

      const currentUrl = (await this.context.secrets.get(SECRET_KEY)) ?? '';
      const currentDir = getRemoteDir();
      const currentMode = getPathMode();
      let changed = false;

      if (currentUrl !== url) {
        await this.context.secrets.store(SECRET_KEY, url);
        this.connectionState.syncUrl(url);
        this.probes.invalidate();
        this.onUrlChange(url, false);
        changed = true;
      }
      if (currentDir !== remoteDir) {
        await setRemoteDir(remoteDir);
        changed = true;
      }
      if (currentMode !== pathMode) {
        await setPathMode(pathMode);
        changed = true;
      }

      if (changed) {
        this.onChanged();
      }
    } catch {
      // Ignore drafts that are not valid yet; the explicit Save button
      // still reports validation errors.
    }
  }

  private postStatus(kind: 'success' | 'warning' | 'error' | 'info', message: string): void {
    void this.post({ type: 'status', kind, message });
  }

  private async post(message: unknown): Promise<void> {
    await this.view?.webview.postMessage(message);
  }

  private html(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.js')
    );
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Kaggle Connector</title>
</head>
<body>
  <div id="app" class="app">
    <section id="settingsPane" class="settings-pane" aria-label="连接设置">
      <div class="settings-scroll">
        <div id="settingsBody" class="settings-body">
          <div class="label-row">
            <label for="url">Jupyter URL</label>
            <button class="info-button" type="button" data-help="url" aria-label="Jupyter URL 说明" aria-expanded="false" title="查看说明">
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.15 6.3c0-1.15.85-1.95 1.9-1.95s1.9.8 1.9 1.9c0 1.5-1.9 1.6-1.9 3.05" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.05" cy="11.3" r="0.95" fill="currentColor"/></svg>
            </button>
          </div>
          <div class="row">
            <input id="url" type="password" autocomplete="off" spellcheck="false"
              placeholder="https://kkb-production.jupyter-proxy.kaggle.net/k/.../proxy">
            <button id="toggle" class="secondary" type="button">显示</button>
          </div>

          <div class="label-row">
            <label for="remoteDir">工作目录</label>
            <button class="info-button" type="button" data-help="remoteDir" aria-label="工作目录说明" aria-expanded="false" title="查看说明">
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.15 6.3c0-1.15.85-1.95 1.9-1.95s1.9.8 1.9 1.9c0 1.5-1.9 1.6-1.9 3.05" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.05" cy="11.3" r="0.95" fill="currentColor"/></svg>
            </button>
          </div>
          <input id="remoteDir" type="text" autocomplete="off" spellcheck="false"
            placeholder="例如 news_recommender">

          <div class="label-row">
            <label for="pathMode">路径策略</label>
            <button class="info-button" type="button" data-help="pathMode" aria-label="路径策略说明" aria-expanded="false" title="查看说明">
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.15 6.3c0-1.15.85-1.95 1.9-1.95s1.9.8 1.9 1.9c0 1.5-1.9 1.6-1.9 3.05" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.05" cy="11.3" r="0.95" fill="currentColor"/></svg>
            </button>
          </div>
          <select id="pathMode">
            <option value="workspaceRelative">保留工作区相对路径</option>
            <option value="basename">仅文件名</option>
          </select>

          <div class="actions">
            <button id="save" type="button">保存</button>
            <button id="test" class="secondary" type="button">测试连接</button>
            <button id="clear" class="secondary hidden" type="button">清除 URL</button>
          </div>

          <div id="status" class="status"></div>
        </div>
        <div id="settingsScrollbar" class="custom-scrollbar" aria-hidden="true">
          <div id="settingsScrollbarThumb" class="custom-scrollbar-thumb"></div>
        </div>
      </div>
    </section>
  </div>

  <div id="helpPopover" class="help-popover hidden" role="tooltip"></div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
