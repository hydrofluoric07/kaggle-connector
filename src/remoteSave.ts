export interface RemoteUploadQueueOptions {
  /** Upload the latest content for a key. Errors reject waiting save calls. */
  upload: (key: string, content: Uint8Array) => Promise<void>;
  /** When false, writes are uploaded immediately (VS Code auto-save off). */
  shouldDebounce: () => boolean;
  getDebounceMs: () => number;
  /** Force an upload if content has been pending this long, even while saving. */
  getMaxDelayMs: () => number;
}

interface PendingUpload {
  content: Uint8Array;
  firstQueuedAt: number;
  timer?: ReturnType<typeof setTimeout>;
  waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
}

/**
 * Coalesces frequent remote saves into one upload per file.
 *
 * - With auto-save disabled, each save uploads immediately.
 * - With auto-save enabled, rapid saves reset a debounce timer; the latest
 *   content is uploaded once the timer expires. A maximum age forces an
 *   upload even if saves keep arriving and resetting the timer.
 * - `writeNow` bypasses the debounce (manual Ctrl+S), merging with any
 *   pending content and resetting the timers.
 * - Saves for the same file are serialized so a later upload cannot be
 *   overtaken by an earlier one.
 */
export class RemoteUploadQueue {
  private readonly pending = new Map<string, PendingUpload>();
  private readonly chains = new Map<string, Promise<void>>();
  private disposed = false;

  constructor(private readonly options: RemoteUploadQueueOptions) {}

  write(key: string, content: Uint8Array): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('上传队列已释放'));
    }
    if (!this.options.shouldDebounce()) {
      return this.writeNow(key, content);
    }

    return new Promise<void>((resolve, reject) => {
      const now = Date.now();
      let entry = this.pending.get(key);
      if (!entry) {
        entry = { content, firstQueuedAt: now, waiters: [] };
        this.pending.set(key, entry);
      } else {
        entry.content = content;
        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = undefined;
        }
      }
      entry.waiters.push({ resolve, reject });

      const debounceMs = Math.max(0, this.options.getDebounceMs());
      const maxDelayMs = Math.max(0, this.options.getMaxDelayMs());
      const remainingMax = entry.firstQueuedAt + maxDelayMs - now;
      const delay = Math.max(0, Math.min(debounceMs, remainingMax));

      if (delay === 0) {
        void this.flush(key).catch(() => undefined);
        return;
      }
      entry.timer = setTimeout(() => {
        void this.flush(key).catch(() => undefined);
      }, delay);
    });
  }

  /**
   * Upload immediately, merging with any pending content and resetting the
   * debounce/max-delay timers. Used for manual saves.
   */
  writeNow(key: string, content: Uint8Array): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('上传队列已释放'));
    }
    let entry = this.pending.get(key);
    if (!entry) {
      entry = { content, firstQueuedAt: Date.now(), waiters: [] };
      this.pending.set(key, entry);
    } else {
      entry.content = content;
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = undefined;
      }
    }
    return new Promise<void>((resolve, reject) => {
      entry!.waiters.push({ resolve, reject });
      void this.flush(key).catch(() => undefined);
    });
  }

  /** Upload the pending content for a key now. */
  flush(key: string): Promise<void> {
    const entry = this.pending.get(key);
    if (!entry) {
      return this.chains.get(key) ?? Promise.resolve();
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = undefined;
    }
    this.pending.delete(key);

    const upload = this.enqueue(key, entry.content);
    upload.then(
      () => entry.waiters.forEach((waiter) => waiter.resolve()),
      (error) => entry.waiters.forEach((waiter) => waiter.reject(error))
    );
    return upload.then(() => undefined);
  }

  /** Flush every pending file and wait for in-flight uploads (best effort). */
  async flushAll(): Promise<void> {
    const keys = [...this.pending.keys()];
    await Promise.all(keys.map((key) => this.flush(key)));
    const chains = [...this.chains.values()];
    await Promise.all(chains.map((chain) => chain.catch(() => undefined)));
  }

  dispose(): void {
    this.disposed = true;
    const error = new Error('上传队列已释放');
    for (const entry of this.pending.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.waiters.forEach((waiter) => waiter.reject(error));
    }
    this.pending.clear();
  }

  private enqueue(key: string, content: Uint8Array): Promise<void> {
    const previous = this.chains.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.options.upload(key, content));
    this.chains.set(key, next);
    return next.finally(() => {
      if (this.chains.get(key) === next) {
        this.chains.delete(key);
      }
    });
  }
}
