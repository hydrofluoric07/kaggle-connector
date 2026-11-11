import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideUpload } from '../src/core/uploadPolicy';

const T = 1_700_000_000_000;

test('a file without a remote copy is uploaded', () => {
  assert.equal(decideUpload({ localSize: 10, localMtime: T }), 'upload');
});

test('a remote directory at the same path is reported', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: { type: 'directory' }
    }),
    'remoteIsDirectory'
  );
});

test('same size and a matching remote timestamp is unchanged', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: { type: 'file', size: 10, lastModified: T }
    }),
    'unchanged'
  );
});

test('same size but an older remote file is uploaded', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: { type: 'file', size: 10, lastModified: T - 10_000 }
    }),
    'upload'
  );
});

test('a matching hash is unchanged even when the remote timestamp is newer', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: {
        type: 'file',
        size: 10,
        lastModified: T + 60_000,
        hash: 'abcdef',
        hashAlgorithm: 'sha256'
      },
      localHash: 'ABCDEF'
    }),
    'unchanged'
  );
});

test('a hash mismatch on a newer remote file is a conflict', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: {
        type: 'file',
        size: 10,
        lastModified: T + 60_000,
        hash: 'abcdef',
        hashAlgorithm: 'sha256'
      },
      localHash: '123456'
    }),
    'remoteNewer'
  );
});

test('a hash mismatch on an older remote file is uploaded', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: {
        type: 'file',
        size: 10,
        lastModified: T - 60_000,
        hash: 'abcdef',
        hashAlgorithm: 'sha256'
      },
      localHash: '123456'
    }),
    'upload'
  );
});

test('a size mismatch on a newer remote file is a conflict', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: { type: 'file', size: 11, lastModified: T + 60_000 }
    }),
    'remoteNewer'
  );
});

test('a size mismatch on an older remote file is uploaded', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: { type: 'file', size: 11, lastModified: T - 60_000 }
    }),
    'upload'
  );
});

test('missing remote timestamps force an upload', () => {
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: { type: 'file', size: 10 }
    }),
    'upload'
  );
});

test('server clock offset is applied to remote timestamps', () => {
  // The server clock is one minute ahead; the remote file is actually
  // unchanged relative to the local one.
  assert.equal(
    decideUpload({
      localSize: 10,
      localMtime: T,
      remote: { type: 'file', size: 10, lastModified: T + 60_000 },
      clockOffsetMs: 60_000
    }),
    'unchanged'
  );
});
