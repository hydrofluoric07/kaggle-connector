export type ErrorKind =
  | 'auth'
  | 'forbidden'
  | 'notFound'
  | 'badRequest'
  | 'tooLarge'
  | 'server'
  | 'gateway'
  | 'redirect'
  | 'network'
  | 'dns'
  | 'timeout'
  | 'tls'
  | 'cancelled'
  | 'nonJson'
  | 'unknown';

export interface KaggleErrorOptions {
  status?: number;
  detail?: string;
  hint?: string;
  retryable?: boolean;
  cause?: unknown;
}

export class KaggleError extends Error {
  readonly kind: ErrorKind;
  readonly status?: number;
  readonly detail?: string;
  readonly hint?: string;
  readonly retryable: boolean;

  constructor(kind: ErrorKind, message: string, options: KaggleErrorOptions = {}) {
    super(message);
    this.name = 'KaggleError';
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
    this.hint = options.hint;
    this.retryable = options.retryable ?? false;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export interface HttpResponseInfo {
  status: number;
  statusText: string;
  body: string;
  url: string;
  location?: string;
  contentType?: string;
}

const URL_HINT = '请重新复制 Kaggle Notebook → Run → Kaggle Jupyter Server 中的 “VS Code Compatible URL”，并在侧栏更新。';

export function classifyHttpError(info: HttpResponseInfo): KaggleError {
  const { status } = info;
  const parsed = parseJupyterBody(info.body);
  const detail = truncate([parsed.message, parsed.reason].filter(Boolean).join(' — ') || info.body, 300);

  if (status >= 300 && status < 400) {
    return new KaggleError('redirect', `请求被重定向（HTTP ${status}）`, {
      status,
      detail: truncate(info.location || detail, 300),
      hint: `这通常意味着 Kaggle 会话已结束并被跳转到登录页。${URL_HINT}`
    });
  }

  switch (status) {
    case 401:
      return new KaggleError('auth', '认证失败（HTTP 401）', {
        status,
        detail,
        hint: URL_HINT
      });

    case 403: {
      if (/permission denied|read[- ]only|\/kaggle\/input/i.test(info.body)) {
        return new KaggleError('forbidden', '远程目录不可写（HTTP 403）', {
          status,
          detail,
          hint: 'Kaggle 上只有 /kaggle/working 可写；请把 REMOTE_DIR 设置到可写目录。'
        });
      }
      return new KaggleError('auth', '访问被拒绝（HTTP 403）', {
        status,
        detail,
        hint: `会话可能已过期，或该目录不可写。${URL_HINT}`
      });
    }

    case 404: {
      // Jupyter's own 404 is JSON ("file or directory does not exist"), while
      // Kaggle's pod proxy rewrites container 404s to plain text "not found".
      // In contrast, "404 page not found" / HTML comes from the outer proxy
      // (expired/stopped session or missing /proxy), and fixed endpoints such
      // as /api/status or the root /api/contents directory only return 404 when
      // the session/URL itself is invalid.
      const looksJson = isJsonHttpResponse(info.contentType, info.body);
      const isPlainNotFound = !looksJson && isPlainTextNotFoundBody(info.contentType, info.body);
      if (isFixedSessionEndpoint(info.url) || (!looksJson && !isPlainNotFound)) {
        return new KaggleError('auth', 'Kaggle 会话可能已失效（代理返回 404）', {
          status,
          detail,
          hint: `失效链接常被代理以纯文本 404 拒绝。${URL_HINT}`
        });
      }
      return new KaggleError('notFound', '远程路径不存在（HTTP 404）', {
        status,
        detail,
        hint: '检查 REMOTE_DIR 和 Jupyter URL；若 URL 缺少 /proxy 或会话已结束也会返回 404。'
      });
    }

    case 400:
      if (/not empty/i.test(info.body)) {
        return new KaggleError('badRequest', '工作目录非空（HTTP 400）', {
          status,
          detail,
          hint: '服务器禁止直接删除非空目录；请先删除目录内的文件，或确认服务器允许递归删除。'
        });
      }
      return new KaggleError('badRequest', '请求被 Jupyter 拒绝（HTTP 400）', {
        status,
        detail,
        hint: '常见原因是路径格式、文件格式或目标目录冲突；日志里有服务器返回的 reason。'
      });

    case 409:
      return new KaggleError('badRequest', '目标路径已存在（HTTP 409）', {
        status,
        detail,
        hint: '换一个目标名称，或先删除/重命名目标路径。'
      });

    case 413:
      return new KaggleError('tooLarge', '文件过大，服务器拒绝接收（HTTP 413）', {
        status,
        detail,
        hint: '调低 kaggleConnector.maxFileSizeMB，或把大文件拆分成多个文件/改用 Kaggle Dataset。'
      });

    case 500:
      return new KaggleError('server', 'Jupyter 服务器保存文件失败（HTTP 500）', {
        status,
        detail,
        hint: /No such file or directory|Not a directory|Permission denied/i.test(info.body)
          ? '远程父目录不存在或路径冲突。插件会尝试自动创建目录；若仍失败请检查 REMOTE_DIR。'
          : '服务器内部错误；可稍后重试，并查看日志中的服务器返回内容。',
        retryable: true
      });

    case 502:
    case 503:
    case 504:
      return new KaggleError('gateway', `Kaggle 代理暂不可用（HTTP ${status}）`, {
        status,
        detail,
        hint: 'Kaggle 会话可能尚未启动、已停止或正在重启；请确认 Notebook 会话仍在运行。',
        retryable: true
      });

    default:
      return new KaggleError('unknown', `请求失败（HTTP ${status}）`, {
        status,
        detail,
        retryable: status >= 500
      });
  }
}

export function nonJsonError(_url: string, body: string, status = 200): KaggleError {
  return new KaggleError('nonJson', `服务器返回的不是 Jupyter JSON（HTTP ${status}）`, {
    status,
    detail: truncate(body, 200),
    hint: `这通常意味着 URL 已过期并被重定向到登录页。${URL_HINT}`
  });
}

export function classifyNetworkError(error: unknown): KaggleError {
  if (error instanceof KaggleError) {
    return error;
  }

  const candidate = error as { code?: unknown; message?: unknown; name?: unknown } | undefined;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message : String(error);

  if (candidate?.name === 'AbortError' || /cancelled|canceled|aborted/i.test(message)) {
    return new KaggleError('cancelled', '操作已取消', { cause: error });
  }

  switch (code) {
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'UND_ERR_HEADERS_TIMEOUT':
    case 'UND_ERR_BODY_TIMEOUT':
      return new KaggleError('timeout', '请求超时', {
        detail: message,
        hint: '检查网络、代理或 Kaggle Jupyter Server是否已过期',
        retryable: true,
        cause: error
      });

    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return new KaggleError('dns', '无法解析 Kaggle 域名（DNS 失败）', {
        detail: message,
        hint: '检查网络或代理设置；在部分网络环境下需要配置 kaggleConnector.proxy。',
        retryable: true,
        cause: error
      });

    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
    case 'ERR_PROXY_CONNECTION_FAILED':
      return new KaggleError('network', '无法连接 Kaggle 服务器', {
        detail: `${code}${message ? `: ${message}` : ''}`,
        hint: '检查网络/代理；如果使用本地代理，请在侧栏设置 kaggleConnector.proxy。',
        retryable: true,
        cause: error
      });

    case 'EPROTO':
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return new KaggleError('tls', 'TLS/证书校验失败', {
        detail: `${code}${message ? `: ${message}` : ''}`,
        hint: '代理或网络可能拦截了 HTTPS；请检查代理证书设置。',
        cause: error
      });

    default:
      if (/timeout/i.test(message)) {
        return new KaggleError('timeout', '请求超时', {
          detail: message,
          hint: '检查网络、代理或 Kaggle Jupyter Server是否已过期',
          retryable: true,
          cause: error
        });
      }
      if (!code) {
        // A plain Error (validation, local I/O) is not a network failure;
        // keep its own message instead of blaming the proxy.
        return new KaggleError('unknown', message || '操作失败', { cause: error });
      }
      return new KaggleError('network', '网络请求失败', {
        detail: `${code}: ${message}`,
        hint: '检查网络/代理设置（kaggleConnector.proxy 或 HTTPS_PROXY）。',
        cause: error
      });
  }
}

export function isSessionError(error: unknown): boolean {
  return (
    error instanceof KaggleError &&
    (error.kind === 'auth' || error.kind === 'redirect' || error.kind === 'nonJson')
  );
}

/**
 * True when the error suggests the Kaggle session cannot be reached at all.
 * Business-level failures (missing path, read-only directory, oversized file,
 * cancellation) stay false so a live session is not reported as disconnected.
 */
export function isConnectionError(error: unknown): boolean {
  return (
    error instanceof KaggleError &&
    (isSessionError(error) ||
      error.kind === 'timeout' ||
      error.kind === 'network' ||
      error.kind === 'dns' ||
      error.kind === 'tls' ||
      error.kind === 'gateway')
  );
}

export function describeError(error: unknown): string {
  const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
  const parts = [typed.message];
  if (typed.detail && !typed.message.includes(typed.detail)) {
    parts.push(typed.detail);
  }
  if (typed.hint) {
    parts.push(typed.hint);
  }
  return parts.join(' | ');
}

export function shortError(error: unknown): string {
  const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
  return typed.hint ? `${typed.message}（${typed.hint}）` : typed.message;
}

export function isJsonHttpResponse(contentType: string | undefined, body: string): boolean {
  return /json/i.test(contentType ?? '') || /^\s*[{[]/.test(body);
}

function isPlainTextNotFoundBody(contentType: string | undefined, body: string): boolean {
  return !/html/i.test(contentType ?? '') && body.trim().toLowerCase() === 'not found';
}

function isFixedSessionEndpoint(rawUrl: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    pathname = rawUrl.split(/[?#]/, 1)[0] ?? '';
  }
  const normalized = pathname.replace(/\/+$/, '');
  // Match the first /api/(status|contents) boundary so a remote file actually
  // located at "/api/contents/api/status" is still treated as a subpath.
  const match = /\/api\/(contents|status)(?:\/(.*))?$/i.exec(normalized);
  return Boolean(match && !match[2]);
}

function parseJupyterBody(body: string): { message?: string; reason?: string } {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; reason?: unknown };
    return {
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined
    };
  } catch {
    return {};
  }
}

function truncate(value: string, max: number): string {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
