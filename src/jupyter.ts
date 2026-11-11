import * as vscode from 'vscode';
import { shortError } from './core/errors';
import { jupyterConnectionParts, jupyterServerId } from './core/url';
import { versionAtLeast } from './core/version';

export const JUPYTER_EXTENSION_ID = 'ms-toolsai.jupyter';
export const SERVER_COLLECTION_ID = 'kaggle-connector';
export const SERVER_COLLECTION_LABEL = 'Kaggle Connector';
export const SERVER_ID_PREFIX = 'kaggle-';
export const SERVER_LABEL_PREFIX = 'Kaggle Jupyter Server';

/**
 * Minimal structural subset of `@vscode/jupyter-extension@1.0.93`. That
 * package is types-only; declaring the handful of members we use avoids an
 * extra dependency. Jupyter infers the contributing extension from the call
 * stack, so `createJupyterServerCollection` must be invoked directly from this
 * extension's bundled code.
 */
interface JupyterServerConnectionInformation {
  readonly baseUrl: vscode.Uri;
  readonly token?: string;
  readonly headers?: Record<string, string>;
}

interface JupyterServer {
  readonly id: string;
  readonly label: string;
  readonly connectionInformation?: JupyterServerConnectionInformation;
}

interface JupyterServerProvider {
  readonly onDidChangeServers?: vscode.Event<void>;
  provideJupyterServers(token: vscode.CancellationToken): vscode.ProviderResult<JupyterServer[]>;
  resolveJupyterServer(
    server: JupyterServer,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<JupyterServer>;
}

interface JupyterServerCollection extends vscode.Disposable {
  readonly id: string;
  label: string;
  documentation?: vscode.Uri;
}

interface JupyterApi {
  createJupyterServerCollection(
    id: string,
    label: string,
    serverProvider: JupyterServerProvider
  ): JupyterServerCollection;
}

export interface KaggleJupyterServersOptions {
  /** Lazily read the persisted Jupyter URL (SecretStorage). */
  loadUrl: () => Promise<string>;
  log: (message: string) => void;
}

/**
 * Exposes the saved Kaggle Jupyter session as a Jupyter kernel source, so it
 * appears in VS Code's kernel picker (Colab-style). Soft dependency: the
 * Jupyter extension is only activated once a URL exists and the feature is
 * actually needed; uploads never depend on it.
 *
 * Each URL derives a deterministic server id (`core/url.jupyterServerId`).
 * Jupyter caches `UniversalRemoteKernelFinder` keyed strictly by `(extensionId, collectionId, server.id)`
 * ignoring baseUrl, and `controllerRegistration.updateConnection` only updates the label
 * without refreshing `kernelConnection` (baseUrl). Therefore, `server.id` must change whenever
 * the session URL changes, ensuring a fresh finder and controller are created.
 */
export class KaggleJupyterServers implements vscode.Disposable, JupyterServerProvider {
  private readonly changes = new vscode.EventEmitter<void>();
  readonly onDidChangeServers = this.changes.event;

  /** Normalized URL; undefined until first read from SecretStorage. */
  private url: string | undefined;
  private urlLoad?: Promise<string>;
  private collection?: JupyterServerCollection;
  private registering?: Promise<void>;
  private wantsRegistration = false;
  private promptOffered = false;
  private installWatcher?: vscode.Disposable;
  private disposed = false;

  constructor(private readonly options: KaggleJupyterServersOptions) {}

  /** Update the cached URL on every persisted URL change. */
  setUrl(url: string): void {
    if (this.disposed) {
      return;
    }
    const next = (url ?? '').trim();
    if (next === this.url) {
      return;
    }
    this.url = next;
    if (this.collection) {
      this.changes.fire();
    }
  }

  provideJupyterServers(_token: vscode.CancellationToken): JupyterServer[] {
    const server = this.currentServer();
    return server ? [server] : [];
  }

  resolveJupyterServer(
    server: JupyterServer,
    _token: vscode.CancellationToken
  ): JupyterServer {
    // Jupyter calls this with a placeholder or historical server when the
    // list changes or is empty. Returning it unchanged prevents a cleared or
    // superseded session from being resurrected.
    const current = this.currentServer();
    if (!current || server.id !== current.id) {
      return server;
    }
    return current;
  }

  /**
   * Register the server collection with the Jupyter extension. Safe to call
   * repeatedly; concurrent and repeated calls share one attempt.
   */
  async ensureRegistered(options: { promptIfMissing?: boolean } = {}): Promise<void> {
    if (this.disposed || this.collection) {
      return;
    }
    if (options.promptIfMissing) {
      this.wantsRegistration = true;
    }
    if (this.registering) {
      await this.registering;
      return;
    }

    const task = this.registerOnce(Boolean(options.promptIfMissing));
    this.registering = task;
    try {
      await task;
    } finally {
      if (this.registering === task) {
        this.registering = undefined;
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.installWatcher?.dispose();
    this.installWatcher = undefined;
    try {
      this.collection?.dispose();
    } catch {
      // Jupyter may already be shutting down.
    }
    this.collection = undefined;
    this.changes.dispose();
  }

  private async registerOnce(promptIfMissing: boolean): Promise<void> {
    const url = await this.ensureUrl();
    if (!url || this.disposed || this.collection) {
      return;
    }
    await this.register(promptIfMissing);
  }

  private currentServer(): JupyterServer | undefined {
    if (!this.url) {
      return undefined;
    }
    try {
      const parts = jupyterConnectionParts(this.url);
      const id = jupyterServerId(parts);
      const label = `${SERVER_LABEL_PREFIX} (${id.slice(-6)})`;
      const connectionInformation: JupyterServerConnectionInformation = parts.token
        ? { baseUrl: vscode.Uri.parse(parts.baseUrl), token: parts.token }
        : { baseUrl: vscode.Uri.parse(parts.baseUrl) };
      return {
        id,
        label,
        connectionInformation
      };
    } catch (error) {
      this.options.log(`无法解析 Jupyter URL: ${shortError(error)}`);
      return undefined;
    }
  }

  /**
   * First use lazily seeds the URL from SecretStorage. A `setUrl` that lands
   * while that read is in flight wins (Save happened after the read started).
   */
  private async ensureUrl(): Promise<string> {
    if (this.url !== undefined) {
      return this.url;
    }
    if (!this.urlLoad) {
      this.urlLoad = this.options
        .loadUrl()
        .then((url) => {
          if (this.url === undefined) {
            this.url = (url ?? '').trim();
          }
          return this.url;
        })
        .catch((error) => {
          this.options.log(`读取 Jupyter URL 失败: ${shortError(error)}`);
          return '';
        });
    }
    return this.urlLoad;
  }

  private async register(promptIfMissing: boolean): Promise<void> {
    const extension = vscode.extensions.getExtension<JupyterApi>(JUPYTER_EXTENSION_ID);
    if (!extension) {
      if (promptIfMissing) {
        await this.offerInstallPrompt();
      }
      this.watchForInstall();
      return;
    }

    const version = String((extension.packageJSON as { version?: unknown }).version ?? '');
    if (!versionAtLeast(version, 2025, 0)) {
      if (promptIfMissing) {
        await this.offerVersionPrompt(version);
      }
      this.watchForInstall();
      return;
    }

    let api: JupyterApi;
    try {
      api = extension.isActive ? extension.exports : await extension.activate();
    } catch (error) {
      this.options.log(`激活 Jupyter 扩展失败: ${shortError(error)}`);
      this.watchForInstall();
      return;
    }
    if (this.disposed || this.collection) {
      return;
    }

    try {
      // Direct call from our own extension code: Jupyter infers the caller
      // extension id from the call stack.
      this.collection = api.createJupyterServerCollection(
        SERVER_COLLECTION_ID,
        SERVER_COLLECTION_LABEL,
        this
      );
      this.installWatcher?.dispose();
      this.installWatcher = undefined;
      this.options.log('已注册 Jupyter 内核来源 “Kaggle Connector”。');
    } catch (error) {
      this.options.log(`注册 Jupyter 内核来源失败: ${shortError(error)}`);
      this.watchForInstall();
    }
  }

  /** Retry silently once Jupyter is installed/enabled/updated. */
  private watchForInstall(): void {
    if (this.installWatcher || this.disposed) {
      return;
    }
    this.installWatcher = vscode.extensions.onDidChange(() => {
      if (!this.wantsRegistration || this.collection || this.disposed) {
        return;
      }
      void this.ensureRegistered().catch((error) => {
        this.options.log(`注册 Jupyter 内核来源失败: ${shortError(error)}`);
      });
    });
  }

  private async offerInstallPrompt(): Promise<void> {
    if (this.promptOffered) {
      return;
    }
    this.promptOffered = true;
    const install = '安装 Jupyter 扩展';
    const choice = await vscode.window.showInformationMessage(
      '已保存 Kaggle Jupyter URL。安装 Jupyter 扩展后可在 Notebook 内核选择器中选择 “Kaggle Connector → Kaggle Jupyter Server”；不安装不影响上传。',
      install
    );
    if (choice === install) {
      await vscode.commands.executeCommand(
        'workbench.extensions.installExtension',
        JUPYTER_EXTENSION_ID
      );
    }
  }

  private async offerVersionPrompt(version: string): Promise<void> {
    if (this.promptOffered) {
      return;
    }
    this.promptOffered = true;
    const view = '查看扩展';
    const choice = await vscode.window.showWarningMessage(
      `Jupyter 扩展版本过低（当前 ${version || '未知'}，需要 2025.0.0 或更高），暂时无法注册 Kaggle 内核来源。`,
      view
    );
    if (choice === view) {
      await vscode.commands.executeCommand(
        'workbench.extensions.search',
        `@id:${JUPYTER_EXTENSION_ID}`
      );
    }
  }
}
