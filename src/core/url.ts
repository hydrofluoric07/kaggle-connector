import { createHash } from 'node:crypto';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Normalize a Kaggle/Jupyter server URL while keeping its path and query.
 * Kaggle's "VS Code Compatible URL" embeds the session token in the path,
 * so the path must never be stripped.
 */
export function normalizeServerUrl(input: string): string {
  let value = (input ?? '').trim();
  if (!value) {
    throw new Error('Jupyter URL 不能为空');
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Jupyter URL 格式无效');
  }
  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Jupyter URL 只支持 http/https');
  }

  const pathname = parsed.pathname
    .replace(/\/+$/, '')
    // Accept a browser URL such as /lab or /tree?token=... as well.
    .replace(/\/(?:lab|tree)$/i, '');
  return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
}

/**
 * Normalize an API path: forward slashes, no leading/trailing slashes,
 * no "." segments and no ".." traversal.
 */
export function normalizeRemotePath(input: string): string {
  const value = (input ?? '').trim().replace(/\\/g, '/');
  if (!value) {
    return '';
  }

  const parts = value.split('/').filter((part) => part !== '' && part !== '.');
  for (const part of parts) {
    if (part === '..') {
      throw new Error('远程路径不能包含 ".."');
    }
  }
  return parts.join('/');
}

export function joinRemotePath(...parts: Array<string | undefined>): string {
  return normalizeRemotePath(parts.filter((part): part is string => Boolean(part)).join('/'));
}

export function dirnameRemotePath(path: string): string {
  const normalized = normalizeRemotePath(path);
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}

/**
 * Build `<server>/api/contents/<encoded path>` without losing `?token=...`.
 */
export function contentsUrl(serverUrl: string, remotePath: string): string {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const path = normalizeRemotePath(remotePath);
  const encoded = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const basePath = parsed.pathname.replace(/\/+$/, '');
  const apiPath = `${basePath}/api/contents${encoded ? `/${encoded}` : ''}`;

  return `${parsed.protocol}//${parsed.host}${apiPath}${parsed.search}`;
}

/**
 * Build `<server>/files/<encoded path>` without losing `?token=...`.
 * This serves the raw file bytes, bypassing Contents API conversions
 * (e.g. Jupytext turning a .py file into a notebook model).
 */
export function filesUrl(serverUrl: string, remotePath: string): string {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const path = normalizeRemotePath(remotePath);
  const encoded = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const basePath = parsed.pathname.replace(/\/+$/, '');
  const apiPath = `${basePath}/files${encoded ? `/${encoded}` : ''}`;

  return `${parsed.protocol}//${parsed.host}${apiPath}${parsed.search}`;
}

function apiEndpointUrl(serverUrl: string, suffix: string): string {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const basePath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.protocol}//${parsed.host}${basePath}${suffix}${parsed.search}`;
}

/**
 * Build `<server>/api/status` without losing `?token=...`.
 * A lightweight, fixed-cost endpoint used to probe session liveness.
 */
export function statusUrl(serverUrl: string): string {
  return apiEndpointUrl(serverUrl, '/api/status');
}

/**
 * Build `<server>/api/kernels` without losing `?token=...`.
 * Used for session keep-alive to refresh Jupyter's last_activity timestamp.
 */
export function kernelsUrl(serverUrl: string): string {
  return apiEndpointUrl(serverUrl, '/api/kernels');
}

/**
 * Build `<server>/api/kernelspecs` without losing `?token=...`.
 */
export function kernelspecsUrl(serverUrl: string): string {
  return apiEndpointUrl(serverUrl, '/api/kernelspecs');
}

/**
 * Build `<server>/api/kernels/<id>` without losing `?token=...`.
 */
export function kernelUrl(serverUrl: string, kernelId: string): string {
  return apiEndpointUrl(serverUrl, `/api/kernels/${encodeURIComponent(kernelId)}`);
}

/**
 * Build `<server>/api/kernels/<id>/channels` without losing `?token=...`.
 */
export function kernelChannelsUrl(serverUrl: string, kernelId: string): string {
  return apiEndpointUrl(serverUrl, `/api/kernels/${encodeURIComponent(kernelId)}/channels`);
}

export interface JupyterConnectionParts {
  /** `protocol//host+path`, no query: Jupyter appends `/api/...` to this. */
  baseUrl: string;
  /** Value of a `?token=` query parameter; undefined when absent or empty. */
  token: string | undefined;
}

/**
 * Split a server URL into the parts expected by the Jupyter extension's
 * server-provider API. Mirrors Jupyter's own parser: the base URL keeps the
 * path (Kaggle embeds the session JWT there) and drops the query, and the
 * token is passed separately.
 */
export function jupyterConnectionParts(serverUrl: string): JupyterConnectionParts {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const token = parsed.searchParams.get('token');
  return {
    baseUrl: `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`,
    token: token ? token : undefined
  };
}

/** 同一 (baseUrl, token) 恒定；URL/token 变化必然产生新 id。 */
export function jupyterServerId(parts: JupyterConnectionParts): string {
  const hash = createHash('sha256')
    .update(`${parts.baseUrl}\0${parts.token ?? ''}`)
    .digest('hex');
  return `kaggle-${hash.slice(0, 12)}`;
}

/**
 * Safe URL form for logs. Never log a Kaggle URL verbatim because its path
 * (or query) contains the session credential.
 */
export function displayServerUrl(serverUrl: string): string {
  try {
    const parsed = new URL(normalizeServerUrl(serverUrl));
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => (segment.length > 40 ? `${segment.slice(0, 6)}…${segment.slice(-4)}` : segment));
    const path = segments.length ? `/${segments.join('/')}` : '';
    const query = parsed.search ? '?token=***' : '';
    return `${parsed.protocol}//${parsed.host}${path}${query}`;
  } catch {
    return '<invalid-url>';
  }
}
