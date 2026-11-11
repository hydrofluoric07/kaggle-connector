import type { JupyterClient } from './client';
import type { ConnectionState } from './core/connectionState';
import { shortError } from './core/errors';

export interface KeepAliveManagerOptions {
  clientFactory: (serverUrl: string) => JupyterClient;
  loadUrl: () => Promise<string>;
  isEnabled: () => boolean;
  getIntervalMs: () => number;
  getDeadlineMs: () => number;
  state: ConnectionState;
  log: (message: string) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimer?: (timer: NodeJS.Timeout) => void;
}

/**
 * Background keep-alive service for Kaggle Jupyter sessions.
 * Sends lightweight GET /api/kernels (or /api/status) requests at a configured
 * interval (default 10 minutes) when connected to keep the server's
 * last_activity timestamp updated and prevent Kaggle from reclaiming the session.
 *
 * Pure TypeScript without vscode imports so it can be fully unit tested.
 */
export class KeepAliveManager {
  private timer?: NodeJS.Timeout | ReturnType<typeof setTimeout>;
  private inFlight = false;
  private disposed = false;
  private lastPingAt?: number;

  constructor(private readonly options: KeepAliveManagerOptions) {}

  /**
   * Synchronize the keep-alive timer with current connection state & settings.
   * Starts or keeps the timer if enabled and connected; stops it otherwise.
   */
  sync(): void {
    if (this.disposed) {
      return;
    }
    if (!this.options.isEnabled() || !this.options.state.connected) {
      this.clearScheduledTimer();
      return;
    }
    if (!this.timer) {
      this.scheduleNext();
    }
  }

  /**
   * Immediately trigger a keep-alive ping.
   * Returns true if the ping succeeded, false if skipped or failed.
   */
  async triggerNow(): Promise<boolean> {
    if (this.disposed || !this.options.isEnabled() || !this.options.state.connected) {
      return false;
    }
    if (this.inFlight) {
      return false;
    }

    this.inFlight = true;
    try {
      const url = (await this.options.loadUrl())?.trim();
      if (!url || !this.options.state.connected || this.disposed) {
        return false;
      }

      const client = this.options.clientFactory(url);
      const result = await client.keepAlive(this.options.getDeadlineMs());

      if (result.alive) {
        this.lastPingAt = this.now();
        const timeStr = new Date(this.lastPingAt).toTimeString().slice(0, 8);
        this.options.log(`[保活] Kaggle 会话活跃时间已刷新 (${timeStr})`);
        return true;
      }

      if (result.likelyExpired) {
        this.options.log(
          `[保活] Kaggle 会话已失效，已暂停保活: ${
            result.error ? shortError(result.error) : '会话已过期'
          }`
        );
        this.options.state.markDisconnected();
        this.clearScheduledTimer();
      } else {
        this.options.log(
          `[保活] 保活请求异常: ${result.error ? shortError(result.error) : '网络错误'}`
        );
      }
      return false;
    } catch (error) {
      this.options.log(`[保活] 保活执行异常: ${shortError(error)}`);
      return false;
    } finally {
      this.inFlight = false;
      if (this.options.state.connected && this.options.isEnabled() && !this.disposed) {
        this.scheduleNext();
      }
    }
  }

  /** Timestamp of the last successful keep-alive ping in epoch ms. */
  getLastPingAt(): number | undefined {
    return this.lastPingAt;
  }

  /** Whether a keep-alive timer is currently active. */
  isScheduled(): boolean {
    return this.timer !== undefined;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearScheduledTimer();
  }

  private scheduleNext(): void {
    this.clearScheduledTimer();
    if (this.disposed || !this.options.isEnabled() || !this.options.state.connected) {
      return;
    }
    const intervalMs = Math.max(1000, this.options.getIntervalMs());
    const setter = this.options.setTimer ?? setTimeout;
    this.timer = setter(() => {
      this.timer = undefined;
      void this.triggerNow();
    }, intervalMs);
  }

  private clearScheduledTimer(): void {
    if (this.timer) {
      const clearer = this.options.clearTimer ?? clearTimeout;
      clearer(this.timer as NodeJS.Timeout);
      this.timer = undefined;
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }
}
