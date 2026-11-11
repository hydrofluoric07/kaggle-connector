import * as vscode from 'vscode';
import { JupyterClient } from './client';
import { getRemoteUploadDebounceMs, getRemoteUploadMaxDelayMs } from './config';
import { isConnectionError, KaggleError, shortError } from './core/errors';
import { normalizeRemotePath } from './core/url';
import { RemoteUploadQueue } from './remoteSave';

/**
 * Custom scheme used to open remote Jupyter files as editable VS Code
 * documents. URI paths are remote paths relative to the Jupyter root, e.g.
 * `kaggle-remote:/news_recommender/src/train.py`.
 */
export const REMOTE_SCHEME = 'kaggle-remote';

interface ContentsModel {
  type?: unknown;
  size?: unknown;
  last_modified?: unknown;
  writable?: unknown;
}

/**
 * FileSystemProvider over the Jupyter Contents API. It supports reading,
 * writing (Ctrl+S), listing, creating, deleting and renaming so VS Code's
 * editor can work with remote files directly.
 */
export class KaggleRemoteFileSystemProvider implements vscode.FileSystemProvider {
  private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.changeEmitter.event;
  private readonly manualSaveKeys = new Set<string>();
  private readonly uploadQueue = new RemoteUploadQueue({
    upload: (key, content) => this.upload(key, content),
    shouldDebounce: () =>
      vscode.workspace.getConfiguration('files').get<string>('autoSave', 'off') !== 'off',
    getDebounceMs: getRemoteUploadDebounceMs,
    getMaxDelayMs: getRemoteUploadMaxDelayMs
  });

  constructor(
    private readonly resolveClient: () => Promise<JupyterClient>,
    private readonly log: (message: string) => void,
    private readonly onMutation?: () => void,
    private readonly onConnectionError?: (error: unknown) => void
  ) {}

  /** Report session/network failures so the uploaded command can grey out. */
  private notifyConnectionError(error: unknown): void {
    if (isConnectionError(error)) {
      this.onConnectionError?.(error);
    }
  }

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      const model = (await client.getContents(remotePath)) as ContentsModel | undefined;
      const type =
        model?.type === 'directory' ? vscode.FileType.Directory : vscode.FileType.File;
      const mtime = parseTimestamp(model?.last_modified) ?? Date.now();
      const stat: vscode.FileStat = {
        type,
        ctime: mtime,
        mtime,
        size: typeof model?.size === 'number' ? model.size : 0
      };
      if (model?.writable === false) {
        stat.permissions = vscode.FilePermission.Readonly;
      }
      return stat;
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      const entries = await client.listDirectory(remotePath);
      return entries.map(
        (entry): [string, vscode.FileType] => [
          entry.name,
          entry.type === 'directory' ? vscode.FileType.Directory : vscode.FileType.File
        ]
      );
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const remotePath = toRemotePath(uri);
    let bytes: Uint8Array;
    try {
      const client = await this.resolveClient();
      bytes = await client.readFile(remotePath);
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
    if (isBinary(bytes)) {
      throw vscode.FileSystemError.Unavailable(
        '这是二进制文件，无法在文本编辑器中打开，请使用“下载”。'
      );
    }
    return bytes;
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    const key = uri.toString();
    const manual = this.manualSaveKeys.delete(key);
    try {
      if (manual) {
        await this.uploadQueue.writeNow(key, content);
      } else {
        await this.uploadQueue.write(key, content);
      }
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }

  /** Mark the next writeFile for this URI as an explicit manual save. */
  beginManualSave(key: string): void {
    this.manualSaveKeys.add(key);
  }

  /** Clear a manual-save marker if no writeFile was triggered. */
  clearManualSave(key: string): void {
    this.manualSaveKeys.delete(key);
  }

  /** Upload pending debounced content for a URI now. */
  async flushPending(key: string): Promise<void> {
    await this.uploadQueue.flush(key);
  }

  /** Flush all pending remote saves (tab close / window exit). */
  async flushAll(): Promise<void> {
    await this.uploadQueue.flushAll();
  }

  dispose(): void {
    this.uploadQueue.dispose();
    this.changeEmitter.dispose();
  }

  private async upload(key: string, content: Uint8Array): Promise<void> {
    const uri = vscode.Uri.parse(key);
    const remotePath = toRemotePath(uri);
    const client = await this.resolveClient();
    await client.putFile(remotePath, Buffer.from(content));
    this.changeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    this.onMutation?.();
    this.log(`已保存远端文件: ${remotePath}`);
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      await client.putDirectory(remotePath);
      this.changeEmitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
      this.onMutation?.();
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }

  async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      if (options.recursive) {
        await deleteRemoteTree(client, remotePath, this.log);
      } else {
        await client.deleteContents(remotePath);
      }
      this.changeEmitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
      this.onMutation?.();
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }

  async rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): Promise<void> {
    const from = toRemotePath(oldUri);
    const to = toRemotePath(newUri);
    try {
      const client = await this.resolveClient();
      if (options.overwrite) {
        try {
          await client.deleteContents(to);
        } catch (error) {
          if (!(error instanceof KaggleError && error.kind === 'notFound')) {
            throw error;
          }
        }
      }
      await client.renameContents(from, to);
      this.changeEmitter.fire([
        { type: vscode.FileChangeType.Deleted, uri: oldUri },
        { type: vscode.FileChangeType.Created, uri: newUri }
      ]);
      this.onMutation?.();
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, oldUri);
    }
  }
}

function toRemotePath(uri: vscode.Uri): string {
  return normalizeRemotePath(uri.path);
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isBinary(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 8192);
  for (let index = 0; index < limit; index += 1) {
    if (bytes[index] === 0) {
      return true;
    }
  }
  return false;
}

function toFileSystemError(error: unknown, uri: vscode.Uri): vscode.FileSystemError {
  if (error instanceof vscode.FileSystemError) {
    return error;
  }
  if (error instanceof KaggleError && error.kind === 'notFound') {
    return vscode.FileSystemError.FileNotFound(uri);
  }
  return vscode.FileSystemError.Unavailable(shortError(error));
}

async function deleteRemoteTree(
  client: JupyterClient,
  remotePath: string,
  log: (message: string) => void
): Promise<void> {
  const entries = await client.listDirectory(remotePath);
  for (const entry of entries) {
    if (entry.type === 'directory') {
      await deleteRemoteTree(client, entry.path, log);
    } else {
      await client.deleteContents(entry.path);
    }
  }
  await client.deleteContents(remotePath);
  log(`删除目录完成: ${remotePath}`);
}
