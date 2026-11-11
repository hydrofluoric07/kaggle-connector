import * as http from 'node:http';
import * as https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { KaggleError } from './core/errors';

export interface HttpRequestOptions {
  method: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
  timeoutMs?: number;
  /**
   * Wall-clock deadline for the whole request. Unlike timeoutMs (a socket
   * inactivity timeout), this fires even if the server trickles bytes, and
   * is used by the session probe to fail fast on expired links.
   */
  deadlineMs?: number;
  signal?: AbortSignal;
  proxy?: string;
  maxResponseBytes?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  url: string;
}

/**
 * Minimal HTTP client:
 * - does NOT follow redirects (a Kaggle session redirect to the login page is
 *   an important error signal),
 * - supports an explicit HTTP proxy via https-proxy-agent,
 * - supports cancellation and timeouts.
 */
export function httpRequest(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
  const target = new URL(url);
  const isHttps = target.protocol === 'https:';
  const body = options.body === undefined
    ? undefined
    : Buffer.isBuffer(options.body)
      ? options.body
      : Buffer.from(options.body, 'utf8');

  const headers: Record<string, string | number> = {
    Accept: 'application/json',
    ...options.headers
  };
  if (body) {
    headers['Content-Length'] = body.length;
  }

  return new Promise<HttpResponse>((resolve, reject) => {
    let settled = false;
    let request: http.ClientRequest | undefined;
    let abortListener: (() => void) | undefined;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (abortListener && options.signal) {
        options.signal.removeEventListener('abort', abortListener);
      }
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = undefined;
      }
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = undefined;
      }
    };

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const requestOptions: https.RequestOptions = {
      method: options.method,
      headers
    };

    if (isHttps && options.proxy) {
      try {
        requestOptions.agent = new HttpsProxyAgent(options.proxy);
      } catch (error) {
        finish(() => reject(error));
        return;
      }
    }

    const onResponse = (response: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      let total = 0;
      const max = options.maxResponseBytes ?? 4 * 1024 * 1024;

      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > max) {
          request?.destroy(new KaggleError('unknown', '服务器响应过大'));
          return;
        }
        chunks.push(chunk);
      });

      response.on('end', () => {
        finish(() =>
          resolve({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? '',
            headers: response.headers,
            body: Buffer.concat(chunks),
            url: target.toString()
          })
        );
      });

      response.on('error', (error) => {
        finish(() => reject(error));
      });
    };

    try {
      request = isHttps
        ? https.request(target, requestOptions, onResponse)
        : http.request(target, requestOptions as http.RequestOptions, onResponse);
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    const timeoutMs = options.timeoutMs ?? 120000;
    const destroyWithTimeout = (ms: number) => {
      const error = new Error(`请求超时（${ms} ms）`) as Error & { code?: string };
      error.code = 'ETIMEDOUT';
      request?.destroy(error);
    };

    request.setTimeout(timeoutMs, () => destroyWithTimeout(timeoutMs));
    // request.setTimeout only arms once a socket attaches; guard proxy CONNECT
    // stalls before the socket event fires.
    if (!request.socket) {
      connectTimer = setTimeout(() => destroyWithTimeout(timeoutMs), timeoutMs);
      request.once('socket', () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = undefined;
        }
      });
    }

    if (options.deadlineMs !== undefined && options.deadlineMs > 0) {
      const deadlineMs = options.deadlineMs;
      deadlineTimer = setTimeout(() => destroyWithTimeout(deadlineMs), deadlineMs);
    }

    request.on('error', (error) => {
      finish(() => reject(error));
    });

    if (options.signal) {
      abortListener = () => {
        request?.destroy(new KaggleError('cancelled', '操作已取消'));
      };
      if (options.signal.aborted) {
        abortListener();
      } else {
        options.signal.addEventListener('abort', abortListener, { once: true });
      }
    }

    request.end(body);
  });
}
