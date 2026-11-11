import type { DownloadFileOptions, JupyterContentsEntry } from './client';
import {
  describeError,
  isConnectionError,
  isSessionError,
  KaggleError,
  shortError
} from './core/errors';
import { safeLocalName } from './core/remoteActions';
import { withRetries, type RetryOptions } from './core/retry';

export const SYSTEM_ENTRIES = new Set(['.ipynb_checkpoints', '.virtual_documents']);

const MAX_CONSECUTIVE_CONNECTION_ERRORS = 3;
const HUGE_FILE_BYTES = 50 * 1024 * 1024;
const LARGE_FILE_BYTES = 20 * 1024 * 1024;

export interface DownloadClient {
  listDirectory(remotePath: string, signal?: AbortSignal): Promise<JupyterContentsEntry[]>;
  downloadFile(remotePath: string, options?: DownloadFileOptions): Promise<Buffer>;
}

export interface DownloadPlan {
  remotePath: string;
  relativeParts: string[];
  type: 'file' | 'notebook';
  size?: number;
}

export interface DownloadFailure {
  remotePath: string;
  localPath: string;
  error: unknown;
}

export type DownloadProgressEvent =
  | {
      phase: 'scanning';
      directoriesScanned: number;
      filesFound: number;
      currentPath: string;
    }
  | {
      phase: 'downloading';
      completed: number;
      total: number;
      currentPath: string;
    };

export interface DownloadSummary {
  total: number;
  downloaded: number;
  failed: number;
  skipped: number;
  cancelled: boolean;
  sessionExpired: boolean;
  abortedByConnection: boolean;
  fatalError?: unknown;
  failures: DownloadFailure[];
}

export interface DownloadSelectionSeed {
  remotePath: string;
  relativeParts: readonly string[];
  type: 'file' | 'directory' | 'notebook';
  size?: number;
}

export interface DownloadDirectoryOptions {
  client: DownloadClient;
  remotePath: string;
  concurrency: number;
  retryCount: number;
  signal: AbortSignal;
  ensureDirectory: (relativeParts: readonly string[]) => Promise<void>;
  writeFile: (relativeParts: readonly string[], bytes: Buffer) => Promise<void>;
  formatLocalPath?: (relativeParts: readonly string[]) => string;
  onProgress?: (event: DownloadProgressEvent) => void;
  log: (message: string) => void;
  retryOptions?: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'jitterMs'>;
}

export interface DownloadSelectionsOptions extends Omit<DownloadDirectoryOptions, 'remotePath'> {
  entries: readonly DownloadSelectionSeed[];
}

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) {
        next();
      }
    }
  }
}

/**
 * Download a single remote directory tree with bounded concurrency, per-request
 * retries and failure isolation.
 */
export function downloadRemoteDirectory(
  options: DownloadDirectoryOptions
): Promise<DownloadSummary> {
  const { remotePath, ...rest } = options;
  return downloadRemoteSelections({
    ...rest,
    entries: [{ remotePath, relativeParts: [], type: 'directory' }]
  });
}

/**
 * Download one or more selected remote files/directories with bounded
 * concurrency, per-request retries and failure isolation.
 */
export async function downloadRemoteSelections(
  options: DownloadSelectionsOptions
): Promise<DownloadSummary> {
  const concurrency = Math.min(16, Math.max(1, Math.floor(options.concurrency)));
  const retryCount = Math.min(5, Math.max(0, Math.floor(options.retryCount)));
  const formatLocalPath =
    options.formatLocalPath ?? ((parts: readonly string[]) => parts.join('/'));

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (options.signal.aborted) {
    controller.abort();
  } else {
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  const files: DownloadPlan[] = [];
  const failures: DownloadFailure[] = [];
  let scanFailuresCount = 0;
  let directoriesScanned = 0;
  let downloaded = 0;
  let completed = 0;
  let sessionExpired = false;
  let abortedByConnection = false;
  let fatalError: unknown;
  let consecutiveConnectionErrors = 0;

  try {
    if (controller.signal.aborted) {
      return {
        total: 0,
        downloaded: 0,
        failed: 0,
        skipped: 0,
        cancelled: true,
        sessionExpired: false,
        abortedByConnection: false,
        failures: []
      };
    }

    await options.ensureDirectory([]);

    const singleRootDir =
      options.entries.length === 1 && options.entries[0].type === 'directory'
        ? options.entries[0].remotePath
        : undefined;

    const scanLimiter = new Semaphore(concurrency);
    const scanDirectory = async (
      remotePath: string,
      relativeParts: string[]
    ): Promise<void> => {
      if (controller.signal.aborted) {
        return;
      }

      let entries: JupyterContentsEntry[];
      try {
        entries = await scanLimiter.run(() =>
          withRetries(
            () => options.client.listDirectory(remotePath, controller.signal),
            retryCount,
            controller.signal,
            {
              cancelMessage: '下载已取消',
              ...options.retryOptions,
              onRetry: (attempt, error, delayMs) => {
                options.log(
                  `扫描目录失败，${delayMs} ms 后重试（${attempt}/${retryCount}）：${remotePath}：${shortError(error)}`
                );
              }
            }
          )
        );
        if (controller.signal.aborted) {
          return;
        }
        await options.ensureDirectory(relativeParts);
        consecutiveConnectionErrors = 0;
      } catch (error) {
        if (error instanceof KaggleError && error.kind === 'cancelled') {
          return;
        }
        scanFailuresCount += 1;
        failures.push({
          remotePath,
          localPath: formatLocalPath(relativeParts),
          error
        });
        options.log(`扫描目录失败: ${remotePath}: ${describeError(error)}`);

        if (isSessionError(error)) {
          sessionExpired = true;
          fatalError ??= error;
          controller.abort();
          return;
        }
        if (singleRootDir !== undefined && remotePath === singleRootDir) {
          fatalError = error;
          if (isConnectionError(error)) {
            abortedByConnection = true;
          }
          controller.abort();
          return;
        }
        if (isConnectionError(error)) {
          consecutiveConnectionErrors += 1;
          if (consecutiveConnectionErrors >= MAX_CONSECUTIVE_CONNECTION_ERRORS) {
            abortedByConnection = true;
            fatalError ??= error;
            controller.abort();
          }
        }
        return;
      }

      directoriesScanned += 1;
      const subdirs: Array<Promise<void>> = [];
      for (const entry of entries) {
        if (SYSTEM_ENTRIES.has(entry.name)) {
          continue;
        }
        const childParts = [...relativeParts, safeLocalName(entry.name)];
        if (entry.type === 'directory') {
          subdirs.push(scanDirectory(entry.path, childParts));
        } else {
          files.push({
            remotePath: entry.path,
            relativeParts: childParts,
            type: entry.type,
            size: entry.size
          });
        }
      }

      options.onProgress?.({
        phase: 'scanning',
        directoriesScanned,
        filesFound: files.length,
        currentPath: remotePath
      });

      if (subdirs.length > 0) {
        await Promise.all(subdirs);
      }
    };

    const ensuredParents = new Set<string>();
    const failedParents = new Map<string, unknown>();
    const scanSeeds: Array<Promise<void>> = [];
    for (const seed of options.entries) {
      if (controller.signal.aborted) {
        break;
      }
      if (seed.type === 'directory') {
        scanSeeds.push(scanDirectory(seed.remotePath, [...seed.relativeParts]));
        continue;
      }
      if (seed.relativeParts.length > 1) {
        const parentParts = seed.relativeParts.slice(0, -1);
        const parentKey = parentParts.join('\0');
        if (!ensuredParents.has(parentKey)) {
          ensuredParents.add(parentKey);
          try {
            await options.ensureDirectory(parentParts);
          } catch (error) {
            failedParents.set(parentKey, error);
            options.log(`创建本地目录失败: ${formatLocalPath(parentParts)}: ${describeError(error)}`);
          }
        }
        if (failedParents.has(parentKey)) {
          scanFailuresCount += 1;
          failures.push({
            remotePath: seed.remotePath,
            localPath: formatLocalPath(seed.relativeParts),
            error: failedParents.get(parentKey)
          });
          continue;
        }
      }
      files.push({
        remotePath: seed.remotePath,
        relativeParts: [...seed.relativeParts],
        type: seed.type,
        size: seed.size
      });
    }

    if (scanSeeds.length > 0) {
      await Promise.all(scanSeeds);
    }

    if (files.length > 0 && !controller.signal.aborted) {
      const hugeFileLimiter = new Semaphore(1);
      const largeFileLimiter = new Semaphore(2);
      const workerCount = Math.max(1, Math.min(concurrency, files.length));
      let cursor = 0;

      const downloadOne = async (file: DownloadPlan): Promise<void> => {
        const bytes = await withRetries(
          () =>
            options.client.downloadFile(file.remotePath, {
              signal: controller.signal,
              type: file.type,
              sizeHint: file.size
            }),
          retryCount,
          controller.signal,
          {
            cancelMessage: '下载已取消',
            ...options.retryOptions,
            onRetry: (attempt, error, delayMs) => {
              options.log(
                `下载失败，${delayMs} ms 后重试（${attempt}/${retryCount}）：${file.remotePath}：${shortError(error)}`
              );
            }
          }
        );
        if (controller.signal.aborted) {
          throw new KaggleError('cancelled', '下载已取消');
        }
        await options.writeFile(file.relativeParts, bytes);
      };

      const runWithSizeLimit = (file: DownloadPlan): Promise<void> => {
        if (file.size !== undefined && file.size >= HUGE_FILE_BYTES) {
          return hugeFileLimiter.run(() => downloadOne(file));
        }
        if (file.size !== undefined && file.size >= LARGE_FILE_BYTES) {
          return largeFileLimiter.run(() => downloadOne(file));
        }
        return downloadOne(file);
      };

      const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
          if (controller.signal.aborted) {
            return;
          }
          const index = cursor;
          cursor += 1;
          if (index >= files.length) {
            return;
          }

          const file = files[index];
          try {
            await runWithSizeLimit(file);
            downloaded += 1;
            consecutiveConnectionErrors = 0;
            options.log(`下载成功: ${file.remotePath}`);
          } catch (error) {
            if (!(error instanceof KaggleError && error.kind === 'cancelled')) {
              failures.push({
                remotePath: file.remotePath,
                localPath: formatLocalPath(file.relativeParts),
                error
              });
              options.log(`下载失败: ${file.remotePath}: ${describeError(error)}`);

              if (isSessionError(error)) {
                sessionExpired = true;
                fatalError ??= error;
                controller.abort();
              } else if (isConnectionError(error)) {
                consecutiveConnectionErrors += 1;
                if (consecutiveConnectionErrors >= MAX_CONSECUTIVE_CONNECTION_ERRORS) {
                  abortedByConnection = true;
                  fatalError ??= error;
                  controller.abort();
                }
              }
            }
          } finally {
            completed += 1;
            options.onProgress?.({
              phase: 'downloading',
              completed,
              total: files.length,
              currentPath: file.remotePath
            });
          }
        }
      });

      await Promise.all(workers);
    }
  } finally {
    options.signal.removeEventListener('abort', onAbort);
  }

  const total = files.length + scanFailuresCount;
  const failed = failures.length;
  const skipped = Math.max(0, total - downloaded - failed);
  const cancelled =
    options.signal.aborted && !sessionExpired && !abortedByConnection && fatalError === undefined;

  return {
    total,
    downloaded,
    failed,
    skipped,
    cancelled,
    sessionExpired,
    abortedByConnection,
    fatalError,
    failures
  };
}
