import * as path from 'node:path';
import { joinRemotePath } from './url';

export type PathMode = 'workspaceRelative' | 'basename';

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

export function localRelative(root: string, target: string): string {
  return toPosixPath(path.relative(root, target));
}

export function isInsideOrEqual(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export interface SelectionBaseOptions {
  localPath: string;
  isDirectory: boolean;
  workspaceRoot?: string;
  mode: PathMode;
}

/**
 * Remote path of the selected item, relative to REMOTE_DIR.
 *
 * - workspaceRelative: the item's workspace-relative path (or "" for the
 *   workspace root itself, meaning files go directly under REMOTE_DIR).
 * - basename: only the item's file/folder name.
 * - Items outside the workspace fall back to their basename.
 */
export function selectionRemoteBase(options: SelectionBaseOptions): string {
  const { localPath, workspaceRoot, mode } = options;

  if (mode === 'workspaceRelative' && workspaceRoot && isInsideOrEqual(workspaceRoot, localPath)) {
    return localRelative(workspaceRoot, localPath);
  }

  return path.basename(localPath);
}

/**
 * Remote path of a child inside a selected folder.
 */
export function childRemoteBase(selectionBase: string, selectionRoot: string, childLocal: string): string {
  const relative = localRelative(selectionRoot, childLocal);
  return joinRemotePath(selectionBase, relative);
}
