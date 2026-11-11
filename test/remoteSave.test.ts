import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemoteUploadQueue } from '../src/remoteSave';

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function recordingQueue(
  uploads: string[],
  options: { debounceMs: number; maxDelayMs: number; debounce?: boolean }
): RemoteUploadQueue {
  return new RemoteUploadQueue({
    upload: async (key, content) => {
      uploads.push(`${key}:${Buffer.from(content).toString('utf8')}`);
    },
    shouldDebounce: () => options.debounce !== false,
    getDebounceMs: () => options.debounceMs,
    getMaxDelayMs: () => options.maxDelayMs
  });
}

test('immediate mode uploads every write', async () => {
  const uploads: string[] = [];
  const queue = recordingQueue(uploads, {
    debounceMs: 1000,
    maxDelayMs: 60000,
    debounce: false
  });
  await queue.write('a', text('one'));
  await queue.write('a', text('two'));
  assert.deepEqual(uploads, ['a:one', 'a:two']);
  queue.dispose();
});

test('debounce coalesces rapid writes and uploads the latest content', async () => {
  const uploads: string[] = [];
  const queue = recordingQueue(uploads, { debounceMs: 30, maxDelayMs: 1000 });
  const first = queue.write('a', text('one'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  const second = queue.write('a', text('two'));
  await Promise.all([first, second]);
  assert.deepEqual(uploads, ['a:two']);
  queue.dispose();
});

test('max delay forces an upload while writes keep resetting the debounce', async () => {
  const uploads: string[] = [];
  let resolveFirstUpload: (() => void) | undefined;
  const firstUpload = new Promise<void>((resolve) => {
    resolveFirstUpload = resolve;
  });
  const queue = new RemoteUploadQueue({
    upload: async (key, content) => {
      uploads.push(`${key}:${Buffer.from(content).toString('utf8')}`);
      resolveFirstUpload?.();
      resolveFirstUpload = undefined;
    },
    shouldDebounce: () => true,
    getDebounceMs: () => 1000,
    getMaxDelayMs: () => 40
  });

  const writes: Array<Promise<void>> = [];
  const started = Date.now();
  const interval = setInterval(() => {
    writes.push(queue.write('a', text('tick')));
  }, 5);

  await Promise.race([
    firstUpload,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('max delay did not fire')), 500)
    )
  ]);
  clearInterval(interval);
  assert.ok(Date.now() - started < 300, 'max delay upload fired too late');
  assert.ok(uploads.length >= 1);

  queue.dispose();
  await Promise.allSettled(writes);
});

test('upload failures reject all coalesced writes', async () => {
  let calls = 0;
  const queue = new RemoteUploadQueue({
    upload: async () => {
      calls += 1;
      throw new Error('boom');
    },
    shouldDebounce: () => true,
    getDebounceMs: () => 10,
    getMaxDelayMs: () => 1000
  });
  const first = queue.write('a', text('one'));
  const second = queue.write('a', text('two'));
  const results = await Promise.allSettled([first, second]);
  assert.deepEqual(
    results.map((result) => result.status),
    ['rejected', 'rejected']
  );
  assert.equal(calls, 1);
  queue.dispose();
});

test('different files upload independently', async () => {
  const uploads: string[] = [];
  const queue = recordingQueue(uploads, { debounceMs: 10, maxDelayMs: 1000 });
  await Promise.all([queue.write('a', text('one')), queue.write('b', text('two'))]);
  assert.deepEqual(uploads.sort(), ['a:one', 'b:two']);
  queue.dispose();
});

test('writeNow flushes pending content immediately and resolves all waiters', async () => {
  const uploads: string[] = [];
  const queue = recordingQueue(uploads, { debounceMs: 1000, maxDelayMs: 60000 });
  const first = queue.write('a', text('one'));
  const second = queue.writeNow('a', text('two'));
  await Promise.all([first, second]);
  assert.deepEqual(uploads, ['a:two']);
  queue.dispose();
});

test('flushAll uploads every pending file', async () => {
  const uploads: string[] = [];
  const queue = recordingQueue(uploads, { debounceMs: 1000, maxDelayMs: 60000 });
  const first = queue.write('a', text('one'));
  const second = queue.write('b', text('two'));
  await queue.flushAll();
  await Promise.all([first, second]);
  assert.deepEqual(uploads.sort(), ['a:one', 'b:two']);
  queue.dispose();
});
