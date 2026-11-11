import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import type { DownloadFileOptions, JupyterContentsEntry } from '../src/client';
import { KaggleError } from '../src/core/errors';
import { withRetries } from '../src/core/retry';
import { downloadRemoteDirectory, downloadRemoteSelections, type DownloadClient } from '../src/download';

interface MockEntrySpec {
  entries?: JupyterContentsEntry[];
  bytes?: Buffer;
  onList?: (attempt: number) => void | Promise<void>;
  onDownload?: (attempt: number, options?: DownloadFileOptions) => void | Promise<void>;
}

function createMemoryDownloadEnv(specs: Record<string, MockEntrySpec>) {
  const listAttempts = new Map<string, number>();
  const downloadAttempts = new Map<string, number>();
  const directories = new Set<string>();
  const files = new Map<string, Buffer>();
  const logs: string[] = [];

  const client: DownloadClient = {
    async listDirectory(remotePath: string, signal?: AbortSignal) {
      if (signal?.aborted) {
        throw new KaggleError('cancelled', '下载已取消');
      }
      const attempt = (listAttempts.get(remotePath) ?? 0) + 1;
      listAttempts.set(remotePath, attempt);
      const spec = specs[remotePath];
      if (spec?.onList) {
        await spec.onList(attempt);
      }
      return spec?.entries ?? [];
    },
    async downloadFile(remotePath: string, options?: DownloadFileOptions) {
      if (options?.signal?.aborted) {
        throw new KaggleError('cancelled', '下载已取消');
      }
      const attempt = (downloadAttempts.get(remotePath) ?? 0) + 1;
      downloadAttempts.set(remotePath, attempt);
      const spec = specs[remotePath];
      if (spec?.onDownload) {
        await spec.onDownload(attempt, options);
      }
      return spec?.bytes ?? Buffer.alloc(0);
    }
  };

  return {
    client,
    directories,
    files,
    logs,
    listAttempts,
    downloadAttempts,
    ensureDirectory: async (parts: readonly string[]) => {
      directories.add(parts.join('/'));
    },
    writeFile: async (parts: readonly string[], bytes: Buffer) => {
      files.set(parts.join('/'), bytes);
    }
  };
}

test('withRetries retries retryable errors and skips non-retryable errors', async () => {
  let attempts = 0;
  const retryLogs: number[] = [];
  const value = await withRetries(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new KaggleError('timeout', '请求超时', { retryable: true });
      }
      return 'ok';
    },
    2,
    undefined,
    {
      baseDelayMs: 1,
      jitterMs: 0,
      onRetry: (attempt) => retryLogs.push(attempt)
    }
  );
  assert.equal(value, 'ok');
  assert.deepEqual(retryLogs, [1, 2]);

  let authAttempts = 0;
  await assert.rejects(
    withRetries(
      async () => {
        authAttempts += 1;
        throw new KaggleError('auth', '401');
      },
      3,
      undefined,
      { baseDelayMs: 1, jitterMs: 0 }
    ),
    (error: unknown) => error instanceof KaggleError && error.kind === 'auth'
  );
  assert.equal(authAttempts, 1);
});

test('downloadRemoteDirectory downloads nested files, preserves empty dirs and skips system entries', async () => {
  const env = createMemoryDownloadEnv({
    news_recommender: {
      entries: [
        { name: '.ipynb_checkpoints', path: 'news_recommender/.ipynb_checkpoints', type: 'directory' },
        { name: 'empty_dir', path: 'news_recommender/empty_dir', type: 'directory' },
        { name: 'cache', path: 'news_recommender/cache', type: 'directory' },
        { name: 'main:1.py', path: 'news_recommender/main:1.py', type: 'file', size: 5 }
      ]
    },
    'news_recommender/empty_dir': { entries: [] },
    'news_recommender/cache': {
      entries: [
        { name: 'sim.pkl', path: 'news_recommender/cache/sim.pkl', type: 'file', size: 4 }
      ]
    },
    'news_recommender/main:1.py': { bytes: Buffer.from('print', 'utf8') },
    'news_recommender/cache/sim.pkl': { bytes: Buffer.from([1, 2, 3, 4]) }
  });

  const controller = new AbortController();
  const summary = await downloadRemoteDirectory({
    client: env.client,
    remotePath: 'news_recommender',
    concurrency: 4,
    retryCount: 2,
    signal: controller.signal,
    ensureDirectory: env.ensureDirectory,
    writeFile: env.writeFile,
    log: (msg) => env.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(summary.total, 2);
  assert.equal(summary.downloaded, 2);
  assert.equal(summary.failed, 0);
  assert.equal(summary.cancelled, false);
  assert.equal(summary.sessionExpired, false);
  assert.ok(env.directories.has(''));
  assert.ok(env.directories.has('empty_dir'));
  assert.ok(env.directories.has('cache'));
  assert.equal(env.files.get('main_1.py')?.toString('utf8'), 'print');
  assert.deepEqual([...(env.files.get('cache/sim.pkl') ?? [])], [1, 2, 3, 4]);
});

test('downloadRemoteDirectory retries transient timeouts during scan and download', async () => {
  const env = createMemoryDownloadEnv({
    news_recommender: {
      onList: (attempt) => {
        if (attempt === 1) {
          throw new KaggleError('timeout', '请求超时', { retryable: true });
        }
      },
      entries: [
        { name: 'a.bin', path: 'news_recommender/a.bin', type: 'file', size: 2 * 1024 * 1024 }
      ]
    },
    'news_recommender/a.bin': {
      bytes: Buffer.from('recovered'),
      onDownload: (attempt, options) => {
        assert.equal(options?.type, 'file');
        assert.equal(options?.sizeHint, 2 * 1024 * 1024);
        if (attempt <= 2) {
          throw new KaggleError('timeout', '请求超时', { retryable: true });
        }
      }
    }
  });

  const summary = await downloadRemoteDirectory({
    client: env.client,
    remotePath: 'news_recommender',
    concurrency: 4,
    retryCount: 2,
    signal: new AbortController().signal,
    ensureDirectory: env.ensureDirectory,
    writeFile: env.writeFile,
    log: (msg) => env.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(summary.downloaded, 1);
  assert.equal(summary.failed, 0);
  assert.equal(env.listAttempts.get('news_recommender'), 2);
  assert.equal(env.downloadAttempts.get('news_recommender/a.bin'), 3);
  assert.equal(env.files.get('a.bin')?.toString('utf8'), 'recovered');
});

test('downloadRemoteDirectory serializes huge files (>= 50 MB) without stalling small files', async () => {
  let activeHuge = 0;
  let maxActiveHuge = 0;
  let smallFinishedWhileHugeRunning = false;

  const env = createMemoryDownloadEnv({
    root: {
      entries: [
        { name: 'huge1.bin', path: 'root/huge1.bin', type: 'file', size: 60 * 1024 * 1024 },
        { name: 'huge2.bin', path: 'root/huge2.bin', type: 'file', size: 60 * 1024 * 1024 },
        { name: 'small.txt', path: 'root/small.txt', type: 'file', size: 10 }
      ]
    },
    'root/huge1.bin': {
      bytes: Buffer.from('h1'),
      onDownload: async () => {
        activeHuge += 1;
        maxActiveHuge = Math.max(maxActiveHuge, activeHuge);
        await new Promise((resolve) => setTimeout(resolve, 25));
        activeHuge -= 1;
      }
    },
    'root/huge2.bin': {
      bytes: Buffer.from('h2'),
      onDownload: async () => {
        activeHuge += 1;
        maxActiveHuge = Math.max(maxActiveHuge, activeHuge);
        await new Promise((resolve) => setTimeout(resolve, 25));
        activeHuge -= 1;
      }
    },
    'root/small.txt': {
      bytes: Buffer.from('ok'),
      onDownload: () => {
        if (activeHuge > 0) {
          smallFinishedWhileHugeRunning = true;
        }
      }
    }
  });

  const summary = await downloadRemoteDirectory({
    client: env.client,
    remotePath: 'root',
    concurrency: 3,
    retryCount: 0,
    signal: new AbortController().signal,
    ensureDirectory: env.ensureDirectory,
    writeFile: env.writeFile,
    log: (msg) => env.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(summary.downloaded, 3);
  assert.equal(maxActiveHuge, 1);
  assert.equal(smallFinishedWhileHugeRunning, true);
});

test('downloadRemoteDirectory isolates isolated failures and aborts on 3 consecutive connection failures', async () => {
  const envPartial = createMemoryDownloadEnv({
    root: {
      entries: [
        { name: 'bad.bin', path: 'root/bad.bin', type: 'file', size: 10 },
        { name: 'good.txt', path: 'root/good.txt', type: 'file', size: 5 }
      ]
    },
    'root/bad.bin': {
      onDownload: () => {
        throw new KaggleError('unknown', '服务器响应过大');
      }
    },
    'root/good.txt': { bytes: Buffer.from('hello') }
  });

  const partial = await downloadRemoteDirectory({
    client: envPartial.client,
    remotePath: 'root',
    concurrency: 1,
    retryCount: 1,
    signal: new AbortController().signal,
    ensureDirectory: envPartial.ensureDirectory,
    writeFile: envPartial.writeFile,
    log: (msg) => envPartial.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(partial.downloaded, 1);
  assert.equal(partial.failed, 1);
  assert.equal(partial.abortedByConnection, false);
  assert.equal(partial.failures[0].remotePath, 'root/bad.bin');

  const envDead = createMemoryDownloadEnv({
    root: {
      entries: [
        { name: '1.txt', path: 'root/1.txt', type: 'file', size: 1 },
        { name: '2.txt', path: 'root/2.txt', type: 'file', size: 1 },
        { name: '3.txt', path: 'root/3.txt', type: 'file', size: 1 },
        { name: '4.txt', path: 'root/4.txt', type: 'file', size: 1 },
        { name: '5.txt', path: 'root/5.txt', type: 'file', size: 1 }
      ]
    },
    'root/1.txt': { onDownload: () => { throw new KaggleError('timeout', '请求超时', { retryable: true }); } },
    'root/2.txt': { onDownload: () => { throw new KaggleError('timeout', '请求超时', { retryable: true }); } },
    'root/3.txt': { onDownload: () => { throw new KaggleError('timeout', '请求超时', { retryable: true }); } },
    'root/4.txt': { bytes: Buffer.from('4') },
    'root/5.txt': { bytes: Buffer.from('5') }
  });

  const dead = await downloadRemoteDirectory({
    client: envDead.client,
    remotePath: 'root',
    concurrency: 1,
    retryCount: 0,
    signal: new AbortController().signal,
    ensureDirectory: envDead.ensureDirectory,
    writeFile: envDead.writeFile,
    log: (msg) => envDead.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(dead.abortedByConnection, true);
  assert.equal(dead.failed, 3);
  assert.equal(dead.skipped, 2);
  assert.equal(envDead.downloadAttempts.has('root/4.txt'), false);
});

test('downloadRemoteDirectory aborts immediately on session error or user cancellation', async () => {
  const envAuth = createMemoryDownloadEnv({
    root: {
      entries: [
        { name: '1.txt', path: 'root/1.txt', type: 'file', size: 1 },
        { name: '2.txt', path: 'root/2.txt', type: 'file', size: 1 }
      ]
    },
    'root/1.txt': {
      onDownload: () => {
        throw new KaggleError('auth', '401');
      }
    },
    'root/2.txt': { bytes: Buffer.from('2') }
  });

  const authResult = await downloadRemoteDirectory({
    client: envAuth.client,
    remotePath: 'root',
    concurrency: 1,
    retryCount: 2,
    signal: new AbortController().signal,
    ensureDirectory: envAuth.ensureDirectory,
    writeFile: envAuth.writeFile,
    log: (msg) => envAuth.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(authResult.sessionExpired, true);
  assert.equal(authResult.cancelled, false);
  assert.equal(authResult.skipped, 1);
  assert.equal(envAuth.downloadAttempts.get('root/1.txt'), 1);

  const controller = new AbortController();
  const envCancel = createMemoryDownloadEnv({
    root: {
      entries: [
        { name: '1.txt', path: 'root/1.txt', type: 'file', size: 1 },
        { name: '2.txt', path: 'root/2.txt', type: 'file', size: 1 }
      ]
    },
    'root/1.txt': {
      bytes: Buffer.from('1'),
      onDownload: () => {
        controller.abort();
      }
    },
    'root/2.txt': { bytes: Buffer.from('2') }
  });

  const cancelResult = await downloadRemoteDirectory({
    client: envCancel.client,
    remotePath: 'root',
    concurrency: 1,
    retryCount: 0,
    signal: controller.signal,
    ensureDirectory: envCancel.ensureDirectory,
    writeFile: envCancel.writeFile,
    log: (msg) => envCancel.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(cancelResult.cancelled, true);
  assert.equal(cancelResult.sessionExpired, false);
  assert.equal(envCancel.downloadAttempts.has('root/2.txt'), false);
});

test('package.json requestTimeoutMs default stays at 120000 ms', () => {
  const manifestPath = path.resolve(__dirname, '..', 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    contributes: {
      configuration: {
        properties: Record<string, { default?: number; minimum?: number }>;
      };
    };
  };
  const prop = manifest.contributes.configuration.properties['kaggleConnector.requestTimeoutMs'];
  assert.equal(prop.default, 120000);
  assert.equal(prop.minimum, 5000);
});

test('downloadRemoteSelections downloads mixed files and directories with collision subfolders', async () => {
  const env = createMemoryDownloadEnv({
    'root/models': {
      entries: [
        { name: 'weights.bin', path: 'root/models/weights.bin', type: 'file', size: 4 }
      ]
    },
    'root/models/weights.bin': { bytes: Buffer.from('w123') },
    'root/a/utils.py': { bytes: Buffer.from('a-utils') },
    'root/b/utils.py': { bytes: Buffer.from('b-utils') }
  });

  const summary = await downloadRemoteSelections({
    client: env.client,
    entries: [
      { remotePath: 'root/models', relativeParts: ['models'], type: 'directory' },
      { remotePath: 'root/a/utils.py', relativeParts: ['a', 'utils.py'], type: 'file', size: 7 },
      { remotePath: 'root/b/utils.py', relativeParts: ['b', 'utils.py'], type: 'file', size: 7 }
    ],
    concurrency: 3,
    retryCount: 1,
    signal: new AbortController().signal,
    ensureDirectory: env.ensureDirectory,
    writeFile: env.writeFile,
    log: (msg) => env.logs.push(msg),
    retryOptions: { baseDelayMs: 1, jitterMs: 0 }
  });

  assert.equal(summary.total, 3);
  assert.equal(summary.downloaded, 3);
  assert.equal(summary.failed, 0);
  assert.ok(env.directories.has('models'));
  assert.ok(env.directories.has('a'));
  assert.ok(env.directories.has('b'));
  assert.equal(env.files.get('models/weights.bin')?.toString('utf8'), 'w123');
  assert.equal(env.files.get('a/utils.py')?.toString('utf8'), 'a-utils');
  assert.equal(env.files.get('b/utils.py')?.toString('utf8'), 'b-utils');
});
