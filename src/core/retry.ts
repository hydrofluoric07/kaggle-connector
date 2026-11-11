import { KaggleError } from './errors';

export interface RetryOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  cancelMessage?: string;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export function isRetryable(error: unknown): boolean {
  return error instanceof KaggleError && error.retryable && error.kind !== 'cancelled';
}

export function delay(
  ms: number,
  signal?: AbortSignal,
  cancelMessage = '操作已取消'
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new KaggleError('cancelled', cancelMessage));
      return;
    }
    if (ms <= 0) {
      resolve();
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new KaggleError('cancelled', cancelMessage));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Retry transient failures (timeout, network, DNS, 5xx) with exponential
 * backoff and jitter. Never retries cancellations or 4xx/session errors.
 */
export async function withRetries<T>(
  action: () => Promise<T>,
  retries: number,
  signal?: AbortSignal,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = Math.max(0, Math.floor(retries));
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const jitterMs = options.jitterMs ?? 200;
  const cancelMessage = options.cancelMessage ?? '操作已取消';

  let attempt = 0;
  while (true) {
    if (signal?.aborted) {
      throw new KaggleError('cancelled', cancelMessage);
    }
    try {
      return await action();
    } catch (error) {
      if (attempt >= maxRetries || signal?.aborted || !isRetryable(error)) {
        throw error;
      }
      attempt += 1;
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)) + jitter;
      options.onRetry?.(attempt, error, delayMs);
      await delay(delayMs, signal, cancelMessage);
    }
  }
}
