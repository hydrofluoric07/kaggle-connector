import * as vscode from 'vscode';
import { KaggleError } from './core/errors';
import { DEFAULT_EXCLUDES } from './core/exclude';
import type { PathMode } from './core/paths';
import type { ConflictPolicy } from './core/uploadPolicy';
import { normalizeRemotePath } from './core/url';

export const SECRET_KEY = 'kaggleConnector.serverUrl';

function configuration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('kaggleConnector');
}

export function getRemoteDir(): string {
  return normalizeRemotePath(configuration().get<string>('remoteDir', ''));
}

export function getPathMode(): PathMode {
  return configuration().get<string>('pathMode', 'workspaceRelative') === 'basename'
    ? 'basename'
    : 'workspaceRelative';
}

export function getExclude(): string[] {
  const value = configuration().get<unknown>('exclude', DEFAULT_EXCLUDES);
  if (!Array.isArray(value)) {
    return [...DEFAULT_EXCLUDES];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function getMaxFileSizeMB(): number {
  const value = configuration().get<number>('maxFileSizeMB', 100);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 100;
}

export function getConcurrency(): number {
  const value = configuration().get<number>('concurrency', 4);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 4;
  }
  return Math.min(16, Math.max(1, Math.floor(value)));
}

export function getTimeoutMs(): number {
  const value = configuration().get<number>('requestTimeoutMs', 120000);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 120000;
  }
  return Math.max(5000, Math.floor(value));
}

export function getProbeTimeoutMs(): number {
  const value = configuration().get<number>('sessionProbeTimeoutMs', 5000);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 5000;
  }
  return Math.max(1000, Math.floor(value));
}

export function getRemoteUploadDebounceMs(): number {
  const value = configuration().get<number>('remoteUploadDebounceMs', 5000);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 5000;
  }
  return Math.max(0, Math.floor(value));
}

export function getRemoteUploadMaxDelayMs(): number {
  const value = configuration().get<number>('remoteUploadMaxDelayMs', 120000);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 120000;
  }
  return Math.max(1000, Math.floor(value));
}

export function getProxySetting(): string {
  return configuration().get<string>('proxy', '') ?? '';
}

export function getSkipUnchanged(): boolean {
  const value = configuration().get<boolean>('skipUnchanged', true);
  return typeof value === 'boolean' ? value : true;
}

export function getConflictPolicy(): ConflictPolicy {
  const value = configuration().get<string>('conflictPolicy', 'ask');
  return value === 'overwrite' || value === 'skipNewer' ? value : 'ask';
}

export function getRetryCount(): number {
  const value = configuration().get<number>('retryCount', 2);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 2;
  }
  return Math.min(5, Math.max(0, Math.floor(value)));
}

export function getKeepAliveEnabled(): boolean {
  const value = configuration().get<boolean>('keepAlive', true);
  return typeof value === 'boolean' ? value : true;
}

export function getKeepAliveIntervalMinutes(): number {
  const value = configuration().get<number>('keepAliveIntervalMinutes', 10);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 10;
  }
  return Math.min(30, Math.max(1, Math.floor(value)));
}

export function getAutoCdRemoteDir(): boolean {
  const value = configuration().get<boolean>('autoCdRemoteDir', true);
  return typeof value === 'boolean' ? value : true;
}

async function updateSetting(key: string, value: unknown): Promise<void> {
  const target = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await configuration().update(key, value, target);
}

export async function setRemoteDir(value: string): Promise<void> {
  const normalized = normalizeRemotePath(value);
  if (!normalized) {
    throw new KaggleError('badRequest', '工作目录不能为空', {
      hint: '填写一个可写目录，例如 news_recommender；Kaggle 上实际位于 /kaggle/working。'
    });
  }
  await updateSetting('remoteDir', normalized);
}

export async function setPathMode(value: PathMode): Promise<void> {
  await updateSetting('pathMode', value === 'basename' ? 'basename' : 'workspaceRelative');
}
