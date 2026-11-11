import {
  KaggleError,
  classifyHttpError,
  classifyNetworkError,
  isJsonHttpResponse,
  isSessionError,
  nonJsonError
} from './core/errors';
import {
  buildKernelConfigureCwdCode,
  parseKernelConfigureCwdResult,
  splitRemoteDirParts,
  type ConfigureWorkingDirResult
} from './core/remoteCwd';
import {
  contentsUrl,
  filesUrl,
  kernelChannelsUrl,
  kernelUrl,
  kernelsUrl,
  kernelspecsUrl,
  normalizeRemotePath,
  normalizeServerUrl,
  statusUrl
} from './core/url';
import { httpRequest } from './http';
import { executePythonInKernel } from './ws';

export interface JupyterClientOptions {
  proxy?: string;
  timeoutMs?: number;
}

export interface ConnectionTestResult {
  exists: boolean;
  writable?: boolean;
  path: string;
}

export interface SessionProbeResult {
  alive: boolean;
  /** Present when the session does not appear alive. */
  error?: KaggleError;
  /**
   * True when the failure suggests the session expired (auth/redirect/
   * nonJson/proxy-404) or the probe timed out. False for pure network/DNS/
   * TLS problems, where updating the URL would not help.
   */
  likelyExpired: boolean;
}

export interface JupyterContentsEntry {
  name: string;
  path: string;
  type: 'directory' | 'file' | 'notebook';
  writable?: boolean;
  size?: number;
  /** Server-side modification time in epoch milliseconds. */
  lastModified?: number;
  hash?: string;
  hashAlgorithm?: string;
}

export interface ListDirectoryOptions {
  /**
   * Ask Jupyter for content hashes. The server may ignore this and return
   * null hashes; callers must fall back to size/mtime.
   */
  hash?: boolean;
}

export interface DownloadFileOptions {
  signal?: AbortSignal;
  type?: 'directory' | 'file' | 'notebook';
  sizeHint?: number;
}

export interface KernelSummary {
  id: string;
  name: string;
  executionState?: string;
}

export interface ConfigureWorkingDirOptions {
  enabled?: boolean;
  onlyExistingIdle?: boolean;
  signal?: AbortSignal;
}

/** Contents API reads the whole file into the response body. */
const MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024;
/** Use raw /files streaming for large non-HTML files to skip base64 + JSON overhead. */
const RAW_DOWNLOAD_THRESHOLD_BYTES = 1024 * 1024;
const HTML_LIKE_FILE_RE = /\.(html?|xhtml|svg)$/i;
const SESSION_CONFIRM_TTL_MS = 3000;
const HELPER_KERNEL_IDLE_MS = 3000;
const KERNEL_DELETE_MARKER = '__KC_DEL__:';

export class JupyterClient {
  private readonly baseUrl: string;
  private readonly proxy?: string;
  private readonly timeoutMs: number;
  private readonly token?: string;
  private clockOffsetMs = 0;
  private lastSessionConfirmedAt = 0;
  private pendingSessionConfirm: Promise<void> | undefined;
  private helperKernelId: string | undefined;
  private helperKernelOwned = false;
  private helperKernelNeedsReady = false;
  private helperKernelIdleTimer: ReturnType<typeof setTimeout> | undefined;
  private helperKernelInFlight: Promise<string> | undefined;

  constructor(serverUrl: string, options: JupyterClientOptions = {}) {
    this.baseUrl = normalizeServerUrl(serverUrl);
    this.proxy = options.proxy;
    this.timeoutMs = options.timeoutMs ?? 120000;

    try {
      this.token = new URL(this.baseUrl).searchParams.get('token') ?? undefined;
    } catch {
      this.token = undefined;
    }
  }

  async test(remoteDir: string): Promise<ConnectionTestResult> {
    const path = normalizeRemotePath(remoteDir);
    try {
      const model = (await this.getContents(path)) as
        | { writable?: unknown; type?: unknown }
        | undefined;
      if (path && typeof model?.type === 'string' && model.type !== 'directory') {
        throw new KaggleError(
          'badRequest',
          `远端路径 “${path}” 是一个 ${model.type}，不是目录`,
          { hint: '请把 REMOTE_DIR 改成目录路径，或先删除同名文件。' }
        );
      }
      return {
        exists: true,
        writable: typeof model?.writable === 'boolean' ? model.writable : undefined,
        path
      };
    } catch (error) {
      if (error instanceof KaggleError && error.kind === 'notFound' && path) {
        return { exists: false, path };
      }
      throw error;
    }
  }

  /**
   * Fast liveness probe against GET /api/status with a wall-clock deadline.
   * Expired Kaggle links can hang ~30s before the proxy answers 404; the
   * deadline cuts that short. Never throws: failures are returned so callers
   * can distinguish "likely expired" from "network problem".
   */
  async probeSession(deadlineMs: number): Promise<SessionProbeResult> {
    try {
      await this.requestUrl('GET', statusUrl(this.baseUrl), undefined, undefined, {
        deadlineMs,
        skipSessionConfirmation: true
      });
      this.lastSessionConfirmedAt = Date.now();
      return { alive: true, likelyExpired: false };
    } catch (error) {
      this.lastSessionConfirmedAt = 0;
      const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
      return {
        alive: false,
        error: typed,
        likelyExpired: isSessionError(typed) || typed.kind === 'timeout'
      };
    }
  }

  /**
   * Lightweight keep-alive ping against GET /api/kernels (refreshes last_activity)
   * with automatic fallback to GET /api/status if the kernels endpoint is not available.
   * Expired Kaggle links or timeouts return likelyExpired: true. Never throws.
   */
  async keepAlive(deadlineMs: number): Promise<SessionProbeResult> {
    try {
      await this.requestUrl('GET', kernelsUrl(this.baseUrl), undefined, undefined, {
        deadlineMs
      });
      return { alive: true, likelyExpired: false };
    } catch (error) {
      const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
      if (typed.kind === 'notFound') {
        return this.probeSession(deadlineMs);
      }
      return {
        alive: false,
        error: typed,
        likelyExpired: isSessionError(typed) || typed.kind === 'timeout'
      };
    }
  }

  async getContents(remotePath: string, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(this.contentsUrl(remotePath));
    url.searchParams.set('content', '0');
    return this.requestUrl('GET', url.toString(), undefined, signal);
  }

  /**
   * List a remote directory (GET /api/contents/{path}?content=1).
   * Directories are returned first, then entries by name.
   */
  async listDirectory(
    remotePath: string,
    signal?: AbortSignal,
    options: ListDirectoryOptions = {}
  ): Promise<JupyterContentsEntry[]> {
    const url = new URL(this.contentsUrl(remotePath));
    url.searchParams.set('content', '1');
    if (options.hash) {
      url.searchParams.set('hash', '1');
    }
    const model = await this.requestUrl('GET', url.toString(), undefined, signal);

    if (!model || typeof model !== 'object') {
      throw new KaggleError('badRequest', '目录返回内容无效');
    }

    const record = model as { type?: unknown; content?: unknown };
    if (record.type !== 'directory') {
      throw new KaggleError(
        'badRequest',
        `“${normalizeRemotePath(remotePath) || '/'}” 不是目录`
      );
    }
    if (!Array.isArray(record.content)) {
      return [];
    }

    const entries: JupyterContentsEntry[] = [];
    for (const raw of record.content) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const item = raw as Record<string, unknown>;
      const name = typeof item.name === 'string' ? item.name : '';
      const path = typeof item.path === 'string' ? item.path : '';
      if (!name || !path) {
        continue;
      }
      const type =
        item.type === 'directory' || item.type === 'notebook' ? item.type : 'file';
      entries.push({
        name,
        path,
        type,
        writable: typeof item.writable === 'boolean' ? item.writable : undefined,
        size: typeof item.size === 'number' ? item.size : undefined,
        lastModified: parseTimestamp(item.last_modified),
        hash: typeof item.hash === 'string' ? item.hash : undefined,
        hashAlgorithm:
          typeof item.hash_algorithm === 'string' ? item.hash_algorithm : undefined
      });
    }

    entries.sort((left, right) => {
      const directoryOrder =
        Number(right.type === 'directory') - Number(left.type === 'directory');
      return directoryOrder !== 0
        ? directoryOrder
        : left.name.localeCompare(right.name, undefined, {
            numeric: true,
            sensitivity: 'base'
          });
    });

    return entries;
  }

  async putFile(remotePath: string, bytes: Buffer, signal?: AbortSignal): Promise<void> {
    const payload = JSON.stringify({
      type: 'file',
      format: 'base64',
      content: bytes.toString('base64')
    });
    await this.requestUrl('PUT', this.contentsUrl(remotePath), payload, signal);
  }

  async putDirectory(remotePath: string, signal?: AbortSignal): Promise<void> {
    await this.requestUrl(
      'PUT',
      this.contentsUrl(remotePath),
      JSON.stringify({ type: 'directory' }),
      signal
    );
  }

  async deleteContents(remotePath: string, signal?: AbortSignal): Promise<void> {
    try {
      await this.requestUrl('DELETE', this.contentsUrl(remotePath), undefined, signal);
    } catch (error) {
      if (!shouldFallbackKernelDelete(error)) {
        throw error;
      }
      await this.deleteViaKernel(remotePath, signal);
    }
  }

  async listKernels(signal?: AbortSignal): Promise<KernelSummary[]> {
    const list = (await this.requestUrl('GET', kernelsUrl(this.baseUrl), undefined, signal, {
      deadlineMs: Math.min(this.timeoutMs, 10000)
    })) as Array<{ id?: unknown; name?: unknown; execution_state?: unknown }> | undefined;
    if (!Array.isArray(list)) {
      return [];
    }
    const result: KernelSummary[] = [];
    for (const item of list) {
      if (typeof item?.id !== 'string' || !item.id) {
        continue;
      }
      result.push({
        id: item.id,
        name: typeof item.name === 'string' ? item.name : '',
        executionState:
          typeof item.execution_state === 'string' ? item.execution_state : undefined
      });
    }
    return result;
  }

  /**
   * Persist the IPython startup script so newly launched Python kernels start
   * inside REMOTE_DIR (with sys.path and PYTHONPATH configured), and update any
   * currently idle Python kernels immediately. When no idle kernel is running,
   * a temporary helper kernel is spun up and disposed right after writing the
   * startup script unless `onlyExistingIdle` is set.
   */
  async configureKernelWorkingDir(
    remoteDir: string,
    options: ConfigureWorkingDirOptions = {}
  ): Promise<ConfigureWorkingDirResult> {
    const enabled = options.enabled ?? true;
    const parts = splitRemoteDirParts(remoteDir);
    if (enabled && parts.length === 0) {
      throw new KaggleError('badRequest', '工作目录不能为空');
    }

    const code = buildKernelConfigureCwdCode(parts, enabled);
    let kernels: KernelSummary[] = [];
    try {
      kernels = await this.listKernels(options.signal);
    } catch (error) {
      if (isSessionError(error) || (error instanceof KaggleError && error.kind === 'cancelled')) {
        throw error;
      }
      kernels = [];
    }

    const pythonKernels = kernels.filter(
      (kernel) => !kernel.name || /python/i.test(kernel.name)
    );
    const busyCount = pythonKernels.filter(
      (kernel) => kernel.executionState === 'busy'
    ).length;
    const idleKernels = pythonKernels.filter(
      (kernel) => kernel.executionState !== 'busy'
    );

    if (idleKernels.length > 0) {
      let executedCount = 0;
      let startupConfigured = false;
      let updatedKernels = 0;
      let dirExists = false;
      let projPath: string | undefined;
      let startupPath: string | undefined;

      for (const kernel of idleKernels) {
        try {
          const execResult = await executePythonInKernel({
            channelsUrl: kernelChannelsUrl(this.baseUrl, kernel.id),
            token: this.token,
            proxy: this.proxy,
            timeoutMs: this.timeoutMs,
            signal: options.signal,
            code,
            waitForReady: kernel.executionState === 'starting'
          });
          const parsed = parseKernelConfigureCwdResult(execResult);
          executedCount += 1;
          startupConfigured = parsed.startupConfigured;
          dirExists = parsed.dirExists;
          if (parsed.cwdChanged) {
            updatedKernels += 1;
          }
          projPath = parsed.projPath ?? projPath;
          startupPath = parsed.startupPath ?? startupPath;
        } catch (error) {
          if (error instanceof KaggleError && error.kind === 'notFound') {
            continue;
          }
          throw error;
        }
      }

      if (executedCount > 0) {
        return {
          startupConfigured,
          updatedKernels,
          skippedBusyKernels: busyCount,
          dirExists,
          projPath,
          startupPath
        };
      }
    }

    if (options.onlyExistingIdle) {
      return {
        startupConfigured: false,
        updatedKernels: 0,
        skippedBusyKernels: busyCount,
        dirExists: false
      };
    }

    const hadHelper = Boolean(this.helperKernelId);
    const helperId = await this.ensureHelperKernel(options.signal);
    const waitForReady = this.helperKernelNeedsReady;
    try {
      const execResult = await executePythonInKernel({
        channelsUrl: kernelChannelsUrl(this.baseUrl, helperId),
        token: this.token,
        proxy: this.proxy,
        timeoutMs: this.timeoutMs,
        signal: options.signal,
        code,
        waitForReady
      });
      this.helperKernelNeedsReady = false;
      const parsed = parseKernelConfigureCwdResult(execResult);
      return {
        startupConfigured: parsed.startupConfigured,
        updatedKernels: this.helperKernelOwned ? 0 : parsed.cwdChanged ? 1 : 0,
        skippedBusyKernels: busyCount,
        dirExists: parsed.dirExists,
        projPath: parsed.projPath,
        startupPath: parsed.startupPath
      };
    } finally {
      if (!hadHelper) {
        if (this.helperKernelOwned) {
          await this.dispose();
        } else {
          this.helperKernelId = undefined;
          this.helperKernelNeedsReady = false;
        }
      }
    }
  }

  /**
   * Shut down any temporary helper kernel created by fallback operations.
   */
  async dispose(): Promise<void> {
    if (this.helperKernelIdleTimer) {
      clearTimeout(this.helperKernelIdleTimer);
      this.helperKernelIdleTimer = undefined;
    }
    const kernelId = this.helperKernelId;
    const owned = this.helperKernelOwned;
    this.helperKernelId = undefined;
    this.helperKernelOwned = false;
    this.helperKernelNeedsReady = false;
    if (!kernelId || !owned) {
      return;
    }
    try {
      await this.requestUrl('DELETE', kernelUrl(this.baseUrl, kernelId), undefined, undefined, {
        deadlineMs: Math.min(this.timeoutMs, 10000),
        skipSessionConfirmation: true
      });
    } catch {
      // Ignore kernel shutdown errors during cleanup.
    }
  }

  async renameContents(
    fromPath: string,
    toPath: string,
    signal?: AbortSignal
  ): Promise<void> {
    const source = normalizeRemotePath(fromPath);
    const target = normalizeRemotePath(toPath);
    if (!target) {
      throw new KaggleError('badRequest', '目标路径不能为空');
    }
    if (source === target) {
      return;
    }
    await this.requestUrl(
      'PATCH',
      this.contentsUrl(source),
      JSON.stringify({ path: target }),
      signal
    );
  }

  /**
   * Read a remote file as bytes. Text and notebook files are encoded as
   * UTF-8; binary files are decoded from the base64 Contents representation.
   */
  async readFile(remotePath: string, signal?: AbortSignal): Promise<Buffer> {
    const url = new URL(this.contentsUrl(remotePath));
    url.searchParams.set('content', '1');
    const model = await this.requestUrl('GET', url.toString(), undefined, signal, {
      maxResponseBytes: MAX_DOWNLOAD_BYTES
    });

    if (!model || typeof model !== 'object') {
      throw new KaggleError('badRequest', '文件返回内容无效');
    }

    const record = model as {
      type?: unknown;
      format?: unknown;
      content?: unknown;
      size?: unknown;
    };
    if (record.type === 'directory') {
      throw new KaggleError('badRequest', '这是一个目录，不能按文件读取');
    }
    // Jupytext stores notebook text (e.g. .py/.md) as a notebook model in
    // the Contents API. Read the raw file instead so users see and edit the
    // original source text rather than generated notebook JSON.
    if (record.type === 'notebook' && !/\.ipynb$/i.test(normalizeRemotePath(remotePath))) {
      return this.readRawFile(remotePath, signal);
    }
    if (record.content === null || record.content === undefined) {
      if (record.size === 0) {
        return Buffer.alloc(0);
      }
      throw new KaggleError('badRequest', '服务器没有返回文件内容');
    }

    if (record.format === 'base64') {
      if (typeof record.content !== 'string') {
        throw new KaggleError('badRequest', '无法解码 base64 文件内容');
      }
      return Buffer.from(record.content, 'base64');
    }

    if (record.type === 'notebook' || record.format === 'json') {
      const text =
        typeof record.content === 'string'
          ? record.content
          : JSON.stringify(record.content, null, 2);
      return Buffer.from(text.endsWith('\n') ? text : `${text}\n`, 'utf8');
    }

    if (typeof record.content === 'string') {
      return Buffer.from(record.content, 'utf8');
    }

    throw new KaggleError('badRequest', '无法识别文件内容格式');
  }

  /**
   * Download a remote file, preferring Jupyter's /files raw stream for large
   * regular files (to avoid base64 expansion and server-side JSON buffering),
   * and falling back to the Contents API when /files is unavailable.
   */
  async downloadFile(remotePath: string, options: DownloadFileOptions = {}): Promise<Buffer> {
    const canTryRaw =
      options.type === 'file' &&
      typeof options.sizeHint === 'number' &&
      options.sizeHint >= RAW_DOWNLOAD_THRESHOLD_BYTES &&
      !HTML_LIKE_FILE_RE.test(normalizeRemotePath(remotePath));

    if (canTryRaw) {
      const { url, response } = await this.requestRaw(remotePath, options.signal);
      const contentType = String(response.headers['content-type'] ?? '');
      if (response.status >= 200 && response.status < 300) {
        if (!looksLikeHtmlResponse(contentType, response.body)) {
          return response.body;
        }
        return this.readFile(remotePath, options.signal);
      }

      if (
        (response.status >= 300 && response.status < 400) ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 405 ||
        response.status === 501
      ) {
        return this.readFile(remotePath, options.signal);
      }

      throw classifyHttpError({
        status: response.status,
        statusText: response.statusText,
        body: response.body.toString('utf8'),
        url,
        location:
          typeof response.headers.location === 'string' ? response.headers.location : undefined,
        contentType
      });
    }

    return this.readFile(remotePath, options.signal);
  }

  /**
   * Read raw bytes from Jupyter's /files endpoint. Used for Jupytext text
   * notebooks, where the Contents API would return a converted notebook
   * model instead of the file's original source text.
   */
  async readRawFile(remotePath: string, signal?: AbortSignal): Promise<Buffer> {
    const { url, response } = await this.requestRaw(remotePath, signal);
    if (response.status >= 200 && response.status < 300) {
      return response.body;
    }
    const bodyText = response.body.toString('utf8');
    const contentType = String(response.headers['content-type'] ?? '');
    const classified = classifyHttpError({
      status: response.status,
      statusText: response.statusText,
      body: bodyText,
      url,
      location:
        typeof response.headers.location === 'string' ? response.headers.location : undefined,
      contentType
    });
    if (classified.kind === 'notFound') {
      if (!isJsonHttpResponse(contentType, bodyText)) {
        await this.confirmSessionAlive(signal);
      }
      throw new KaggleError('notFound', '远端文件不存在（HTTP 404）', {
        status: 404,
        detail: bodyText.slice(0, 200),
        hint: '文件可能已被删除，或当前 Jupyter 服务器不支持 /files 原始文件接口。'
      });
    }
    this.lastSessionConfirmedAt = 0;
    throw classified;
  }

  private async requestRaw(remotePath: string, signal?: AbortSignal) {
    const url = filesUrl(this.baseUrl, remotePath);
    const headers: Record<string, string> = { Accept: '*/*' };
    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }
    const startedAt = Date.now();
    let response;
    try {
      response = await httpRequest(url, {
        method: 'GET',
        headers,
        proxy: this.proxy,
        timeoutMs: this.timeoutMs,
        signal,
        maxResponseBytes: MAX_DOWNLOAD_BYTES
      });
    } catch (error) {
      throw classifyNetworkError(error);
    }
    this.updateClockOffset(response.headers.date, startedAt, Date.now());
    return { url, response };
  }

  /**
   * Create every directory level in order. Jupyter's PUT directory uses
   * os.mkdir (one level only), so "a/b/c" must be created as a, then a/b, ...
   */
  async ensureDirectories(directories: readonly string[], signal?: AbortSignal): Promise<void> {
    const all = new Set<string>();
    for (const directory of directories) {
      const parts = normalizeRemotePath(directory).split('/').filter(Boolean);
      for (let index = 1; index <= parts.length; index += 1) {
        all.add(parts.slice(0, index).join('/'));
      }
    }

    const ordered = [...all].sort((left, right) => {
      const depth = left.split('/').length - right.split('/').length;
      return depth !== 0 ? depth : left.localeCompare(right);
    });

    for (const directory of ordered) {
      if (signal?.aborted) {
        throw new KaggleError('cancelled', '上传已取消');
      }
      await this.putDirectory(directory, signal);
    }
  }

  /**
   * Kaggle server clock minus local clock, learned from HTTP Date headers.
   * Used to compare remote file timestamps without assuming clock sync.
   */
  getClockOffsetMs(): number {
    return this.clockOffsetMs;
  }

  private contentsUrl(remotePath: string): string {
    return contentsUrl(this.baseUrl, remotePath);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }
    return headers;
  }

  private updateClockOffset(
    dateHeader: string | string[] | undefined,
    startedAt: number,
    receivedAt: number
  ): void {
    const value = Array.isArray(dateHeader) ? dateHeader[0] : dateHeader;
    if (!value) {
      return;
    }
    const serverTime = Date.parse(value);
    if (!Number.isFinite(serverTime)) {
      return;
    }
    // The Date header has one-second precision; add half the round trip to
    // approximate the server clock at response time.
    const roundTrip = Math.max(0, receivedAt - startedAt);
    this.clockOffsetMs = Math.round(serverTime + roundTrip / 2 - receivedAt);
  }

  /**
   * Kaggle's pod proxy rewrites 404 responses on subpaths to plain-text
   * "not found" both when a file does not exist and when a JWT is invalid.
   * Confirm against /api/status (coalesced & briefly cached) before treating
   * an ambiguous plain-text 404 as a missing path.
   */
  private async confirmSessionAlive(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new KaggleError('cancelled', '操作已取消');
    }
    if (Date.now() - this.lastSessionConfirmedAt < SESSION_CONFIRM_TTL_MS) {
      return;
    }
    if (!this.pendingSessionConfirm) {
      const tracked: Promise<void> = (async () => {
        try {
          await this.requestUrl('GET', statusUrl(this.baseUrl), undefined, undefined, {
            deadlineMs: Math.min(this.timeoutMs, 10000),
            skipSessionConfirmation: true
          });
          this.lastSessionConfirmedAt = Date.now();
        } catch (error) {
          this.lastSessionConfirmedAt = 0;
          throw error;
        }
      })().finally(() => {
        if (this.pendingSessionConfirm === tracked) {
          this.pendingSessionConfirm = undefined;
        }
      });
      this.pendingSessionConfirm = tracked;
    }

    const pending = this.pendingSessionConfirm;
    if (!signal) {
      return pending;
    }
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new KaggleError('cancelled', '操作已取消'));
      signal.addEventListener('abort', onAbort, { once: true });
      pending.then(
        () => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        },
        (error) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        }
      );
    });
  }

  private async requestUrl(
    method: string,
    url: string,
    body?: string,
    signal?: AbortSignal,
    options: { maxResponseBytes?: number; deadlineMs?: number; skipSessionConfirmation?: boolean } = {}
  ): Promise<unknown> {
    let response;
    const startedAt = Date.now();
    try {
      response = await httpRequest(url, {
        method,
        headers: this.headers(),
        body,
        proxy: this.proxy,
        timeoutMs: this.timeoutMs,
        deadlineMs: options.deadlineMs,
        signal,
        maxResponseBytes: options.maxResponseBytes
      });
    } catch (error) {
      this.lastSessionConfirmedAt = 0;
      throw classifyNetworkError(error);
    }
    this.updateClockOffset(response.headers.date, startedAt, Date.now());

    const text = response.body.toString('utf8');
    const contentType = String(response.headers['content-type'] ?? '');
    const trimmed = text.trimStart();

    if (response.status >= 200 && response.status < 300) {
      if (!text) {
        return undefined;
      }
      if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          this.lastSessionConfirmedAt = 0;
          throw nonJsonError(url, text, response.status);
        }
      }
      if (trimmed.startsWith('<')) {
        this.lastSessionConfirmedAt = 0;
        throw nonJsonError(url, text, response.status);
      }
      return text;
    }

    const classified = classifyHttpError({
      status: response.status,
      statusText: response.statusText,
      body: text,
      url,
      location: typeof response.headers.location === 'string' ? response.headers.location : undefined,
      contentType
    });
    if (
      classified.kind === 'notFound' &&
      !options.skipSessionConfirmation &&
      !isJsonHttpResponse(contentType, text)
    ) {
      await this.confirmSessionAlive(signal);
      throw classified;
    }
    if (classified.kind !== 'notFound') {
      this.lastSessionConfirmedAt = 0;
    }
    throw classified;
  }

  private async deleteViaKernel(remotePath: string, signal?: AbortSignal): Promise<void> {
    const parts = normalizeRemotePath(remotePath).split('/').filter(Boolean);
    if (parts.length === 0) {
      throw new KaggleError('badRequest', '不支持通过内核回退删除 Jupyter 根目录');
    }

    const code = buildKernelDeleteCode(parts);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this.helperKernelIdleTimer) {
        clearTimeout(this.helperKernelIdleTimer);
        this.helperKernelIdleTimer = undefined;
      }
      const kernelId = await this.ensureHelperKernel(signal);
      const waitForReady = this.helperKernelNeedsReady;
      try {
        const result = await executePythonInKernel({
          channelsUrl: kernelChannelsUrl(this.baseUrl, kernelId),
          token: this.token,
          proxy: this.proxy,
          timeoutMs: this.timeoutMs,
          signal,
          code,
          waitForReady
        });
        this.helperKernelNeedsReady = false;
        this.scheduleHelperKernelCleanup();
        throwIfKernelDeleteFailed(result);
        return;
      } catch (error) {
        if (
          attempt === 0 &&
          !signal?.aborted &&
          error instanceof KaggleError &&
          (error.kind === 'notFound' || error.kind === 'network')
        ) {
          this.helperKernelId = undefined;
          this.helperKernelOwned = false;
          this.helperKernelNeedsReady = false;
          continue;
        }
        this.scheduleHelperKernelCleanup();
        throw error;
      }
    }
  }

  private scheduleHelperKernelCleanup(): void {
    if (this.helperKernelIdleTimer) {
      clearTimeout(this.helperKernelIdleTimer);
      this.helperKernelIdleTimer = undefined;
    }
    if (!this.helperKernelId || !this.helperKernelOwned) {
      return;
    }
    this.helperKernelIdleTimer = setTimeout(() => {
      this.helperKernelIdleTimer = undefined;
      void this.dispose();
    }, HELPER_KERNEL_IDLE_MS);
    this.helperKernelIdleTimer.unref?.();
  }

  private async ensureHelperKernel(signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) {
      throw new KaggleError('cancelled', '操作已取消');
    }
    if (this.helperKernelId) {
      return this.helperKernelId;
    }
    if (this.helperKernelInFlight) {
      return this.helperKernelInFlight;
    }

    const start = (async (): Promise<string> => {
      const specName = await this.pickPythonKernelSpec(signal);
      try {
        const payload = specName ? JSON.stringify({ name: specName }) : JSON.stringify({});
        const created = (await this.requestUrl(
          'POST',
          kernelsUrl(this.baseUrl),
          payload,
          signal
        )) as { id?: unknown } | undefined;
        const id = typeof created?.id === 'string' ? created.id : '';
        if (!id) {
          throw new KaggleError('unknown', '未能创建用于回退删除的 Jupyter 内核');
        }
        this.helperKernelId = id;
        this.helperKernelOwned = true;
        this.helperKernelNeedsReady = true;
        return id;
      } catch (error) {
        if (isSessionError(error) || (error instanceof KaggleError && error.kind === 'cancelled')) {
          throw error;
        }
        const existingId = await this.findIdlePythonKernel(signal);
        if (existingId) {
          this.helperKernelId = existingId;
          this.helperKernelOwned = false;
          this.helperKernelNeedsReady = false;
          return existingId;
        }
        throw error;
      }
    })().finally(() => {
      if (this.helperKernelInFlight === start) {
        this.helperKernelInFlight = undefined;
      }
    });

    this.helperKernelInFlight = start;
    return start;
  }

  private async pickPythonKernelSpec(signal?: AbortSignal): Promise<string | undefined> {
    try {
      const raw = (await this.requestUrl(
        'GET',
        kernelspecsUrl(this.baseUrl),
        undefined,
        signal,
        { deadlineMs: Math.min(this.timeoutMs, 10000) }
      )) as {
        default?: unknown;
        kernelspecs?: Record<string, { spec?: { language?: unknown } }>;
      } | undefined;
      const specs = raw?.kernelspecs;
      if (!specs || typeof specs !== 'object') {
        return 'python3';
      }
      if ('python3' in specs) {
        return 'python3';
      }
      const def = typeof raw?.default === 'string' ? raw.default : undefined;
      if (def && /python/i.test(String(specs[def]?.spec?.language ?? ''))) {
        return def;
      }
      for (const [name, entry] of Object.entries(specs)) {
        if (/python/i.test(String(entry?.spec?.language ?? ''))) {
          return name;
        }
      }
      return def;
    } catch {
      return 'python3';
    }
  }

  private async findIdlePythonKernel(signal?: AbortSignal): Promise<string | undefined> {
    try {
      const list = await this.listKernels(signal);
      const candidate =
        list.find(
          (item) =>
            item.executionState === 'idle' &&
            /python/i.test(item.name)
        ) ??
        list.find((item) => item.executionState === 'idle');
      return candidate?.id;
    } catch {
      return undefined;
    }
  }
}

function shouldFallbackKernelDelete(error: unknown): boolean {
  if (!(error instanceof KaggleError) || error.kind !== 'badRequest' || error.status !== 400) {
    return false;
  }
  if (/工作目录非空/.test(error.message)) {
    return false;
  }
  const detail = (error.detail ?? '').trim();
  return /^not found$/i.test(detail) || /send2trash|trash/i.test(detail);
}

function buildKernelDeleteCode(parts: readonly string[]): string {
  const partsJson = JSON.stringify(parts);
  return [
    'def _kc_del():',
    '    import json, os, re, shutil',
    `    parts = ${partsJson}`,
    '    if not parts or any(p in ("", ".", "..") or "/" in p or "\\\\" in p for p in parts):',
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "error": "invalid path"}))',
    '        return',
    '    root = None',
    '    try:',
    '        with open(f"/proc/{os.getppid()}/cmdline", "rb") as f:',
    '            args = [a.decode("utf-8", "ignore") for a in f.read().split(b"\\x00") if a]',
    '        for i, arg in enumerate(args):',
    '            m = re.match(r"^--(?:NotebookApp\\.notebook_dir|ServerApp\\.root_dir)=(.+)$", arg)',
    '            if m:',
    '                root = m.group(1)',
    '                break',
    '            if arg in ("--NotebookApp.notebook_dir", "--ServerApp.root_dir") and i + 1 < len(args):',
    '                root = args[i + 1]',
    '                break',
    '    except Exception:',
    '        pass',
    '    root = os.path.realpath(root or os.getcwd())',
    '    target = os.path.abspath(os.path.join(root, *parts))',
    '    parent_real = os.path.realpath(os.path.dirname(target))',
    '    if os.path.commonpath([root, target]) != root or os.path.commonpath([root, parent_real]) != root or target == root:',
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "error": "target outside working root"}))',
    '        return',
    '    if not os.path.lexists(target):',
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "notFound": True}))',
    '        return',
    '    try:',
    '        if os.path.isdir(target) and not os.path.islink(target):',
    '            shutil.rmtree(target)',
    '        else:',
    '            os.unlink(target)',
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": True}))',
    '    except Exception as exc:',
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "error": str(exc)}))',
    'try:',
    '    _kc_del()',
    'finally:',
    '    globals().pop("_kc_del", None)'
  ].join('\n');
}

function throwIfKernelDeleteFailed(result: {
  stdout: string;
  stderr: string;
  errorName?: string;
  errorValue?: string;
}): void {
  const lines = result.stdout.split(/\r?\n/).reverse();
  const markerLine = lines.find((line) => line.startsWith(KERNEL_DELETE_MARKER));
  if (markerLine) {
    let payload: { ok?: unknown; notFound?: unknown; error?: unknown };
    try {
      payload = JSON.parse(markerLine.slice(KERNEL_DELETE_MARKER.length)) as {
        ok?: unknown;
        notFound?: unknown;
        error?: unknown;
      };
    } catch {
      throw new KaggleError('unknown', '内核删除返回内容无效', {
        detail: markerLine.slice(0, 200)
      });
    }
    if (payload.ok === true) {
      return;
    }
    if (payload.notFound === true) {
      throw new KaggleError('notFound', '远程路径不存在（HTTP 404）', {
        status: 404,
        detail: 'not found'
      });
    }
    const detail = typeof payload.error === 'string' ? payload.error : '远端删除失败';
    throw new KaggleError('badRequest', `远端删除失败：${detail}`, { detail });
  }

  if (result.errorName) {
    throw new KaggleError('badRequest', `内核删除失败：${result.errorName}`, {
      detail: result.errorValue
    });
  }

  throw new KaggleError('unknown', '内核未返回删除结果', {
    detail: (result.stderr || result.stdout).slice(0, 200)
  });
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function looksLikeHtmlResponse(contentType: string, body: Buffer): boolean {
  if (/html/i.test(contentType)) {
    return true;
  }
  if (!contentType && body.length > 0 && body.length < 64 * 1024) {
    const prefix = body.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
    return prefix.startsWith('<!doctype html') || prefix.startsWith('<html');
  }
  return false;
}
