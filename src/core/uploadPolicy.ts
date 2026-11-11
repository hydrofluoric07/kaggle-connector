export type ConflictPolicy = 'ask' | 'overwrite' | 'skipNewer';

export interface RemoteFileInfo {
  type?: 'file' | 'notebook' | 'directory';
  size?: number;
  /** Server-side modification time in epoch milliseconds. */
  lastModified?: number;
  hash?: string;
  hashAlgorithm?: string;
}

export type UploadDecision = 'upload' | 'unchanged' | 'remoteNewer' | 'remoteIsDirectory';

export interface DecideUploadInput {
  localSize: number;
  localMtime: number;
  remote?: RemoteFileInfo;
  /**
   * Hash of the local file, computed with the remote hash algorithm. Only
   * pass this when the remote entry exposed a hash.
   */
  localHash?: string;
  /** Server clock minus local clock, in milliseconds. */
  clockOffsetMs?: number;
  toleranceMs?: number;
}

export const UPLOAD_MTIME_TOLERANCE_MS = 2000;

/**
 * Decide whether a file must be uploaded.
 *
 * Remote timestamps are compared on the local clock (clockOffsetMs corrects
 * for the Kaggle server clock). A file is only reported as a conflict
 * ("remoteNewer") when we have positive evidence that the content differs
 * (hash mismatch or a different size); otherwise a previously uploaded file
 * would look "newer" on every subsequent upload.
 */
export function decideUpload(input: DecideUploadInput): UploadDecision {
  const remote = input.remote;
  if (!remote) {
    return 'upload';
  }
  if (remote.type === 'directory') {
    return 'remoteIsDirectory';
  }

  const tolerance = input.toleranceMs ?? UPLOAD_MTIME_TOLERANCE_MS;
  const offset = input.clockOffsetMs ?? 0;
  const remoteMtime =
    typeof remote.lastModified === 'number' ? remote.lastModified - offset : undefined;
  const remoteIsNewer = remoteMtime !== undefined && remoteMtime > input.localMtime + tolerance;
  const sizeDiffers = typeof remote.size === 'number' && remote.size !== input.localSize;
  const hashSame =
    remote.hash && input.localHash
      ? remote.hash.toLowerCase() === input.localHash.toLowerCase()
      : undefined;

  if (hashSame === true) {
    return 'unchanged';
  }

  if (hashSame === false || sizeDiffers) {
    return remoteIsNewer ? 'remoteNewer' : 'upload';
  }

  // No usable hash. Only skip when the size matches and the remote copy is
  // not older than the local file.
  if (
    remote.size === input.localSize &&
    remoteMtime !== undefined &&
    remoteMtime >= input.localMtime - tolerance
  ) {
    return 'unchanged';
  }

  return 'upload';
}
