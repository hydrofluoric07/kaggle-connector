import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  commonRemoteParent,
  filterOutNestedRemotePaths,
  isRemoteInsideOrEqual,
  planBatchTransfer,
  planMultiDownloadTargets,
  remoteBasename,
  safeLocalName,
  suggestedCopyPath,
  uniqueCopyPath,
  validateEntryName
} from '../src/core/remoteActions';

test('remoteBasename returns the last remote path segment', () => {
  assert.equal(remoteBasename('a/b/c.py'), 'c.py');
  assert.equal(remoteBasename('/a/b/'), 'b');
  assert.equal(remoteBasename(''), '');
});

test('isRemoteInsideOrEqual distinguishes siblings from descendants', () => {
  assert.equal(isRemoteInsideOrEqual('a', 'a/b'), true);
  assert.equal(isRemoteInsideOrEqual('a', 'a'), true);
  assert.equal(isRemoteInsideOrEqual('a', 'ab'), false);
  assert.equal(isRemoteInsideOrEqual('', 'anything/here'), true);
});

test('suggestedCopyPath keeps file extensions and folder names', () => {
  assert.equal(suggestedCopyPath('a/b.py', false), 'a/b copy.py');
  assert.equal(suggestedCopyPath('a/model', true), 'a/model copy');
  assert.equal(suggestedCopyPath('notes.md', false), 'notes copy.md');
});

test('validateEntryName rejects separators and empty names', () => {
  assert.equal(validateEntryName('notes.md'), undefined);
  assert.equal(validateEntryName('.env'), undefined);
  assert.match(validateEntryName('  ') ?? '', /不能为空/);
  assert.match(validateEntryName('..') ?? '', /无效/);
  assert.match(validateEntryName('a/b') ?? '', /斜杠/);
});

test('safeLocalName sanitizes characters that are invalid on Windows', () => {
  assert.equal(safeLocalName('a:b?.py'), 'a_b_.py');
  assert.equal(safeLocalName('name. '), 'name');
  assert.equal(safeLocalName('CON.txt'), '_CON.txt');
  assert.equal(safeLocalName(''), 'unnamed');
  assert.equal(safeLocalName('..'), 'unnamed');
});

test('filterOutNestedRemotePaths deduplicates and drops descendants under selected folders', () => {
  const filtered = filterOutNestedRemotePaths([
    { path: 'news/models', entryType: 'directory' },
    { path: 'news/models/a.pt', entryType: 'file' },
    { path: 'news/models/sub/b.pt', entryType: 'file' },
    { path: 'news/models_v2/c.pt', entryType: 'file' },
    { path: 'news/models', entryType: 'directory' },
    { path: '/news/main.py/', entryType: 'file' }
  ]);
  assert.deepEqual(
    filtered.map((item) => item.path),
    ['news/models', 'news/models_v2/c.pt', 'news/main.py']
  );
});

test('commonRemoteParent computes deepest shared remote directory', () => {
  assert.equal(commonRemoteParent(['news/a/1.py', 'news/b/2.py']), 'news');
  assert.equal(commonRemoteParent(['news/1.py', 'news/a/2.py']), 'news');
  assert.equal(commonRemoteParent(['a/1.py', 'b/2.py']), '');
  assert.equal(commonRemoteParent([]), '');
});

test('uniqueCopyPath increments copy suffixes past existing names', () => {
  const existing = new Set(['a.py', 'a copy.py', 'a copy 2.py', '.env', '.env copy']);
  assert.equal(uniqueCopyPath('dir', 'a.py', false, existing), 'dir/a copy 3.py');
  assert.equal(uniqueCopyPath('dir', 'b.py', false, existing), 'dir/b copy.py');
  assert.equal(uniqueCopyPath('dir', '.env', false, existing), 'dir/.env copy 2');
  assert.equal(uniqueCopyPath('dir', 'models', true, existing), 'dir/models copy');
});

test('planMultiDownloadTargets uses flat basenames unless sanitized names collide', () => {
  const flat = planMultiDownloadTargets([
    { path: 'news/main.py', entryType: 'file' },
    { path: 'news/sub/utils.py', entryType: 'file' }
  ]);
  assert.deepEqual(
    flat.map((entry) => entry.localParts),
    [['main.py'], ['utils.py']]
  );

  const colliding = planMultiDownloadTargets([
    { path: 'news/a/utils.py', entryType: 'file' },
    { path: 'news/b/utils.py', entryType: 'file' },
    { path: 'news/utils.py', entryType: 'file' }
  ]);
  assert.deepEqual(
    colliding.map((entry) => entry.localParts),
    [['a', 'utils.py'], ['b', 'utils.py'], ['utils.py']]
  );
});

test('planBatchTransfer validates move and copy conflicts and self-containment', () => {
  const copySameParent = planBatchTransfer(
    [
      { path: 'news/a.py', entryType: 'file' },
      { path: 'news/b.py', entryType: 'file' }
    ],
    'news',
    'copy',
    new Set(['a.py', 'a copy.py', 'b.py'])
  );
  assert.equal(copySameParent.selfContainmentErrors.length, 0);
  assert.deepEqual(
    copySameParent.entries.map((entry) => [entry.source, entry.target, entry.conflict]),
    [
      ['news/a.py', 'news/a copy 2.py', false],
      ['news/b.py', 'news/b copy.py', false]
    ]
  );

  const moveMixed = planBatchTransfer(
    [
      { path: 'news/models', entryType: 'directory' },
      { path: 'news/a/x.py', entryType: 'file' },
      { path: 'news/b/x.py', entryType: 'file' },
      { path: 'news/sub/stay.py', entryType: 'file' },
      { path: 'news/collide.py', entryType: 'file' }
    ],
    'news/sub',
    'move',
    new Set(['stay.py', 'collide.py'])
  );
  assert.equal(moveMixed.skippedSameParent, 1);
  assert.equal(moveMixed.duplicateTargetErrors.length, 1);
  assert.deepEqual(
    moveMixed.entries.map((entry) => [entry.source, entry.target, entry.conflict]),
    [
      ['news/models', 'news/sub/models', false],
      ['news/a/x.py', 'news/sub/x.py', false],
      ['news/collide.py', 'news/sub/collide.py', true]
    ]
  );

  const selfMove = planBatchTransfer(
    [{ path: 'news/models', entryType: 'directory' }],
    'news/models/sub',
    'move',
    new Set()
  );
  assert.equal(selfMove.selfContainmentErrors.length, 1);
  assert.equal(selfMove.entries.length, 0);
});
