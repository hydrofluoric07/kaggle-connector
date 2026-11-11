import { dirnameRemotePath, joinRemotePath, normalizeRemotePath } from './url';

export interface RemoteSelectionItem {
  path: string;
  entryType?: 'file' | 'directory' | 'notebook';
  entrySize?: number;
  isRoot?: boolean;
}

export interface PlannedMultiDownloadTarget<T extends RemoteSelectionItem = RemoteSelectionItem> {
  item: T;
  localParts: string[];
}

export interface BatchTransferEntry {
  source: string;
  target: string;
  baseName: string;
  isDirectory: boolean;
  conflict: boolean;
}

export interface BatchTransferPlan {
  entries: BatchTransferEntry[];
  skippedSameParent: number;
  selfContainmentErrors: string[];
  duplicateTargetErrors: string[];
}

export function remoteBasename(remotePath: string): string {
  const normalized = normalizeRemotePath(remotePath);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

/** True when child is parent itself or lives below parent. */
export function isRemoteInsideOrEqual(parent: string, child: string): boolean {
  const normalizedParent = normalizeRemotePath(parent);
  const normalizedChild = normalizeRemotePath(child);
  if (!normalizedParent) {
    // The Jupyter root contains every remote path.
    return true;
  }
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent}/`)
  );
}

function splitCopyName(name: string, isDirectory: boolean): { stem: string; ext: string } {
  if (!isDirectory) {
    const dot = name.lastIndexOf('.');
    if (dot > 0) {
      return { stem: name.slice(0, dot), ext: name.slice(dot) };
    }
  }
  return { stem: name, ext: '' };
}

/** Suggest a sibling path such as "notes copy.md" for a copy operation. */
export function suggestedCopyPath(remotePath: string, isDirectory: boolean): string {
  const normalized = normalizeRemotePath(remotePath);
  const directory = dirnameRemotePath(normalized);
  const { stem, ext } = splitCopyName(remoteBasename(normalized), isDirectory);
  return joinRemotePath(directory, `${stem} copy${ext}`);
}

/**
 * Pick a non-colliding copy path inside `targetDir` given the names that
 * already exist there (`"a copy.py"`, `"a copy 2.py"`, ...).
 */
export function uniqueCopyPath(
  targetDir: string,
  baseName: string,
  isDirectory: boolean,
  existingNames: ReadonlySet<string>
): string {
  const { stem, ext } = splitCopyName(baseName, isDirectory);
  let candidate = `${stem} copy${ext}`;
  let suffix = 2;
  while (existingNames.has(candidate)) {
    candidate = `${stem} copy ${suffix}${ext}`;
    suffix += 1;
  }
  return joinRemotePath(normalizeRemotePath(targetDir), candidate);
}

/** Validate a single new file/folder name typed by the user. */
export function validateEntryName(value: string): string | undefined {
  const name = value.trim();
  if (!name) {
    return '名称不能为空';
  }
  if (name === '.' || name === '..') {
    return '名称无效';
  }
  if (/[\\/]/.test(name)) {
    return '名称不能包含斜杠；如需子目录请先创建文件夹';
  }
  return undefined;
}

/** Make a remote name safe for Windows/macOS/Linux local file systems. */
export function safeLocalName(name: string): string {
  const stripped = name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '');
  const normalized = stripped || 'unnamed';
  if (normalized === '.' || normalized === '..') {
    return 'unnamed';
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(normalized)) {
    return `_${normalized}`;
  }
  return normalized;
}

/**
 * Deduplicate paths and remove items whose ancestor directory is already in
 * the selection so batch download/delete/move/copy never double-processes.
 */
export function filterOutNestedRemotePaths<T extends { path: string; entryType?: string }>(
  items: readonly T[]
): T[] {
  const seen = new Set<string>();
  const normalizedItems: Array<{ item: T; path: string }> = [];
  for (const item of items) {
    const normalized = normalizeRemotePath(item.path);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    normalizedItems.push({ item, path: normalized });
  }

  const selectedDirs = new Set(
    normalizedItems
      .filter(({ item }) => item.entryType === 'directory')
      .map(({ path }) => path)
  );

  return normalizedItems
    .filter(({ path }) => {
      let parent = dirnameRemotePath(path);
      while (parent) {
        if (selectedDirs.has(parent)) {
          return false;
        }
        parent = dirnameRemotePath(parent);
      }
      return true;
    })
    .map(({ item, path }) => ({ ...item, path }));
}

/** Compute the deepest shared parent directory across all given remote paths. */
export function commonRemoteParent(paths: readonly string[]): string {
  const parents = paths
    .map((item) => dirnameRemotePath(item))
    .map((parent) => (parent ? parent.split('/') : []));
  if (parents.length === 0) {
    return '';
  }

  let prefix = parents[0];
  for (let i = 1; i < parents.length; i += 1) {
    const next = parents[i];
    let matched = 0;
    while (matched < prefix.length && matched < next.length && prefix[matched] === next[matched]) {
      matched += 1;
    }
    prefix = prefix.slice(0, matched);
    if (prefix.length === 0) {
      break;
    }
  }
  return prefix.join('/');
}

/**
 * Compute local relative path segments for multi-selected downloads. Flat
 * `<basename>` is used when all basenames are distinct; if items from different
 * directories share a sanitized basename, relative paths from the shared
 * ancestor are preserved so they do not overwrite each other.
 */
export function planMultiDownloadTargets<T extends RemoteSelectionItem>(
  items: readonly T[]
): Array<PlannedMultiDownloadTarget<T>> {
  const deduped = filterOutNestedRemotePaths(items);
  if (deduped.length === 0) {
    return [];
  }

  const seenNames = new Set<string>();
  let hasBasenameCollision = false;
  for (const item of deduped) {
    const localName = safeLocalName(remoteBasename(item.path)).toLowerCase();
    if (seenNames.has(localName)) {
      hasBasenameCollision = true;
      break;
    }
    seenNames.add(localName);
  }

  if (!hasBasenameCollision) {
    return deduped.map((item) => ({
      item,
      localParts: [safeLocalName(remoteBasename(item.path))]
    }));
  }

  const commonParent = commonRemoteParent(deduped.map((item) => item.path));
  const prefixSegments = commonParent ? commonParent.split('/') : [];

  return deduped.map((item) => {
    const segments = normalizeRemotePath(item.path).split('/').filter(Boolean);
    const relative = segments.slice(prefixSegments.length);
    const localParts = (relative.length > 0 ? relative : segments).map(safeLocalName);
    return { item, localParts };
  });
}

/**
 * Build a validated batch move or copy plan into `targetDir`.
 * In copy mode, copying into the same parent automatically picks a unique
 * `... copy` name; cross-directory name collisions are flagged as `conflict`.
 */
export function planBatchTransfer(
  items: readonly RemoteSelectionItem[],
  targetDir: string,
  mode: 'copy' | 'move',
  existingNames: ReadonlySet<string>
): BatchTransferPlan {
  const normalizedTarget = normalizeRemotePath(targetDir);
  const deduped = filterOutNestedRemotePaths(items);
  const reserved = new Set(existingNames);
  const seenMoveTargets = new Set<string>();

  const entries: BatchTransferEntry[] = [];
  const selfContainmentErrors: string[] = [];
  const duplicateTargetErrors: string[] = [];
  let skippedSameParent = 0;

  for (const item of deduped) {
    const source = normalizeRemotePath(item.path);
    const isDirectory = item.entryType === 'directory';
    const baseName = remoteBasename(source);
    const sourceParent = dirnameRemotePath(source);

    if (isDirectory && isRemoteInsideOrEqual(source, normalizedTarget)) {
      selfContainmentErrors.push(
        `不能把文件夹 “${source}” ${mode === 'move' ? '移动' : '复制'}到它自己内部`
      );
      continue;
    }

    if (mode === 'move' && sourceParent === normalizedTarget) {
      skippedSameParent += 1;
      continue;
    }

    if (mode === 'copy' && sourceParent === normalizedTarget) {
      const target = uniqueCopyPath(normalizedTarget, baseName, isDirectory, reserved);
      reserved.add(remoteBasename(target));
      entries.push({
        source,
        target,
        baseName: remoteBasename(target),
        isDirectory,
        conflict: false
      });
      continue;
    }

    const target = joinRemotePath(normalizedTarget, baseName);
    if (mode === 'move') {
      if (seenMoveTargets.has(target)) {
        duplicateTargetErrors.push(`多个选中项同名，无法同时移动到同一目录：${baseName}`);
        continue;
      }
      seenMoveTargets.add(target);
    }

    const conflict = reserved.has(baseName);
    entries.push({
      source,
      target,
      baseName,
      isDirectory,
      conflict
    });
  }

  return {
    entries,
    skippedSameParent,
    selfContainmentErrors,
    duplicateTargetErrors
  };
}
