import type { JupyterClient, SessionProbeResult } from './client';
import type { ConnectionState, ProbeTicket } from './core/connectionState';
import { KaggleError, classifyNetworkError } from './core/errors';

/** Successful probes are reused briefly so refreshes stay cheap. */
export const PROBE_CACHE_TTL_MS = 20000;

export interface ProbeCoordinatorOptions {
  clientFactory: (serverUrl: string) => JupyterClient;
  getTimeoutMs: () => number;
  state: ConnectionState;
  now?: () => number;
}

/**
 * Single entry point for session liveness probes. Feeds results into the
 * shared connection state and caches successful probes, so the sidebar,
 * commands and the remote file system all observe the same session status.
 */
export class ProbeCoordinator {
  private cache?: { url: string; at: number; result: SessionProbeResult };
  private inFlight?: { key: string; promise: Promise<SessionProbeResult> };

  constructor(private readonly options: ProbeCoordinatorOptions) {}

  /** Drop the cached success (URL/proxy changes, explicit re-tests). */
  invalidate(): void {
    this.cache = undefined;
  }

  /** Probe using the 20s success cache. */
  async probe(url: string): Promise<SessionProbeResult> {
    this.options.state.syncUrl(url);
    if (!url) {
      return { alive: false, likelyExpired: false };
    }

    const cached = this.cache;
    if (
      cached &&
      cached.url === url &&
      cached.result.alive &&
      this.now() - cached.at < PROBE_CACHE_TTL_MS
    ) {
      const ticket = this.options.state.beginProbe(url);
      if (ticket) {
        this.options.state.completeProbe(ticket, true);
      }
      return cached.result;
    }

    return this.run(url);
  }

  /** Bypass the cache (used right before an upload or an explicit test). */
  async probeFresh(url: string): Promise<SessionProbeResult> {
    this.options.state.syncUrl(url);
    if (!url) {
      return { alive: false, likelyExpired: false };
    }
    this.cache = undefined;
    return this.run(url);
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private run(url: string): Promise<SessionProbeResult> {
    // Concurrent probes for the same URL/generation share one request.
    const key = `${this.options.state.urlGeneration}:${url}`;
    if (this.inFlight && this.inFlight.key === key) {
      return this.inFlight.promise;
    }

    const ticket = this.options.state.beginProbe(url);
    if (!ticket) {
      return Promise.resolve({ alive: false, likelyExpired: false });
    }

    const promise = this.execute(url, ticket);
    this.inFlight = { key, promise };
    const clear = (): void => {
      if (this.inFlight?.promise === promise) {
        this.inFlight = undefined;
      }
    };
    void promise.then(clear, clear);
    return promise;
  }

  private async execute(url: string, ticket: ProbeTicket): Promise<SessionProbeResult> {
    let result: SessionProbeResult;
    try {
      result = await this.options.clientFactory(url).probeSession(this.options.getTimeoutMs());
    } catch (error) {
      // An invalid URL should read as "not connected", not crash callers.
      result = {
        alive: false,
        error: error instanceof KaggleError ? error : classifyNetworkError(error),
        likelyExpired: false
      };
    }

    this.options.state.completeProbe(ticket, result.alive);
    this.cache = result.alive ? { url, at: this.now(), result } : undefined;
    return result;
  }
}
