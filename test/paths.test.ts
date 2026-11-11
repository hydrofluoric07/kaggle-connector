import assert from 'node:assert/strict';
import * as path from 'node:path';
import { test } from 'node:test';
import { DEFAULT_EXCLUDES, isExcluded } from '../src/core/exclude';
import { childRemoteBase, selectionRemoteBase } from '../src/core/paths';
import {
  contentsUrl,
  dirnameRemotePath,
  filesUrl,
  joinRemotePath,
  jupyterConnectionParts,
  jupyterServerId,
  kernelChannelsUrl,
  kernelUrl,
  kernelsUrl,
  kernelspecsUrl,
  normalizeRemotePath,
  normalizeServerUrl,
  statusUrl
} from '../src/core/url';
import { versionAtLeast } from '../src/core/version';

test('normalizeServerUrl keeps the Kaggle proxy path and token query', () => {
  assert.equal(
    normalizeServerUrl('https://host/k/123/token/proxy/'),
    'https://host/k/123/token/proxy'
  );
  assert.equal(
    normalizeServerUrl('https://host/proxy/?token=abc'),
    'https://host/proxy?token=abc'
  );
  assert.equal(normalizeServerUrl('host/proxy'), 'https://host/proxy');
  assert.equal(
    normalizeServerUrl('http://localhost:8888/lab?token=abc'),
    'http://localhost:8888?token=abc'
  );
  assert.equal(
    normalizeServerUrl('https://jupyter.example.com/user/me/tree'),
    'https://jupyter.example.com/user/me'
  );
  assert.throws(() => normalizeServerUrl('   '), /不能为空/);
});

test('jupyterConnectionParts strips the query and keeps the path', () => {
  assert.deepEqual(jupyterConnectionParts('https://host/k/123/jwt/proxy'), {
    baseUrl: 'https://host/k/123/jwt/proxy',
    token: undefined
  });
  assert.deepEqual(jupyterConnectionParts('https://host/proxy/?token=abc'), {
    baseUrl: 'https://host/proxy',
    token: 'abc'
  });
  assert.deepEqual(jupyterConnectionParts('http://localhost:8888/lab?token=abc'), {
    baseUrl: 'http://localhost:8888',
    token: 'abc'
  });
  assert.deepEqual(jupyterConnectionParts('https://host/proxy?token='), {
    baseUrl: 'https://host/proxy',
    token: undefined
  });
});

test('jupyterServerId derives stable, deterministic IDs that change with URL and token', () => {
  const parts1 = jupyterConnectionParts('https://host/k/123/token/proxy/');
  const parts1Slash = jupyterConnectionParts('https://host/k/123/token/proxy');
  const id1 = jupyterServerId(parts1);
  const id1Slash = jupyterServerId(parts1Slash);
  assert.equal(id1, id1Slash);
  assert.match(id1, /^kaggle-[0-9a-f]{12}$/);
  assert.equal(id1.length, 19);

  // Different baseUrl -> different id
  const parts2 = jupyterConnectionParts('https://host/k/456/token/proxy');
  assert.notEqual(jupyterServerId(parts2), id1);

  // Different token query -> different id
  const partsWithTokenA = jupyterConnectionParts('https://host/proxy?token=tokenA');
  const partsWithTokenB = jupyterConnectionParts('https://host/proxy?token=tokenB');
  assert.notEqual(jupyterServerId(partsWithTokenA), jupyterServerId(partsWithTokenB));
  assert.equal(
    jupyterServerId(partsWithTokenA),
    jupyterServerId(jupyterConnectionParts('https://host/proxy/?token=tokenA'))
  );

  // Empty/absent token distinction
  const partsNoToken = jupyterConnectionParts('https://host/proxy');
  assert.notEqual(jupyterServerId(partsWithTokenA), jupyterServerId(partsNoToken));
});

test('versionAtLeast compares major and minor versions', () => {
  assert.equal(versionAtLeast('2025.9.1', 2025, 0), true);
  assert.equal(versionAtLeast('2025.0.0', 2025, 0), true);
  assert.equal(versionAtLeast('2026.1.0', 2025, 0), true);
  assert.equal(versionAtLeast('2024.11.0', 2025, 0), false);
  assert.equal(versionAtLeast('2025.0.0-insider', 2025, 0), true);
  assert.equal(versionAtLeast('', 2025, 0), false);
});

test('contentsUrl encodes each path segment and preserves the query', () => {
  assert.equal(
    contentsUrl('https://host/k/123/proxy', 'news_recommender/src/a b.py'),
    'https://host/k/123/proxy/api/contents/news_recommender/src/a%20b.py'
  );
  assert.equal(
    contentsUrl('https://host/proxy?token=abc', ''),
    'https://host/proxy/api/contents?token=abc'
  );
});

test('statusUrl appends /api/status and preserves the token query', () => {
  assert.equal(
    statusUrl('https://host/k/123/token/proxy'),
    'https://host/k/123/token/proxy/api/status'
  );
  assert.equal(
    statusUrl('https://host/proxy?token=abc'),
    'https://host/proxy/api/status?token=abc'
  );
});

test('kernelsUrl appends /api/kernels and preserves the token query', () => {
  assert.equal(
    kernelsUrl('https://host/k/123/token/proxy'),
    'https://host/k/123/token/proxy/api/kernels'
  );
  assert.equal(
    kernelsUrl('https://host/proxy?token=abc'),
    'https://host/proxy/api/kernels?token=abc'
  );
  assert.equal(
    kernelspecsUrl('https://host/proxy?token=abc'),
    'https://host/proxy/api/kernelspecs?token=abc'
  );
  assert.equal(
    kernelUrl('https://host/proxy?token=abc', 'k/1'),
    'https://host/proxy/api/kernels/k%2F1?token=abc'
  );
  assert.equal(
    kernelChannelsUrl('https://host/proxy?token=abc', 'k/1'),
    'https://host/proxy/api/kernels/k%2F1/channels?token=abc'
  );
});

test('filesUrl appends /files and preserves the token query', () => {
  assert.equal(
    filesUrl(
      'https://host/k/123/token/proxy',
      'news_recommender/models/itemcf_recall.py'
    ),
    'https://host/k/123/token/proxy/files/news_recommender/models/itemcf_recall.py'
  );
  assert.equal(
    filesUrl('https://host/proxy?token=abc', 'a b.py'),
    'https://host/proxy/files/a%20b.py?token=abc'
  );
});

test('normalizeRemotePath rejects traversal and normalizes separators', () => {
  assert.equal(normalizeRemotePath('/a//b/./c/'), 'a/b/c');
  assert.equal(normalizeRemotePath('a\\b\\c'), 'a/b/c');
  assert.equal(normalizeRemotePath(''), '');
  assert.throws(() => normalizeRemotePath('a/../b'), /不能包含/);
});

test('joinRemotePath and dirnameRemotePath', () => {
  assert.equal(joinRemotePath('news_recommender', ''), 'news_recommender');
  assert.equal(joinRemotePath('news_recommender', 'src', 'a.py'), 'news_recommender/src/a.py');
  assert.equal(dirnameRemotePath('news_recommender/src/a.py'), 'news_recommender/src');
  assert.equal(dirnameRemotePath('a.py'), '');
});

test('selectionRemoteBase honors workspaceRelative and basename modes', () => {
  const workspace = path.resolve('workspace');
  const file = path.join(workspace, 'src', 'model', 'train.py');
  const folder = path.join(workspace, 'src', 'model');

  assert.equal(
    selectionRemoteBase({
      localPath: file,
      isDirectory: false,
      workspaceRoot: workspace,
      mode: 'workspaceRelative'
    }),
    'src/model/train.py'
  );
  assert.equal(
    selectionRemoteBase({
      localPath: file,
      isDirectory: false,
      workspaceRoot: workspace,
      mode: 'basename'
    }),
    'train.py'
  );
  assert.equal(
    selectionRemoteBase({
      localPath: workspace,
      isDirectory: true,
      workspaceRoot: workspace,
      mode: 'workspaceRelative'
    }),
    ''
  );
  assert.equal(
    selectionRemoteBase({
      localPath: folder,
      isDirectory: true,
      workspaceRoot: workspace,
      mode: 'basename'
    }),
    'model'
  );
  assert.equal(childRemoteBase('src/model', folder, file), 'src/model/train.py');
});

test('default excludes cover common generated folders', () => {
  assert.equal(isExcluded('.git/config', DEFAULT_EXCLUDES), true);
  assert.equal(isExcluded('node_modules/react/index.js', DEFAULT_EXCLUDES), true);
  assert.equal(isExcluded('src/__pycache__/module.pyc', DEFAULT_EXCLUDES), true);
  assert.equal(isExcluded('src/.ipynb_checkpoints/test-checkpoint.ipynb', DEFAULT_EXCLUDES), true);
  assert.equal(isExcluded('data/raw.csv', DEFAULT_EXCLUDES), false);
  assert.equal(isExcluded('node_modules', DEFAULT_EXCLUDES, true), true);
});
