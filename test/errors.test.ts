import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyHttpError,
  classifyNetworkError,
  describeError,
  isSessionError,
  nonJsonError
} from '../src/core/errors';

function http(status: number, body = '', extra: Partial<{ location: string }> = {}) {
  return classifyHttpError({
    status,
    statusText: '',
    body,
    url: 'https://host/k/123/proxy/api/contents/news/a.py',
    ...extra
  });
}

test('401 maps to an expired session with recovery hint', () => {
  const error = http(401, '{"message":"Unauthorized"}');
  assert.equal(error.kind, 'auth');
  assert.equal(isSessionError(error), true);
  assert.match(describeError(error), /Compatible URL/);
});

test('403 with Permission denied maps to read-only working dir', () => {
  const error = http(403, '{"message":"Permission denied: /kaggle/input/x"}');
  assert.equal(error.kind, 'forbidden');
  assert.equal(isSessionError(error), false);
  assert.match(describeError(error), /\/kaggle\/working/);
});

test('403 without permission details maps to auth', () => {
  const error = http(403, '<html>Forbidden</html>');
  assert.equal(error.kind, 'auth');
  assert.equal(isSessionError(error), true);
});

test('404 and 400 expose actionable details', () => {
  assert.equal(http(404, '{"message":"file or directory does not exist"}').kind, 'notFound');
  const badRequest = http(400, '{"message":"bad","reason":"bad format"}');
  assert.equal(badRequest.kind, 'badRequest');
  assert.match(describeError(badRequest), /bad format/);
});

test('a plain-text proxy 404 is an expired session, not a missing path', () => {
  const proxy = classifyHttpError({
    status: 404,
    statusText: 'Not Found',
    body: '404 page not found',
    url: 'https://host/k/123/proxy/api/status',
    contentType: 'text/plain; charset=utf-8'
  });
  assert.equal(proxy.kind, 'auth');
  assert.equal(isSessionError(proxy), true);

  const html = http(404, '<html>404</html>');
  assert.equal(html.kind, 'auth');
  assert.equal(isSessionError(html), true);

  // Jupyter's JSON 404 still means "path missing".
  assert.equal(http(404, '{"message":"No such file or directory"}').kind, 'notFound');

  const outerProxy = classifyHttpError({
    status: 404,
    statusText: 'Not Found',
    body: '404 page not found\n',
    url: 'https://host/k/123/proxy/api/contents/missing.txt',
    contentType: 'text/plain; charset=utf-8'
  });
  assert.equal(outerProxy.kind, 'auth');
  assert.equal(isSessionError(outerProxy), true);
});

test('Kaggle plain-text "not found" distinguishes subpaths from fixed endpoints', () => {
  const missingSubpath = classifyHttpError({
    status: 404,
    statusText: 'Not Found',
    body: 'not found',
    url: 'https://host/k/123/proxy/api/contents/new_file.txt?content=0',
    contentType: 'text/plain; charset=utf-8'
  });
  assert.equal(missingSubpath.kind, 'notFound');

  const literallyApiStatusFile = classifyHttpError({
    status: 404,
    statusText: 'Not Found',
    body: 'not found',
    url: 'https://host/k/123/proxy/api/contents/api/status?content=0',
    contentType: 'text/plain; charset=utf-8'
  });
  assert.equal(literallyApiStatusFile.kind, 'notFound');

  for (const fixedUrl of [
    'https://host/k/123/proxy/api/status',
    'https://host/k/123/proxy/api/contents?content=1'
  ]) {
    const fixed = classifyHttpError({
      status: 404,
      statusText: 'Not Found',
      body: 'not found',
      url: fixedUrl,
      contentType: 'text/plain; charset=utf-8'
    });
    assert.equal(fixed.kind, 'auth', fixedUrl);
    assert.equal(isSessionError(fixed), true, fixedUrl);
  }
});

test('400 for a non-empty directory and 409 conflicts have specific hints', () => {
  const notEmpty = http(400, '{"message":"Directory /kaggle/working/a not empty"}');
  assert.equal(notEmpty.kind, 'badRequest');
  assert.match(notEmpty.message, /目录非空/);
  assert.match(notEmpty.hint ?? '', /先删除目录内/);

  const conflict = http(409, '{"message":"File already exists: a.py"}');
  assert.equal(conflict.kind, 'badRequest');
  assert.match(conflict.message, /已存在/);
  assert.match(conflict.hint ?? '', /目标名称/);
});

test('413 maps to a size error', () => {
  const error = http(413, 'Payload Too Large');
  assert.equal(error.kind, 'tooLarge');
  assert.match(error.hint ?? '', /maxFileSizeMB/);
});

test('500 with a missing parent directory hints at REMOTE_DIR', () => {
  const error = http(500, '{"message":"Unexpected error while saving file: No such file or directory"}');
  assert.equal(error.kind, 'server');
  assert.match(error.hint ?? '', /父目录/);
});

test('redirects and HTML responses are treated as expired sessions', () => {
  const redirect = http(302, '', { location: 'https://www.kaggle.com/account/login' });
  assert.equal(redirect.kind, 'redirect');
  assert.equal(isSessionError(redirect), true);

  const loginPage = nonJsonError('https://host/api/contents', '<html>login</html>', 200);
  assert.equal(loginPage.kind, 'nonJson');
  assert.equal(isSessionError(loginPage), true);
});

test('network errors are classified by code', () => {
  assert.equal(classifyNetworkError({ code: 'ECONNREFUSED', message: 'refused' }).kind, 'network');
  assert.equal(classifyNetworkError({ code: 'ENOTFOUND', message: 'dns' }).kind, 'dns');
  assert.equal(classifyNetworkError({ code: 'ETIMEDOUT', message: 'timeout' }).kind, 'timeout');
  const cancelled = classifyNetworkError({ name: 'AbortError', message: 'aborted' });
  assert.equal(cancelled.kind, 'cancelled');
  assert.equal(cancelled.message, '操作已取消');
});

test('plain validation errors keep their message instead of blaming the network', () => {
  const error = classifyNetworkError(new Error('远端目录不能为空'));
  assert.equal(error.kind, 'unknown');
  assert.equal(error.message, '远端目录不能为空');
  assert.doesNotMatch(describeError(error), /HTTPS_PROXY|kaggleConnector\.proxy/);
});

test('unrecognized network codes still map to a network error', () => {
  const error = classifyNetworkError({ code: 'EWHATEVER', message: 'boom' });
  assert.equal(error.kind, 'network');
});
