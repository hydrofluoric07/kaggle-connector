import { minimatch } from 'minimatch';
import { toPosixPath } from './paths';

export const DEFAULT_EXCLUDES = [
  '**/.git/**',
  '**/.ipynb_checkpoints/**',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/node_modules/**',
  '**/*.pyc'
];

/**
 * Match a workspace-relative (or selection-relative) path against glob
 * patterns. Directory patterns like `**\/node_modules/**` also match the
 * directory itself so recursion can stop early.
 */
export function isExcluded(
  relativePath: string,
  patterns: readonly string[],
  isDirectory = false
): boolean {
  const relative = toPosixPath(relativePath).replace(/^\/+/, '');
  if (!relative || patterns.length === 0) {
    return false;
  }

  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim();
    if (!pattern) {
      continue;
    }
    if (matches(relative, pattern)) {
      return true;
    }
    if (isDirectory && matches(`${relative}/__kaggle_connector_probe__`, pattern)) {
      return true;
    }
  }
  return false;
}

function matches(value: string, pattern: string): boolean {
  return minimatch(value, pattern, {
    dot: true,
    matchBase: true,
    nocase: process.platform === 'win32'
  });
}
