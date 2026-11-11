import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as http from 'node:http';
import { after, before, test } from 'node:test';
import { JupyterClient } from '../src/client';
import { KaggleError } from '../src/core/errors';

interface RecordedCall {
  method: string;
  path: string;
  query: string;
  body: string;
}

let server: http.Server;
let baseUrl: string;
let calls: RecordedCall[] = [];
let kernelExecutions: string[] = [];
let mockKernels: Array<{ id: string; name: string; execution_state?: string }> = [
  { id: 'k1', name: 'python3' }
];
let mode: 'ok' | 'unauthorized' | 'html' | 'redirect' | 'proxy404' | 'pod404-expired' | 'slow' | 'no-kernels' = 'ok';

before(async () => {
  server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(requestUrl.pathname);
      calls.push({
        method: request.method ?? '',
        path: pathname,
        query: requestUrl.search,
        body
      });

      if (mode === 'unauthorized') {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end('{"message":"Unauthorized"}');
        return;
      }
      if (mode === 'html') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<html>login</html>');
        return;
      }
      if (mode === 'redirect') {
        response.writeHead(302, { Location: '/login' });
        response.end();
        return;
      }
      if (mode === 'proxy404') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('404 page not found');
        return;
      }
      if (mode === 'pod404-expired') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('not found');
        return;
      }
      if (mode === 'slow') {
        // Simulate an expired link that hangs before answering.
        setTimeout(() => {
          if (response.destroyed || response.writableEnded) {
            return;
          }
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end('{"started":"2026-01-01T00:00:00.000Z"}');
        }, 300);
        return;
      }

      if (mode === 'no-kernels' && pathname.endsWith('/api/kernels')) {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end('{"message":"not found"}');
        return;
      }

      if (request.method === 'GET') {
        if (pathname.endsWith('/api/kernels')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(mockKernels));
          return;
        }
        if (pathname.endsWith('/api/kernelspecs')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              default: 'python3',
              kernelspecs: { python3: { name: 'python3', spec: { language: 'python' } } }
            })
          );
          return;
        }
        if (pathname.endsWith('/api/contents/missing')) {
          response.writeHead(404, { 'Content-Type': 'application/json' });
          response.end('{"message":"file or directory does not exist"}');
          return;
        }
        if (pathname.endsWith('/api/contents/missing-plain') || pathname.endsWith('/api/contents/missing-plain-2')) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('not found');
          return;
        }
        if (pathname.endsWith('/api/contents/notadir')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ type: 'file', path: 'notadir', writable: true }));
          return;
        }
        if (pathname.endsWith('/api/contents/models/jupytext.py')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              name: 'jupytext.py',
              path: 'models/jupytext.py',
              type: 'notebook',
              format: 'json',
              size: 12,
              writable: true,
              content: { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }
            })
          );
          return;
        }
        if (pathname.endsWith('/files/models/jupytext.py')) {
          response.writeHead(200, { 'Content-Type': 'text/x-python' });
          response.end('import math\n');
          return;
        }
        if (pathname.endsWith('/files/models/weights.bin')) {
          response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          response.end(Buffer.from([9, 8, 7, 6]));
          return;
        }
        if (pathname.endsWith('/files/models/fallback-404.bin')) {
          response.writeHead(404, { 'Content-Type': 'text/plain' });
          response.end('not found');
          return;
        }
        if (pathname.endsWith('/api/contents/models/fallback-404.bin')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              type: 'file',
              format: 'base64',
              content: Buffer.from([1, 2, 3]).toString('base64'),
              size: 3
            })
          );
          return;
        }
        if (pathname.endsWith('/files/models/fallback-403.bin')) {
          response.writeHead(403, { 'Content-Type': 'text/plain' });
          response.end('forbidden');
          return;
        }
        if (pathname.endsWith('/api/contents/models/fallback-403.bin')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              type: 'file',
              format: 'base64',
              content: Buffer.from([7, 8]).toString('base64'),
              size: 2
            })
          );
          return;
        }
        if (pathname.endsWith('/files/models/fallback-302.bin')) {
          response.writeHead(302, { Location: '/login' });
          response.end();
          return;
        }
        if (pathname.endsWith('/api/contents/models/fallback-302.bin')) {
          response.writeHead(302, { Location: '/login' });
          response.end();
          return;
        }
        if (pathname.endsWith('/files/models/fallback-html.bin')) {
          response.writeHead(200, { 'Content-Type': 'text/html' });
          response.end('<html>login</html>');
          return;
        }
        if (pathname.endsWith('/api/contents/models/fallback-html.bin')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              type: 'file',
              format: 'base64',
              content: Buffer.from([4, 5, 6]).toString('base64'),
              size: 3
            })
          );
          return;
        }
        if (pathname.endsWith('/files/models/auth-fail.bin')) {
          response.writeHead(401, { 'Content-Type': 'application/json' });
          response.end('{"message":"Unauthorized"}');
          return;
        }
        if (pathname.endsWith('/api/contents/models/page.html')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              type: 'file',
              format: 'text',
              content: '<h1>ok</h1>',
              size: 9
            })
          );
          return;
        }
        if (pathname.endsWith('/api/contents/file.txt')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              type: 'file',
              format: 'text',
              content: 'hello kaggle',
              size: 12
            })
          );
          return;
        }
        if (pathname.endsWith('/api/contents/bin.dat')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              type: 'file',
              format: 'base64',
              content: Buffer.from([0, 1, 2, 255]).toString('base64'),
              size: 4
            })
          );
          return;
        }
        if (pathname.endsWith('/api/contents/nb.ipynb')) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              type: 'notebook',
              format: 'json',
              content: { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 },
              size: 100
            })
          );
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            type: 'directory',
            path: pathname.endsWith('/api/contents/a') ? 'a' : '',
            writable: true,
            content: pathname.endsWith('/api/contents/a')
              ? [
                  {
                    name: 'b.py',
                    path: 'a/b.py',
                    type: 'file',
                    writable: true,
                    size: 11,
                    last_modified: '2026-11-11T07:00:00.123456Z',
                    hash: 'abc123',
                    hash_algorithm: 'sha256'
                  },
                  { name: 'sub', path: 'a/sub', type: 'directory', writable: true }
                ]
              : []
          })
        );
        return;
      }

      if (request.method === 'PUT') {
        response.writeHead(201, { 'Content-Type': 'application/json' });
        response.end('{}');
        return;
      }

      if (request.method === 'POST' && pathname.endsWith('/api/kernels')) {
        response.writeHead(201, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ id: 'helper-k1', name: 'python3' }));
        return;
      }

      if (request.method === 'DELETE') {
        if (
          pathname.endsWith('/api/contents/send2trash-fail') ||
          pathname.endsWith('/api/contents/send2trash-fail-2') ||
          pathname.endsWith('/api/contents/missing-in-kernel')
        ) {
          response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('not found');
          return;
        }
        if (pathname.endsWith('/api/contents/nonempty-dir')) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end('{"message":"Directory nonempty-dir not empty"}');
          return;
        }
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === 'PATCH') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{}');
        return;
      }

      response.writeHead(405);
      response.end();
    });
  });

  server.on('upgrade', (request, socket) => {
    const key = String(request.headers['sec-websocket-key'] ?? '');
    const accept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        ''
      ].join('\r\n')
    );

    const sendWsText = (obj: unknown) => {
      const payload = Buffer.from(JSON.stringify(obj), 'utf8');
      const header =
        payload.length < 126
          ? Buffer.from([0x81, payload.length])
          : Buffer.from([0x81, 126, (payload.length >> 8) & 0xff, payload.length & 0xff]);
      socket.write(Buffer.concat([header, payload]));
    };

    let buf = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const opcode = buf[0]! & 0x0f;
        const masked = (buf[1]! & 0x80) !== 0;
        let len = buf[1]! & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buf.length < 4) return;
          len = buf.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (buf.length < 10) return;
          len = Number(buf.readBigUInt64BE(2));
          off = 10;
        }
        const need = off + (masked ? 4 : 0) + len;
        if (buf.length < need) return;
        let payload = buf.subarray(off + (masked ? 4 : 0), need);
        if (masked) {
          const decoded = Buffer.allocUnsafe(len);
          for (let i = 0; i < len; i += 1) {
            decoded[i] = payload[i]! ^ buf[off + (i & 3)]!;
          }
          payload = decoded;
        }
        buf = buf.subarray(need);
        if (opcode === 0x8) {
          socket.end();
          return;
        }
        if (opcode !== 0x1) continue;
        const msg = JSON.parse(payload.toString('utf8')) as {
          header?: { msg_id?: string; msg_type?: string };
          content?: { code?: string };
        };
        const msgId = msg.header?.msg_id;
        if (msg.header?.msg_type === 'kernel_info_request') {
          sendWsText({ parent_header: { msg_id: msgId }, msg_type: 'kernel_info_reply', content: {} });
        } else if (msg.header?.msg_type === 'execute_request') {
          const code = msg.content?.code ?? '';
          kernelExecutions.push(code);
          let stdoutText: string;
          if (code.includes('_kc_set_cwd')) {
            const disabled = code.includes('enabled = False');
            const missingDir = code.includes('"missing_dir"');
            stdoutText = `__KC_CWD__:${JSON.stringify({
              ok: true,
              startupConfigured: !disabled,
              dirExists: !disabled && !missingDir,
              cwdChanged: !disabled && !missingDir,
              projPath: '/kaggle/working/news_recommender',
              startupPath: '/root/.ipython/profile_default/startup/00-kaggle-connector-cwd.py'
            })}\n`;
          } else {
            const isMissing = code.includes('"missing-in-kernel"');
            stdoutText = `__KC_DEL__:${JSON.stringify(isMissing ? { ok: false, notFound: true } : { ok: true })}\n`;
          }
          sendWsText({
            parent_header: { msg_id: msgId },
            msg_type: 'stream',
            content: {
              name: 'stdout',
              text: stdoutText
            }
          });
          sendWsText({ parent_header: { msg_id: msgId }, msg_type: 'execute_reply', content: { status: 'ok' } });
          sendWsText({
            parent_header: { msg_id: msgId },
            msg_type: 'status',
            content: { execution_state: 'idle' }
          });
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('mock server did not start');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function reset(nextMode: typeof mode = 'ok'): JupyterClient {
  calls = [];
  kernelExecutions = [];
  mockKernels = [{ id: 'k1', name: 'python3' }];
  mode = nextMode;
  return new JupyterClient(baseUrl, { timeoutMs: 5000 });
}

test('ensureDirectories creates every level in order', async () => {
  const client = reset();
  await client.ensureDirectories(['news_recommender/src/model']);

  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.path}`),
    [
      'PUT /api/contents/news_recommender',
      'PUT /api/contents/news_recommender/src',
      'PUT /api/contents/news_recommender/src/model'
    ]
  );
  assert.equal(JSON.parse(calls[0].body).type, 'directory');
});

test('putFile sends base64 content to the contents API', async () => {
  const client = reset();
  const bytes = Buffer.from('hello kaggle', 'utf8');
  await client.putFile('news_recommender/src/a.py', bytes);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].path, '/api/contents/news_recommender/src/a.py');
  const payload = JSON.parse(calls[0].body) as {
    type: string;
    format: string;
    content: string;
  };
  assert.equal(payload.type, 'file');
  assert.equal(payload.format, 'base64');
  assert.equal(Buffer.from(payload.content, 'base64').toString('utf8'), 'hello kaggle');
});

test('test reports existing and missing directories', async () => {
  const client = reset();
  assert.deepEqual(await client.test('a'), { exists: true, writable: true, path: 'a' });
  assert.deepEqual(await client.test('missing'), { exists: false, path: 'missing' });
});

test('listDirectory sorts directories first and maps entries', async () => {
  const client = reset();
  const entries = await client.listDirectory('a');
  assert.deepEqual(
    entries.map((entry) => `${entry.type}:${entry.name}`),
    ['directory:sub', 'file:b.py']
  );
  assert.equal(entries[0].path, 'a/sub');
  assert.equal(entries[1].writable, true);
  assert.equal(entries[1].size, 11);
  assert.equal(entries[1].lastModified, Date.parse('2026-11-11T07:00:00.123456Z'));
  assert.equal(entries[1].hash, 'abc123');
  assert.equal(entries[1].hashAlgorithm, 'sha256');
});

test('listDirectory can request hashes for upload preflight', async () => {
  const client = reset();
  await client.listDirectory('a', undefined, { hash: true });
  assert.match(calls[0].query, /content=1/);
  assert.match(calls[0].query, /hash=1/);
});

test('readFile decodes text, base64 and notebook content', async () => {
  const client = reset();

  assert.equal((await client.readFile('file.txt')).toString('utf8'), 'hello kaggle');
  assert.deepEqual([...(await client.readFile('bin.dat'))], [0, 1, 2, 255]);

  const notebook = JSON.parse((await client.readFile('nb.ipynb')).toString('utf8')) as {
    nbformat: number;
    cells: unknown[];
  };
  assert.equal(notebook.nbformat, 4);
  assert.deepEqual(notebook.cells, []);
});

test('readFile reads raw text for Jupytext notebooks', async () => {
  const client = reset();
  const content = await client.readFile('models/jupytext.py');
  assert.equal(content.toString('utf8'), 'import math\n');
  assert.ok(
    calls.some((call) => call.method === 'GET' && call.path === '/files/models/jupytext.py')
  );
});

test('deleteContents and renameContents use DELETE and PATCH', async () => {
  const client = reset();
  await client.deleteContents('a/b.py');
  await client.renameContents('a/b.py', 'a/c.py');

  const removed = calls.find((call) => call.method === 'DELETE');
  const renamed = calls.find((call) => call.method === 'PATCH');
  assert.equal(removed?.path, '/api/contents/a/b.py');
  assert.equal(renamed?.path, '/api/contents/a/b.py');
  assert.deepEqual(JSON.parse(renamed?.body ?? '{}'), { path: 'a/c.py' });
});

test('test rejects a REMOTE_DIR that points at a file', async () => {
  const client = reset();
  await assert.rejects(client.test('notadir'), (error: unknown) => {
    return error instanceof KaggleError && error.kind === 'badRequest';
  });
});

test('404 is surfaced as notFound for direct API calls', async () => {
  const client = reset();
  await assert.rejects(client.getContents('missing'), (error: unknown) => {
    return error instanceof KaggleError && error.kind === 'notFound';
  });
});

test('401 is mapped to an expired session', async () => {
  const client = reset('unauthorized');
  await assert.rejects(client.test('a'), (error: unknown) => {
    return error instanceof KaggleError && error.kind === 'auth';
  });
});

test('an HTML login page is mapped to nonJson', async () => {
  const client = reset('html');
  await assert.rejects(client.test('a'), (error: unknown) => {
    return error instanceof KaggleError && error.kind === 'nonJson';
  });
});

test('redirects are not followed and are mapped to redirect', async () => {
  const client = reset('redirect');
  await assert.rejects(client.test('a'), (error: unknown) => {
    return error instanceof KaggleError && error.kind === 'redirect';
  });
});

test('probeSession reports alive and hits /api/status', async () => {
  const client = reset();
  const result = await client.probeSession(1000);
  assert.equal(result.alive, true);
  assert.equal(result.likelyExpired, false);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].path, '/api/status');
});

test('probeSession flags expired sessions as likelyExpired', async () => {
  for (const next of ['unauthorized', 'html', 'redirect', 'proxy404'] as const) {
    const client = reset(next);
    const result = await client.probeSession(1000);
    assert.equal(result.alive, false, next);
    assert.equal(result.likelyExpired, true, next);
  }
});

test('probeSession fails fast on a hanging server', async () => {
  const client = reset('slow');
  const started = Date.now();
  const result = await client.probeSession(80);
  const elapsed = Date.now() - started;
  assert.equal(result.alive, false);
  assert.equal(result.likelyExpired, true);
  assert.equal(result.error?.kind, 'timeout');
  assert.ok(elapsed < 1000, `probe should fail fast, took ${elapsed}ms`);
});

test('keepAlive reports alive and hits /api/kernels', async () => {
  const client = reset();
  const result = await client.keepAlive(1000);
  assert.equal(result.alive, true);
  assert.equal(result.likelyExpired, false);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].path, '/api/kernels');
});

test('keepAlive falls back to /api/status if /api/kernels returns 404', async () => {
  const client = reset('no-kernels');
  const result = await client.keepAlive(1000);
  assert.equal(result.alive, true);
  assert.equal(result.likelyExpired, false);
  assert.equal(calls[0].path, '/api/kernels');
  assert.equal(calls[1].path, '/api/status');
});

test('keepAlive flags expired sessions as likelyExpired', async () => {
  for (const next of ['unauthorized', 'html', 'redirect', 'proxy404'] as const) {
    const client = reset(next);
    const result = await client.keepAlive(1000);
    assert.equal(result.alive, false, next);
    assert.equal(result.likelyExpired, true, next);
  }
});

test('downloadFile uses /files fast-path for large files and falls back safely', async () => {
  const client = reset();

  const raw = await client.downloadFile('models/weights.bin', {
    type: 'file',
    sizeHint: 2 * 1024 * 1024
  });
  assert.deepEqual([...raw], [9, 8, 7, 6]);
  assert.equal(calls[0].path, '/files/models/weights.bin');

  calls = [];
  const from404 = await client.downloadFile('models/fallback-404.bin', {
    type: 'file',
    sizeHint: 2 * 1024 * 1024
  });
  assert.deepEqual([...from404], [1, 2, 3]);
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/files/models/fallback-404.bin', '/api/contents/models/fallback-404.bin']
  );

  calls = [];
  const fromHtml = await client.downloadFile('models/fallback-html.bin', {
    type: 'file',
    sizeHint: 2 * 1024 * 1024
  });
  assert.deepEqual([...fromHtml], [4, 5, 6]);
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/files/models/fallback-html.bin', '/api/contents/models/fallback-html.bin']
  );

  calls = [];
  const htmlFile = await client.downloadFile('models/page.html', {
    type: 'file',
    sizeHint: 2 * 1024 * 1024
  });
  assert.equal(htmlFile.toString('utf8'), '<h1>ok</h1>');
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/api/contents/models/page.html']
  );

  calls = [];
  await assert.rejects(
    client.downloadFile('models/auth-fail.bin', {
      type: 'file',
      sizeHint: 2 * 1024 * 1024
    }),
    (error: unknown) => error instanceof KaggleError && error.kind === 'auth'
  );
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/files/models/auth-fail.bin']
  );

  calls = [];
  const from403 = await client.downloadFile('models/fallback-403.bin', {
    type: 'file',
    sizeHint: 2 * 1024 * 1024
  });
  assert.deepEqual([...from403], [7, 8]);
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/files/models/fallback-403.bin', '/api/contents/models/fallback-403.bin']
  );

  calls = [];
  await assert.rejects(
    client.downloadFile('models/fallback-302.bin', {
      type: 'file',
      sizeHint: 2 * 1024 * 1024
    }),
    (error: unknown) => error instanceof KaggleError && error.kind === 'redirect'
  );
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/files/models/fallback-302.bin', '/api/contents/models/fallback-302.bin']
  );

  calls = [];
  assert.equal(
    (await client.downloadFile('file.txt', { type: 'file', sizeHint: 12 })).toString('utf8'),
    'hello kaggle'
  );
  assert.equal(calls[0].path, '/api/contents/file.txt');
});

test('request timeoutMs aborts slow responses as retryable timeout errors', async () => {
  reset('slow');
  const slowClient = new JupyterClient(baseUrl, { timeoutMs: 80 });
  await assert.rejects(
    slowClient.getContents('a'),
    (error: unknown) =>
      error instanceof KaggleError && error.kind === 'timeout' && error.retryable === true
  );
});

test('plain-text "not found" confirms /api/status once on live sessions and fails with auth when expired', async () => {
  const liveClient = reset();
  await assert.rejects(
    liveClient.getContents('missing-plain'),
    (error: unknown) => error instanceof KaggleError && error.kind === 'notFound'
  );
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/api/contents/missing-plain', '/api/status']
  );

  // Second check within the confirmation TTL reuses the recent /api/status verification.
  calls = [];
  const existsResult = await liveClient.test('missing-plain-2');
  assert.deepEqual(existsResult, { exists: false, path: 'missing-plain-2' });
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/api/contents/missing-plain-2']
  );

  const expiredClient = reset('pod404-expired');
  const probe = await expiredClient.probeSession(1000);
  assert.equal(probe.alive, false);
  assert.equal(probe.likelyExpired, true);
  assert.equal(probe.error?.kind, 'auth');

  calls = [];
  await assert.rejects(
    expiredClient.getContents('missing-plain'),
    (error: unknown) => error instanceof KaggleError && error.kind === 'auth'
  );
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/api/contents/missing-plain', '/api/status']
  );
});

test('deleteContents falls back to helper kernel on send2trash 400 and cleans up', async () => {
  const client = reset();
  await client.deleteContents('send2trash-fail');
  await client.deleteContents('send2trash-fail-2');
  assert.equal(kernelExecutions.length, 2);
  // Only one helper kernel should have been created across both deletions.
  const creates = calls.filter((c) => c.method === 'POST' && c.path === '/api/kernels');
  assert.equal(creates.length, 1);

  await assert.rejects(
    client.deleteContents('missing-in-kernel'),
    (error: unknown) => error instanceof KaggleError && error.kind === 'notFound'
  );

  // Explicit "Directory not empty" 400 stays REST-only so deleteRemoteTree handles it.
  await assert.rejects(
    client.deleteContents('nonempty-dir'),
    (error: unknown) => error instanceof KaggleError && error.kind === 'badRequest' && /目录非空/.test(error.message)
  );

  await client.dispose();
  assert.equal(
    calls.some((c) => c.method === 'DELETE' && c.path === '/api/kernels/helper-k1'),
    true
  );
});

test('configureKernelWorkingDir reuses idle kernels when present', async () => {
  const client = reset();
  mockKernels = [
    { id: 'idle-py', name: 'python3', execution_state: 'idle' },
    { id: 'busy-py', name: 'python3', execution_state: 'busy' },
    { id: 'r-kern', name: 'ir', execution_state: 'idle' }
  ];

  const result = await client.configureKernelWorkingDir('news_recommender');
  assert.equal(result.startupConfigured, true);
  assert.equal(result.updatedKernels, 1);
  assert.equal(result.skippedBusyKernels, 1);
  assert.equal(result.dirExists, true);
  assert.equal(kernelExecutions.length, 1);
  assert.equal(
    calls.some((c) => c.method === 'POST' && c.path === '/api/kernels'),
    false
  );
});

test('configureKernelWorkingDir spins up and disposes temporary helper kernel when no idle kernel exists', async () => {
  const client = reset();
  mockKernels = [];

  const result = await client.configureKernelWorkingDir('missing_dir');
  assert.equal(result.startupConfigured, true);
  assert.equal(result.updatedKernels, 0);
  assert.equal(result.dirExists, false);
  assert.equal(kernelExecutions.length, 1);
  assert.equal(
    calls.some((c) => c.method === 'POST' && c.path === '/api/kernels'),
    true
  );
  assert.equal(
    calls.some((c) => c.method === 'DELETE' && c.path === '/api/kernels/helper-k1'),
    true
  );

  // onlyExistingIdle skips helper kernel creation when nothing is idle.
  calls = [];
  kernelExecutions = [];
  const skipped = await client.configureKernelWorkingDir('news_recommender', {
    onlyExistingIdle: true
  });
  assert.equal(skipped.startupConfigured, false);
  assert.equal(skipped.updatedKernels, 0);
  assert.equal(
    calls.some((c) => c.method === 'POST' && c.path === '/api/kernels'),
    false
  );
});
