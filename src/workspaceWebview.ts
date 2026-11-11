import * as vscode from 'vscode';
import { JupyterClient, type JupyterContentsEntry } from './client';
import { getRemoteDir, SECRET_KEY } from './config';
import type { ConnectionState } from './core/connectionState';
import {
  describeError,
  isConnectionError,
  KaggleError,
  shortError
} from './core/errors';
import { type RemoteSelectionItem } from './core/remoteActions';
import { normalizeRemotePath } from './core/url';
import {
  FileIconThemeResolver,
  isLightColorTheme,
  type ResolvedIcon
} from './fileIcons';
import type { ProbeCoordinator } from './probe';
import type {
  RemoteMutationHint,
  RemoteWorkspaceService
} from './remoteWorkspaceService';

interface ReadyMessage {
  type: 'ready';
}

interface ListContentsMessage {
  type: 'listContents';
  path: string;
}

interface RefreshContentsMessage {
  type: 'refreshContents';
}

interface ResolveFileIconMessage {
  type: 'resolveFileIcon';
  requestId: number;
  name?: string;
}

interface UiCommandMessage {
  type: 'openUrlSettings' | 'focusConnection';
}

type RemoteAction =
  | 'open'
  | 'download'
  | 'delete'
  | 'rename'
  | 'paste'
  | 'move'
  | 'newFolder'
  | 'newFile';

interface RemoteActionMessage {
  type: 'remoteAction';
  action: RemoteAction;
  path?: string;
  parent?: string;
  newName?: string;
  targetDir?: string;
  clipboardMode?: 'copy' | 'cut';
  entryType?: 'file' | 'directory' | 'notebook';
  entrySize?: number;
  isRoot?: boolean;
  items?: RemoteSelectionItem[];
}

type IncomingMessage =
  | ReadyMessage
  | ListContentsMessage
  | RefreshContentsMessage
  | ResolveFileIconMessage
  | UiCommandMessage
  | RemoteActionMessage;

export interface WorkspaceViewProviderOptions {
  context: vscode.ExtensionContext;
  extensionUri: vscode.Uri;
  clientFactory: (serverUrl: string) => JupyterClient;
  connectionState: ConnectionState;
  probes: ProbeCoordinator;
  service: RemoteWorkspaceService;
  log: (message: string) => void;
  onWorkingDirCreated?: () => void;
}

/**
 * Explorer WebviewView provider for `kaggleConnector.workspace`, preserving
 * inline file/folder creation & renaming, live icon theme resolution, custom
 * context menu, multi-select, and drag-and-drop move.
 */
export class WorkspaceViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  static readonly viewType = 'kaggleConnector.workspace';

  private view?: vscode.WebviewView;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private contentsGeneration = 0;
  private readonly iconResolver = new FileIconThemeResolver();
  private iconThemeSent = false;
  private readonly sentIconKeys = new Set<string>();

  constructor(private readonly options: WorkspaceViewProviderOptions) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.options.extensionUri, 'media')]
    };
    view.webview.onDidReceiveMessage((message: IncomingMessage) => {
      void this.handleMessage(message);
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
      }
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
      }
    });
    view.webview.html = this.html(view.webview);
    void this.refreshContents();
  }

  invalidateIconTheme(): void {
    this.iconResolver.invalidate();
    this.iconThemeSent = false;
    this.sentIconKeys.clear();
  }

  scheduleRefresh(delayMs = 600): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refreshContents();
    }, delayMs);
  }

  startInlineCreate(isDirectory: boolean): void {
    void this.post({ type: 'startCreate', isDirectory });
  }

  async handleMutationHint(hint?: RemoteMutationHint): Promise<void> {
    if (!this.view) {
      return;
    }
    if (!hint || hint.fullRefresh) {
      await this.refreshContents();
      return;
    }
    await this.refreshAfterMutation(hint.invalidate ?? [], hint.parents ?? []);
  }

  async refreshContents(): Promise<void> {
    if (!this.view) {
      return;
    }
    const generation = ++this.contentsGeneration;
    const url = (await this.options.context.secrets.get(SECRET_KEY)) ?? '';
    if (!url) {
      this.options.connectionState.syncUrl('');
      if (generation === this.contentsGeneration) {
        await this.post({ type: 'contentsEmpty', reason: 'no-url' });
      }
      return;
    }

    const remoteDir = getRemoteDir();
    const client = this.options.clientFactory(url);

    const probe = await this.options.probes.probe(url);
    if (!probe.alive) {
      if (generation === this.contentsGeneration) {
        await this.post({
          type: 'contentsError',
          path: remoteDir,
          message: shortError(probe.error)
        });
      }
      return;
    }

    try {
      await this.iconResolver.ensureLoaded();
      await this.sendIconTheme();

      const root = remoteDir;
      let entries: JupyterContentsEntry[];

      try {
        entries = await client.listDirectory(root);
      } catch (error) {
        if (root && error instanceof KaggleError && error.kind === 'notFound') {
          await client.ensureDirectories([root]);
          this.options.log(`远端工作目录不存在，已自动创建并进入: ${root}`);
          entries = await client.listDirectory(root);
          this.options.onWorkingDirCreated?.();
        } else {
          throw error;
        }
      }

      if (generation !== this.contentsGeneration) {
        return;
      }

      const decorated = await this.decorateEntries(entries);
      await this.post({
        type: 'contentsRoot',
        root,
        entries: decorated.entries,
        icons: decorated.icons
      });
    } catch (error) {
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      if (generation !== this.contentsGeneration) {
        return;
      }
      await this.post({
        type: 'contentsError',
        path: remoteDir,
        message: shortError(error)
      });
    }
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private async handleMessage(message: IncomingMessage): Promise<void> {
    try {
      if (message.type === 'ready') {
        this.invalidateIconTheme();
        await this.refreshContents();
        return;
      }

      if (message.type === 'listContents') {
        await this.listContents(message.path);
        return;
      }

      if (message.type === 'refreshContents') {
        this.options.probes.invalidate();
        await this.refreshContents();
        return;
      }

      if (message.type === 'resolveFileIcon') {
        await this.handleResolveFileIcon(message);
        return;
      }

      if (message.type === 'openUrlSettings') {
        await vscode.commands.executeCommand('kaggleConnector.setServerUrl');
        return;
      }

      if (message.type === 'focusConnection') {
        await vscode.commands.executeCommand('kaggleConnector.connection.focus');
        return;
      }

      if (message.type === 'remoteAction') {
        await this.handleRemoteAction(message);
      }
    } catch (error) {
      this.options.log(`工作区消息处理失败: ${describeError(error)}`);
      void vscode.window.showErrorMessage(`操作失败：${shortError(error)}`);
    }
  }

  private async handleRemoteAction(message: RemoteActionMessage): Promise<void> {
    const items = resolveActionItems(message);
    const parent = normalizeRemotePath(message.parent ?? '');

    if (message.action === 'newFolder' || message.action === 'newFile') {
      await this.options.service.createEntry(
        parent,
        message.action === 'newFolder',
        message.newName
      );
      return;
    }

    if (message.action === 'paste') {
      const targetDir = normalizeRemotePath(message.targetDir ?? '');
      const isCut = message.clipboardMode === 'cut';
      const ok = await this.options.service.transferItems(
        items,
        targetDir,
        isCut ? 'move' : 'copy'
      );
      if (ok && isCut) {
        await this.post({ type: 'clearClipboard' });
      }
      return;
    }

    if (message.action === 'move') {
      const targetDir = normalizeRemotePath(message.targetDir ?? '');
      await this.options.service.transferItems(items, targetDir, 'move');
      return;
    }

    if (items.length === 0) {
      void vscode.window.showErrorMessage('不支持对 Jupyter 根目录执行该操作。');
      return;
    }

    if (message.action === 'open') {
      await this.options.service.openItems(items);
      return;
    }

    if (message.action === 'download') {
      await this.options.service.downloadItems(items);
      return;
    }

    if (message.action === 'delete') {
      await this.options.service.deleteItems(items);
      return;
    }

    if (message.action === 'rename') {
      await this.options.service.renameItem(items[0], message.newName);
    }
  }

  private async refreshAfterMutation(
    invalidate: readonly string[],
    parents: readonly string[]
  ): Promise<void> {
    const paths = [...new Set(invalidate.map((item) => normalizeRemotePath(item)))].filter(
      (item) => item !== ''
    );
    if (paths.length > 0) {
      await this.post({ type: 'treeMutation', invalidate: paths });
    }

    const uniqueParents = [...new Set(parents.map((item) => normalizeRemotePath(item)))];
    for (const parent of uniqueParents) {
      await this.listContents(parent);
    }
  }

  private async listContents(path: string): Promise<void> {
    const generation = this.contentsGeneration;
    const url = (await this.options.context.secrets.get(SECRET_KEY)) ?? '';
    if (!url) {
      this.options.connectionState.syncUrl('');
      await this.post({ type: 'contentsEmpty', reason: 'no-url' });
      return;
    }

    try {
      await this.iconResolver.ensureLoaded();
      await this.sendIconTheme();
      const entries = await this.options.clientFactory(url).listDirectory(path);
      if (generation !== this.contentsGeneration) {
        return;
      }
      const decorated = await this.decorateEntries(entries);
      await this.post({
        type: 'listing',
        path,
        entries: decorated.entries,
        icons: decorated.icons
      });
    } catch (error) {
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      if (generation !== this.contentsGeneration) {
        return;
      }
      await this.post({ type: 'listingError', path, message: shortError(error) });
    }
  }

  private async decorateEntries(entries: JupyterContentsEntry[]): Promise<{
    entries: Array<JupyterContentsEntry & { iconKey?: string }>;
    icons: Record<string, ResolvedIcon>;
  }> {
    const light = isLightColorTheme();
    const icons: Record<string, ResolvedIcon> = {};

    const decorated = await Promise.all(
      entries.map(async (entry) => {
        // Folders are rendered with a chevron only, so skip folder icons.
        if (entry.type === 'directory') {
          return { ...entry };
        }

        const reference = await this.iconResolver.resolveFile(entry.name, light);
        if (reference && !this.sentIconKeys.has(reference.key)) {
          this.sentIconKeys.add(reference.key);
          icons[reference.key] = reference.icon;
        }

        return { ...entry, iconKey: reference?.key };
      })
    );

    return { entries: decorated, icons };
  }

  private async sendIconTheme(): Promise<void> {
    if (this.iconThemeSent) {
      return;
    }
    this.iconThemeSent = true;
    const defaultFile = await this.iconResolver.resolveDefaultFile(isLightColorTheme());
    if (defaultFile) {
      this.sentIconKeys.add(defaultFile.key);
    }
    await this.post({
      type: 'iconTheme',
      fonts: this.iconResolver.getFonts(),
      defaultFileIconKey: defaultFile?.key,
      defaultFileIcon: defaultFile?.icon
    });
  }

  private async handleResolveFileIcon(message: ResolveFileIconMessage): Promise<void> {
    const trimmed = typeof message.name === 'string' ? message.name.trim() : '';
    const light = isLightColorTheme();
    const reference = trimmed
      ? await this.iconResolver.resolveFile(trimmed, light)
      : await this.iconResolver.resolveDefaultFile(light);
    let icon: ResolvedIcon | undefined;
    if (reference && !this.sentIconKeys.has(reference.key)) {
      this.sentIconKeys.add(reference.key);
      icon = reference.icon;
    }
    await this.post({
      type: 'resolvedFileIcon',
      requestId: message.requestId,
      name: trimmed,
      iconKey: reference?.key,
      icon
    });
  }

  private async post(message: unknown): Promise<void> {
    await this.view?.webview.postMessage(message);
  }

  private html(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.options.extensionUri, 'media', 'workspace.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.options.extensionUri, 'media', 'workspace.js')
    );
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
      'img-src data:',
      'font-src data:'
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Kaggle Workspace</title>
</head>
<body>
  <div id="app" class="app">
    <div class="contents-scroll">
      <div id="contentsBody" class="contents-body" role="tree" aria-multiselectable="true" aria-label="Kaggle Workspace 目录树"></div>
      <div id="contentsScrollbar" class="custom-scrollbar" aria-hidden="true">
        <div id="contentsScrollbarThumb" class="custom-scrollbar-thumb"></div>
      </div>
    </div>
  </div>

  <div id="contextMenu" class="context-menu hidden" role="menu" aria-label="远端文件操作" tabindex="-1"></div>
  <div id="renameError" class="rename-error hidden" role="alert"></div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function resolveActionItems(message: RemoteActionMessage): RemoteSelectionItem[] {
  if (Array.isArray(message.items) && message.items.length > 0) {
    const resolved: RemoteSelectionItem[] = [];
    for (const item of message.items) {
      if (!item || typeof item.path !== 'string') {
        continue;
      }
      const normalized = normalizeRemotePath(item.path);
      if (!normalized) {
        continue;
      }
      resolved.push({
        path: normalized,
        entryType: item.entryType,
        entrySize: typeof item.entrySize === 'number' ? item.entrySize : undefined,
        isRoot: Boolean(item.isRoot)
      });
    }
    return resolved;
  }

  const single = normalizeRemotePath(message.path ?? '');
  if (!single) {
    return [];
  }
  return [
    {
      path: single,
      entryType: message.entryType,
      entrySize: message.entrySize,
      isRoot: Boolean(message.isRoot)
    }
  ];
}

