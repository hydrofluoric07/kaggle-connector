/**
 * Tracks whether a live Kaggle Jupyter session is reachable.
 *
 * Kept free of `vscode` imports so the transition and race-condition logic can
 * be unit tested with plain `node --test`. Callers are responsible for
 * mirroring `connected` into the `kaggleConnector.connected` context key.
 */

export interface ConnectionTicket {
  generation: number;
  url: string;
}

export interface ProbeTicket extends ConnectionTicket {
  probeSeq: number;
}

export type ConnectionChangeListener = (connected: boolean) => void;

export class ConnectionState {
  private connectedValue = false;
  private currentUrl = '';
  private generation = 0;
  private probeSeq = 0;
  private readonly listeners = new Set<ConnectionChangeListener>();

  get connected(): boolean {
    return this.connectedValue;
  }

  /** The normalized URL currently treated as persisted ('' when unset). */
  get url(): string {
    return this.currentUrl;
  }

  get urlGeneration(): number {
    return this.generation;
  }

  onDidChange(listener: ConnectionChangeListener): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  /**
   * Point the state at a persisted URL. A changed URL (or clearing it) resets
   * the connection to false and invalidates every ticket handed out before.
   */
  syncUrl(url: string): void {
    if (url === this.currentUrl) {
      return;
    }
    this.currentUrl = url;
    this.generation += 1;
    this.probeSeq = 0;
    this.setConnected(false);
  }

  /** Snapshot for a state-changing operation that is not a probe. */
  captureTicket(): ConnectionTicket {
    return { generation: this.generation, url: this.currentUrl };
  }

  /** Start a probe for `url`; returns undefined when there is no URL. */
  beginProbe(url: string): ProbeTicket | undefined {
    this.syncUrl(url);
    if (!this.currentUrl) {
      return undefined;
    }
    this.probeSeq += 1;
    return {
      generation: this.generation,
      url: this.currentUrl,
      probeSeq: this.probeSeq
    };
  }

  /** Apply a probe result unless a newer URL/probe has superseded it. */
  completeProbe(ticket: ProbeTicket, alive: boolean): boolean {
    if (!this.isCurrentProbe(ticket)) {
      return false;
    }
    this.setConnected(alive);
    return true;
  }

  /** Mark connected after a non-probe operation succeeded. */
  markConnected(ticket: ConnectionTicket): boolean {
    if (!this.isCurrentOperation(ticket)) {
      return false;
    }
    this.probeSeq += 1;
    this.setConnected(true);
    return true;
  }

  /** Mark disconnected after a connection-typed error. */
  markDisconnected(ticket?: ConnectionTicket): boolean {
    if (ticket && !this.isCurrentOperation(ticket)) {
      return false;
    }
    this.probeSeq += 1;
    this.setConnected(false);
    return true;
  }

  private isCurrentOperation(ticket: ConnectionTicket): boolean {
    return ticket.generation === this.generation && ticket.url === this.currentUrl;
  }

  private isCurrentProbe(ticket: ProbeTicket): boolean {
    return this.isCurrentOperation(ticket) && ticket.probeSeq === this.probeSeq;
  }

  private setConnected(value: boolean): void {
    if (this.connectedValue === value) {
      return;
    }
    this.connectedValue = value;
    for (const listener of this.listeners) {
      listener(value);
    }
  }
}
