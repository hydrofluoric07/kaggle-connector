import type { JupyterClient } from './client';
import type { ConnectionState } from './core/connectionState';
import { isSessionError, shortError } from './core/errors';
import type { ConfigureWorkingDirResult } from './core/remoteCwd';
import { normalizeRemotePath } from './core/url';

export interface WorkingDirSyncOptions {
  clientFactory: (serverUrl: string) => JupyterClient;
  loadUrl: () => Promise<string>;
  getRemoteDir: () => string;
  isEnabled: () => boolean;
  state: ConnectionState;
  log: (message: string) => void;
}

export interface SyncWorkingDirOptions {
  force?: boolean;
  onlyExistingIdle?: boolean;
}

/**
 * Coordinates synchronizing the remote Kaggle kernel working directory
 * (startup script + running idle kernels) with REMOTE_DIR when connected.
 *
 * Pure TypeScript without vscode imports so it can be unit tested.
 */
export class WorkingDirSyncManager {
  private lastSyncedKey: string | undefined;
  private lastDirExisted: boolean | undefined;
  private hasConfiguredStartup = false;
  private inFlight: Promise<ConfigureWorkingDirResult | undefined> | undefined;
  private pendingOptions: SyncWorkingDirOptions | undefined;
  private disposed = false;

  constructor(private readonly options: WorkingDirSyncOptions) {}

  /**
   * Synchronize remote kernel working directory configuration.
   * Concurrent calls coalesce; if options arrive mid-flight, one follow-up
   * run executes after the current one finishes.
   */
  async sync(syncOptions: SyncWorkingDirOptions = {}): Promise<ConfigureWorkingDirResult | undefined> {
    if (this.disposed) {
      return undefined;
    }

    if (this.inFlight) {
      this.pendingOptions = mergeSyncOptions(this.pendingOptions, syncOptions);
      await this.inFlight;
      if (this.pendingOptions && !this.disposed) {
        const next = this.pendingOptions;
        this.pendingOptions = undefined;
        return this.sync(next);
      }
      return undefined;
    }

    const task = this.runOnce(syncOptions).finally(() => {
      if (this.inFlight === task) {
        this.inFlight = undefined;
      }
    });
    this.inFlight = task;
    const result = await task;

    if (this.pendingOptions && !this.disposed) {
      const next = this.pendingOptions;
      this.pendingOptions = undefined;
      return this.sync(next);
    }
    return result;
  }

  /**
   * Called after an upload or remote directory creation succeeds. If the
   * working directory did not exist when we first configured the startup
   * script, switch any currently idle kernels into it without spinning up a
   * temporary helper kernel.
   */
  async onRemoteDirCreated(): Promise<ConfigureWorkingDirResult | undefined> {
    if (this.disposed || !this.options.state.connected || !this.options.isEnabled()) {
      return undefined;
    }
    if (this.lastDirExisted !== false) {
      return undefined;
    }
    const result = await this.sync({ force: true, onlyExistingIdle: true });
    this.lastDirExisted = true;
    return result;
  }

  /** Clear cached sync state (e.g. when the URL is cleared or disconnected). */
  reset(): void {
    this.lastSyncedKey = undefined;
    this.lastDirExisted = undefined;
    this.hasConfiguredStartup = false;
    this.pendingOptions = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
  }

  private async runOnce(
    syncOptions: SyncWorkingDirOptions
  ): Promise<ConfigureWorkingDirResult | undefined> {
    if (!this.options.state.connected) {
      return undefined;
    }

    const url = (await this.options.loadUrl())?.trim();
    if (!url || !this.options.state.connected || this.disposed) {
      return undefined;
    }

    const enabled = this.options.isEnabled();
    let remoteDir = '';
    try {
      remoteDir = normalizeRemotePath(this.options.getRemoteDir());
    } catch {
      return undefined;
    }

    if (enabled && !remoteDir) {
      return undefined;
    }

    if (!enabled && !this.hasConfiguredStartup && !syncOptions.force) {
      return undefined;
    }

    const key = `${url}\0${enabled ? remoteDir : ''}\0${enabled ? '1' : '0'}`;
    if (!syncOptions.force && this.lastSyncedKey === key) {
      return undefined;
    }

    const client = this.options.clientFactory(url);
    try {
      const result = await client.configureKernelWorkingDir(remoteDir, {
        enabled,
        onlyExistingIdle: syncOptions.onlyExistingIdle
      });

      if (this.disposed) {
        return result;
      }

      if (!enabled) {
        this.lastSyncedKey = key;
        this.hasConfiguredStartup = false;
        this.lastDirExisted = undefined;
        if (result.startupConfigured === false && result.startupPath) {
          this.options.log('[工作目录] 已关闭自动切换并清理远端内核启动脚本');
        }
        return result;
      }

      if (result.startupConfigured) {
        this.lastSyncedKey = key;
        this.hasConfiguredStartup = true;
        this.lastDirExisted = result.dirExists;
      }

      this.logSuccess(remoteDir, result);
      return result;
    } catch (error) {
      if (isSessionError(error)) {
        this.options.state.markDisconnected();
        this.reset();
      }
      this.options.log(`[工作目录] 同步远端内核目录失败: ${shortError(error)}`);
      return undefined;
    } finally {
      await client.dispose();
    }
  }

  private logSuccess(remoteDir: string, result: ConfigureWorkingDirResult): void {
    const targetLabel = result.projPath || remoteDir;
    if (!result.startupConfigured && result.updatedKernels === 0) {
      if (result.skippedBusyKernels > 0) {
        this.options.log(
          `[工作目录] 当前 ${result.skippedBusyKernels} 个内核正在运行，暂未同步到 ${targetLabel}`
        );
      }
      return;
    }

    const details: string[] = [];
    if (result.updatedKernels > 0) {
      details.push(`已切换 ${result.updatedKernels} 个运行中内核`);
    }
    if (result.skippedBusyKernels > 0) {
      details.push(`跳过 ${result.skippedBusyKernels} 个繁忙内核`);
    }
    if (!result.dirExists) {
      details.push(`目录 "${remoteDir}" 尚未创建，上传后将自动生效`);
    }
    const suffix = details.length > 0 ? `（${details.join('，')}）` : '';
    this.options.log(`[工作目录] 已配置内核自动进入 ${targetLabel}${suffix}`);
  }
}

function mergeSyncOptions(
  current: SyncWorkingDirOptions | undefined,
  incoming: SyncWorkingDirOptions
): SyncWorkingDirOptions {
  if (!current) {
    return { ...incoming };
  }
  return {
    force: Boolean(current.force || incoming.force),
    onlyExistingIdle: Boolean(current.onlyExistingIdle && incoming.onlyExistingIdle)
  };
}
