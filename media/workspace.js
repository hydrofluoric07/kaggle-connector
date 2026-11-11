(function () {
  const vscode = acquireVsCodeApi();

  const contentsBody = document.getElementById('contentsBody');
  const contentsScrollArea = document.querySelector('.contents-scroll');
  const contentsScrollbarEl = document.getElementById('contentsScrollbar');
  const contentsScrollbarThumb = document.getElementById('contentsScrollbarThumb');
  const contextMenu = document.getElementById('contextMenu');
  const renameErrorEl = document.getElementById('renameError');

  const contentsScrollbar = setupOverlayScrollbar(
    contentsScrollArea,
    contentsBody,
    contentsScrollbarEl,
    contentsScrollbarThumb
  );

  let contentsRoot = null;
  let rootMessage = null;
  const listingCache = new Map();
  const expanded = new Set();
  const loading = new Set();
  const listingErrors = new Map();
  const iconCache = new Map();
  const nameIconCache = new Map();
  let defaultFileIconKey = null;
  let iconRequestSeq = 0;
  const loadedFonts = new Set();
  const initialContentsState = vscode.getState() || {};
  let rootExpanded =
    typeof initialContentsState.rootExpanded === 'boolean'
      ? initialContentsState.rootExpanded
      : true;
  let lastContentsRoot = null;
  let contextMenuAnchor = null;
  const ROOT_ANIMATE = Symbol('kaggle-root');
  const collapsingPaths = new Set();
  let rootCollapsing = false;
  const selectedItems = new Map();
  let selectionAnchorPath = null;
  let clipboard = null;
  let renamingState = null;
  let pendingCreate = null;
  let dragState = null;
  const DRAG_MIME = 'application/x-kaggle-remote-paths';
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
  const SHORTCUT = isMac
    ? { cut: '⌘X', copy: '⌘C', paste: '⌘V', rename: 'F2', delete: '⌫' }
    : { cut: 'Ctrl+X', copy: 'Ctrl+C', paste: 'Ctrl+V', rename: 'F2', delete: 'Delete' };

  function setupOverlayScrollbar(scrollArea, scrollEl, trackEl, thumbEl) {
    let hovering = false;
    let dragging = false;
    let hideTimer;
    let dragStartY = 0;
    let dragStartScroll = 0;

    function update() {
      const clientHeight = scrollEl.clientHeight;
      const scrollHeight = scrollEl.scrollHeight;
      if (clientHeight <= 0 || scrollHeight <= clientHeight + 1) {
        trackEl.classList.add('disabled');
        return;
      }

      trackEl.classList.remove('disabled');
      const trackHeight = trackEl.clientHeight;
      if (trackHeight <= 0) {
        return;
      }

      const thumbHeight = Math.max(24, Math.round((clientHeight / scrollHeight) * trackHeight));
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const top =
        maxScroll > 0 ? Math.round((scrollEl.scrollTop / maxScroll) * maxThumbTop) : 0;

      thumbEl.style.height = thumbHeight + 'px';
      thumbEl.style.transform = 'translateY(' + top + 'px)';

      if (hovering) {
        trackEl.classList.add('visible');
      }
    }

    function show() {
      if (trackEl.classList.contains('disabled')) {
        return;
      }
      clearTimeout(hideTimer);
      trackEl.classList.add('visible');
    }

    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!hovering && !dragging) {
          trackEl.classList.remove('visible');
        }
      }, 1200);
    }

    scrollEl.addEventListener('scroll', function () {
      update();
      show();
      if (!hovering) {
        scheduleHide();
      }
    });

    scrollArea.addEventListener('mouseenter', function () {
      hovering = true;
      update();
      show();
    });

    scrollArea.addEventListener('mouseleave', function () {
      hovering = false;
      scheduleHide();
    });

    thumbEl.addEventListener('pointerdown', function (event) {
      dragging = true;
      dragStartY = event.clientY;
      dragStartScroll = scrollEl.scrollTop;
      clearTimeout(hideTimer);
      trackEl.classList.add('visible', 'dragging');
      try {
        thumbEl.setPointerCapture(event.pointerId);
      } catch (_) {
        // ignore
      }
      event.preventDefault();
      event.stopPropagation();
    });

    trackEl.addEventListener('pointerdown', function (event) {
      if (event.target === thumbEl) {
        return;
      }
      const thumbRect = thumbEl.getBoundingClientRect();
      const page = scrollEl.clientHeight * 0.9;
      scrollEl.scrollTop += event.clientY < thumbRect.top ? -page : page;
      update();
      event.preventDefault();
    });

    trackEl.addEventListener(
      'wheel',
      function (event) {
        if (trackEl.classList.contains('disabled')) {
          return;
        }
        scrollEl.scrollTop += event.deltaY;
        event.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener('pointermove', function (event) {
      if (!dragging) {
        return;
      }
      const trackHeight = trackEl.clientHeight;
      const thumbHeight = thumbEl.offsetHeight;
      const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
      const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
      const delta = event.clientY - dragStartY;
      scrollEl.scrollTop = dragStartScroll + (delta / maxThumbTop) * maxScroll;
      event.preventDefault();
    });

    function endDrag(event) {
      if (!dragging) {
        return;
      }
      dragging = false;
      trackEl.classList.remove('dragging');
      try {
        thumbEl.releasePointerCapture(event.pointerId);
      } catch (_) {
        // ignore
      }
      scheduleHide();
    }

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(function () {
        update();
      });
      observer.observe(scrollArea);
      observer.observe(scrollEl);
    }

    update();
    window.requestAnimationFrame(update);
    return { update: update, show: show };
  }

  function remoteDirname(remotePath) {
    const idx = remotePath.lastIndexOf('/');
    return idx < 0 ? '' : remotePath.slice(0, idx);
  }

  function remoteBasename(remotePath) {
    const idx = remotePath.lastIndexOf('/');
    return idx < 0 ? remotePath : remotePath.slice(idx + 1);
  }

  function isRemoteInsideOrEqualPath(parent, child) {
    if (!parent) {
      return true;
    }
    return child === parent || child.indexOf(parent + '/') === 0;
  }

  function toSelectionItem(info) {
    return {
      path: info.path,
      entryType: info.type,
      entrySize: info.size,
      isRoot: Boolean(info.isRoot)
    };
  }

  function getSelectedItems() {
    const rows = Array.prototype.slice.call(contentsBody.querySelectorAll('.tree-row'));
    const ordered = [];
    rows.forEach(function (row) {
      const item = selectedItems.get(row.dataset.path || '');
      if (item) {
        ordered.push(item);
      }
    });
    return ordered.length > 0 ? ordered : Array.from(selectedItems.values());
  }

  function getSelectedNonRootItems() {
    return getSelectedItems().filter(function (item) {
      return !item.isRoot;
    });
  }

  function syncSelectionDom() {
    const cutPaths = new Set(
      clipboard && clipboard.mode === 'cut'
        ? clipboard.items.map(function (item) {
            return item.path;
          })
        : []
    );
    const rows = contentsBody.querySelectorAll('.tree-row');
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const path = row.dataset.path || '';
      const isSelected = !row.classList.contains('root-row') && selectedItems.has(path);
      row.classList.toggle('selected', isSelected);
      row.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      row.classList.toggle('cut', cutPaths.has(path));
    }
  }

  function pruneInvisibleSelection() {
    if (contentsRoot === null || rootMessage) {
      return;
    }
    const visiblePaths = new Set();
    const rows = contentsBody.querySelectorAll('.tree-row');
    for (let index = 0; index < rows.length; index += 1) {
      visiblePaths.add(rows[index].dataset.path || '');
    }
    Array.from(selectedItems.keys()).forEach(function (path) {
      if (!visiblePaths.has(path)) {
        selectedItems.delete(path);
      }
    });
    if (selectionAnchorPath && !visiblePaths.has(selectionAnchorPath)) {
      selectionAnchorPath = null;
    }
  }

  function pruneSelectionBelow(dirPath) {
    Array.from(selectedItems.keys()).forEach(function (path) {
      if (path !== dirPath && isRemoteInsideOrEqualPath(dirPath, path)) {
        selectedItems.delete(path);
      }
    });
    if (
      selectionAnchorPath &&
      selectionAnchorPath !== dirPath &&
      isRemoteInsideOrEqualPath(dirPath, selectionAnchorPath)
    ) {
      selectionAnchorPath = null;
    }
  }

  function selectSingle(info) {
    selectedItems.clear();
    if (!info.isRoot) {
      selectedItems.set(info.path, toSelectionItem(info));
      selectionAnchorPath = info.path;
    } else {
      selectionAnchorPath = null;
    }
    syncSelectionDom();
  }

  function clearSelection() {
    if (selectedItems.size === 0 && !selectionAnchorPath) {
      return;
    }
    selectedItems.clear();
    selectionAnchorPath = null;
    syncSelectionDom();
  }

  function handleRowSelectionClick(event, info, onPlainClick) {
    if (renamingState) {
      if (renamingState.path === info.path) {
        return;
      }
      commitInlineRename(true);
    }

    const isToggle = event.ctrlKey || event.metaKey;
    const isRange = event.shiftKey;

    if (info.isRoot) {
      clearSelection();
      onPlainClick();
      return;
    }

    Array.from(selectedItems.values()).forEach(function (item) {
      if (item.isRoot) {
        selectedItems.delete(item.path);
      }
    });

    if (isRange && selectionAnchorPath) {
      const rows = Array.prototype.slice
        .call(contentsBody.querySelectorAll('.tree-row'))
        .filter(function (row) {
          return !row.classList.contains('root-row');
        });
      const anchorIndex = rows.findIndex(function (row) {
        return row.dataset.path === selectionAnchorPath;
      });
      const targetIndex = rows.findIndex(function (row) {
        return row.dataset.path === info.path;
      });
      if (anchorIndex >= 0 && targetIndex >= 0) {
        if (!isToggle) {
          selectedItems.clear();
        }
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        for (let i = start; i <= end; i += 1) {
          const rowInfo = rowMenuInfo(rows[i]);
          selectedItems.set(rowInfo.path, toSelectionItem(rowInfo));
        }
        syncSelectionDom();
        return;
      }
    }

    if (isToggle) {
      if (selectedItems.has(info.path)) {
        selectedItems.delete(info.path);
      } else {
        selectedItems.set(info.path, toSelectionItem(info));
      }
      selectionAnchorPath = info.path;
      syncSelectionDom();
      return;
    }

    selectSingle(info);
    onPlainClick();
  }

  function setClipboard(mode, items) {
    const valid = items.filter(function (item) {
      return !item.isRoot && Boolean(item.path);
    });
    if (valid.length === 0) {
      return;
    }
    clipboard = { mode: mode, items: valid };
    syncSelectionDom();
  }

  function hasClipboardItems() {
    return Boolean(clipboard && Array.isArray(clipboard.items) && clipboard.items.length > 0);
  }

  function closeContextMenu(restoreFocus) {
    contentsBody.classList.remove('menu-open');
    if (!contextMenu || contextMenu.classList.contains('hidden')) {
      contextMenuAnchor = null;
      return;
    }
    const anchor = contextMenuAnchor;
    contextMenuAnchor = null;
    contextMenu.classList.add('hidden');
    contextMenu.textContent = '';
    if (restoreFocus && anchor && document.contains(anchor)) {
      anchor.focus();
    }
  }

  function invalidateSubtree(path) {
    const normalized = typeof path === 'string' ? path : '';
    function matches(key) {
      return (
        key === normalized ||
        (normalized !== '' && key.indexOf(normalized + '/') === 0)
      );
    }
    Array.from(expanded).forEach(function (key) {
      if (matches(key)) expanded.delete(key);
    });
    Array.from(listingCache.keys()).forEach(function (key) {
      if (matches(key)) listingCache.delete(key);
    });
    Array.from(loading).forEach(function (key) {
      if (matches(key)) loading.delete(key);
    });
    Array.from(listingErrors.keys()).forEach(function (key) {
      if (matches(key)) listingErrors.delete(key);
    });
    Array.from(collapsingPaths).forEach(function (key) {
      if (matches(key)) collapsingPaths.delete(key);
    });
    Array.from(selectedItems.keys()).forEach(function (key) {
      if (matches(key)) selectedItems.delete(key);
    });
    if (clipboard && Array.isArray(clipboard.items)) {
      clipboard.items = clipboard.items.filter(function (item) {
        return !matches(item.path);
      });
      if (clipboard.items.length === 0) {
        clipboard = null;
      }
    }
  }

  function rowMenuInfo(row) {
    const size = Number(row.dataset.size);
    return {
      path: row.dataset.path || '',
      type: row.dataset.type || 'file',
      size: Number.isFinite(size) && size >= 0 ? size : undefined,
      isRoot: row.classList.contains('root-row')
    };
  }

  function pasteTargetForInfo(info) {
    if (!info) {
      return contentsRoot;
    }
    return info.type === 'directory' ? info.path : remoteDirname(info.path);
  }

  function buildRowMenu(info) {
    const selected = getSelectedItems();
    if (selected.length > 1 && selectedItems.has(info.path)) {
      const items = [];
      const allFiles = selected.every(function (item) {
        return item.entryType !== 'directory';
      });
      const hasRoot = selected.some(function (item) {
        return item.isRoot;
      });
      if (allFiles) {
        items.push({ label: '打开', action: 'open', items: selected });
      }
      items.push({ label: '下载', action: 'download', items: selected });
      items.push({ separator: true });
      if (!hasRoot) {
        items.push({
          label: '剪切',
          shortcut: SHORTCUT.cut,
          localAction: 'cut',
          items: selected
        });
        items.push({
          label: '复制',
          shortcut: SHORTCUT.copy,
          localAction: 'copy',
          items: selected
        });
      }
      if (contentsRoot !== null) {
        items.push({
          label: '粘贴',
          shortcut: SHORTCUT.paste,
          action: 'paste',
          targetDir: pasteTargetForInfo(info),
          disabled: !hasClipboardItems()
        });
      }
      items.push({ separator: true });
      items.push({
        label: '删除',
        shortcut: SHORTCUT.delete,
        action: 'delete',
        items: selected
      });
      items.push({ separator: true });
      items.push({ label: '刷新', action: 'refresh' });
      return items;
    }

    const items = [];
    const isRoot = info.isRoot;
    const rootEmpty = isRoot && !contentsRoot;
    const isDirectory = info.type === 'directory';

    if (isDirectory) {
      items.push({ label: '新建文件夹', localAction: 'newFolder', parent: info.path });
      items.push({ label: '新建文件', localAction: 'newFile', parent: info.path });
      items.push({ separator: true });
    }

    if (!rootEmpty) {
      if (!isDirectory) {
        items.push({
          label: '打开',
          action: 'open',
          path: info.path,
          entryType: info.type
        });
      }
      items.push({
        label: '下载',
        action: 'download',
        path: info.path,
        entryType: info.type,
        entrySize: info.size,
        isRoot: isRoot
      });
      items.push({ separator: true });
      if (!isRoot) {
        items.push({
          label: '剪切',
          shortcut: SHORTCUT.cut,
          localAction: 'cut',
          items: [toSelectionItem(info)]
        });
        items.push({
          label: '复制',
          shortcut: SHORTCUT.copy,
          localAction: 'copy',
          items: [toSelectionItem(info)]
        });
      }
      items.push({
        label: '粘贴',
        shortcut: SHORTCUT.paste,
        action: 'paste',
        targetDir: pasteTargetForInfo(info),
        disabled: !hasClipboardItems()
      });
      items.push({ separator: true });
      items.push({
        label: '重命名',
        shortcut: SHORTCUT.rename,
        localAction: 'rename',
        path: info.path
      });
      items.push({
        label: '删除',
        shortcut: SHORTCUT.delete,
        action: 'delete',
        path: info.path,
        entryType: info.type,
        isRoot: isRoot
      });
      items.push({ separator: true });
    } else if (contentsRoot !== null) {
      items.push({
        label: '粘贴',
        shortcut: SHORTCUT.paste,
        action: 'paste',
        targetDir: contentsRoot,
        disabled: !hasClipboardItems()
      });
      items.push({ separator: true });
    }

    items.push({ label: '刷新', action: 'refresh' });
    return items;
  }

  function buildBlankMenu() {
    const items = [];
    if (contentsRoot !== null) {
      items.push({ label: '新建文件夹', localAction: 'newFolder', parent: contentsRoot });
      items.push({ label: '新建文件', localAction: 'newFile', parent: contentsRoot });
      items.push({ separator: true });
      items.push({
        label: '粘贴',
        shortcut: SHORTCUT.paste,
        action: 'paste',
        targetDir: contentsRoot,
        disabled: !hasClipboardItems()
      });
      items.push({ separator: true });
    }
    items.push({ label: '刷新', action: 'refresh' });
    return items;
  }

  function triggerPaste(targetDir) {
    if (!hasClipboardItems() || targetDir === null || targetDir === undefined) {
      return;
    }
    vscode.postMessage({
      type: 'remoteAction',
      action: 'paste',
      targetDir: targetDir,
      clipboardMode: clipboard.mode,
      items: clipboard.items.slice()
    });
  }

  function showContextMenu(x, y, items, anchor, focusFirst) {
    if (!contextMenu) {
      return;
    }
    contextMenu.textContent = '';
    contextMenuAnchor = anchor || null;
    contextMenu.style.visibility = 'hidden';
    contentsBody.classList.add('menu-open');

    items.forEach(function (item) {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        separator.setAttribute('role', 'separator');
        contextMenu.appendChild(separator);
        return;
      }

      const element = document.createElement('div');
      element.className = 'context-menu-item' + (item.disabled ? ' disabled' : '');
      element.setAttribute('role', 'menuitem');
      element.tabIndex = -1;
      if (item.disabled) {
        element.setAttribute('aria-disabled', 'true');
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      element.appendChild(labelSpan);

      if (item.shortcut) {
        const shortcutSpan = document.createElement('span');
        shortcutSpan.className = 'context-menu-shortcut';
        shortcutSpan.textContent = item.shortcut;
        element.appendChild(shortcutSpan);
      }

      element.addEventListener('click', function (event) {
        event.stopPropagation();
        if (item.disabled) {
          return;
        }
        if (item.localAction === 'rename') {
          closeContextMenu(false);
          const row = findRow(item.path);
          if (row) {
            startInlineRename(row);
          }
          return;
        }
        if (item.localAction === 'newFolder' || item.localAction === 'newFile') {
          closeContextMenu(false);
          startInlineCreate(item.parent, item.localAction === 'newFolder');
          return;
        }
        closeContextMenu(true);
        if (item.localAction === 'cut' || item.localAction === 'copy') {
          setClipboard(item.localAction, item.items || []);
          return;
        }
        if (item.action === 'refresh') {
          requestRefresh();
          return;
        }
        if (item.action === 'paste') {
          triggerPaste(item.targetDir);
          return;
        }
        vscode.postMessage({
          type: 'remoteAction',
          action: item.action,
          path: item.path,
          parent: item.parent,
          targetDir: item.targetDir,
          entryType: item.entryType,
          entrySize: item.entrySize,
          isRoot: Boolean(item.isRoot),
          items: item.items
        });
      });
      contextMenu.appendChild(element);
    });

    contextMenu.classList.remove('hidden');
    contextMenu.style.left = '0px';
    contextMenu.style.top = '0px';
    const rect = contextMenu.getBoundingClientRect();
    const maxX = Math.max(4, window.innerWidth - rect.width - 4);
    const maxY = Math.max(4, window.innerHeight - rect.height - 4);
    contextMenu.style.left = Math.min(Math.max(4, x), maxX) + 'px';
    contextMenu.style.top = Math.min(Math.max(4, y), maxY) + 'px';
    contextMenu.style.visibility = '';

    if (focusFirst) {
      const first = contextMenu.querySelector('.context-menu-item:not(.disabled)');
      if (first) {
        first.focus();
      }
    } else {
      contextMenu.focus({ preventScroll: true });
    }
  }

  function hideRenameError() {
    if (renameErrorEl) {
      renameErrorEl.classList.add('hidden');
      renameErrorEl.textContent = '';
    }
  }

  function showRenameError(input, message) {
    if (!renameErrorEl) {
      return;
    }
    renameErrorEl.textContent = message;
    renameErrorEl.classList.remove('hidden');
    const rect = input.getBoundingClientRect();
    const box = renameErrorEl.getBoundingClientRect();
    const left = Math.min(Math.max(4, rect.left), Math.max(4, window.innerWidth - box.width - 4));
    let top = rect.bottom + 2;
    if (top + box.height > window.innerHeight - 4) {
      top = Math.max(4, rect.top - box.height - 2);
    }
    renameErrorEl.style.left = left + 'px';
    renameErrorEl.style.top = top + 'px';
  }

  function validateInlineRename(rawValue, state) {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return state.mode === 'create'
        ? '必须提供' + (state.isDirectory ? '文件夹' : '文件') + '名'
        : '名称不能为空';
    }
    if (trimmed === '.' || trimmed === '..') {
      return '名称无效';
    }
    if (/[\\/]/.test(trimmed)) {
      return '名称不能包含斜杠';
    }
    if (!state.isRoot) {
      const siblings = listingCache.get(state.parentPath) || [];
      const conflict = siblings.some(function (entry) {
        return entry.name === trimmed && (state.mode === 'create' || trimmed !== state.originalName);
      });
      if (conflict) {
        return '此位置已存在 “' + trimmed + '”';
      }
    }
    return '';
  }

  function cleanupInlineRename(restoreFocus) {
    if (!renamingState) {
      return;
    }
    const state = renamingState;
    renamingState = null;
    hideRenameError();
    if (state.mode === 'create') {
      if (state.row.parentNode) {
        state.row.remove();
      }
      if (state.hiddenEmptyEl) {
        state.hiddenEmptyEl.style.display = '';
      }
      if (restoreFocus && state.parentRow && document.contains(state.parentRow)) {
        state.parentRow.focus();
      }
      contentsScrollbar.update();
      return;
    }
    state.row.classList.remove('renaming');
    state.row.draggable = !state.isRoot;
    if (state.iconEl && state.originalIconKey !== undefined) {
      applyIconToElement(state.iconEl, state.originalIconKey, state.entryType || 'file');
    }
    if (state.input.parentNode === state.row) {
      state.input.remove();
    }
    state.nameEl.classList.remove('hidden');
    if (restoreFocus && document.contains(state.row)) {
      state.row.focus();
    }
  }

  function cancelInlineRename(restoreFocus) {
    if (!renamingState || renamingState.handled) {
      return;
    }
    renamingState.handled = true;
    cleanupInlineRename(restoreFocus);
  }

  function commitInlineRename(fromBlur) {
    if (!renamingState || renamingState.handled) {
      return;
    }
    const state = renamingState;
    const raw = state.input.value;
    const trimmed = raw.trim();
    if (
      (state.mode === 'rename' && (!trimmed || trimmed === state.originalName)) ||
      (state.mode === 'create' && !trimmed && fromBlur)
    ) {
      state.handled = true;
      cleanupInlineRename(!fromBlur);
      return;
    }

    const error = validateInlineRename(raw, state);
    if (error) {
      if (fromBlur) {
        state.handled = true;
        cleanupInlineRename(false);
        return;
      }
      state.input.classList.add('invalid');
      showRenameError(state.input, error);
      state.input.focus();
      return;
    }

    state.handled = true;
    cleanupInlineRename(!fromBlur);
    if (state.mode === 'create') {
      vscode.postMessage({
        type: 'remoteAction',
        action: state.isDirectory ? 'newFolder' : 'newFile',
        parent: state.parentPath,
        newName: trimmed
      });
      return;
    }
    vscode.postMessage({
      type: 'remoteAction',
      action: 'rename',
      path: state.path,
      newName: trimmed,
      entryType: state.entryType,
      isRoot: state.isRoot
    });
  }

  function applyIconToElement(iconEl, iconKey, fallbackType) {
    if (!iconEl) {
      return;
    }
    iconEl.textContent = '';
    iconEl.className = 'entry-icon';
    const resolved = iconKey ? iconCache.get(iconKey) : undefined;
    if (resolved) {
      renderResolvedIcon(iconEl, resolved);
    } else {
      iconEl.classList.add(iconClass(fallbackType || 'file'));
    }
  }

  function requestLiveFileIcon(state) {
    if (!state || state.isDirectory || !state.iconEl) {
      return;
    }
    const trimmed = state.input.value.trim();
    if (!trimmed) {
      state.iconRequestId = ++iconRequestSeq;
      applyIconToElement(state.iconEl, defaultFileIconKey, 'file');
      return;
    }
    const cacheKey = trimmed.toLowerCase();
    if (nameIconCache.has(cacheKey)) {
      state.iconRequestId = ++iconRequestSeq;
      applyIconToElement(
        state.iconEl,
        nameIconCache.get(cacheKey),
        state.entryType || 'file'
      );
      return;
    }
    const reqId = ++iconRequestSeq;
    state.iconRequestId = reqId;
    vscode.postMessage({
      type: 'resolveFileIcon',
      requestId: reqId,
      name: trimmed
    });
  }

  function bindInlineInputEvents(input, state) {
    input.addEventListener('click', function (event) {
      event.stopPropagation();
    });
    input.addEventListener('dblclick', function (event) {
      event.stopPropagation();
    });
    input.addEventListener('input', function () {
      const err = validateInlineRename(input.value, state);
      if (err) {
        input.classList.add('invalid');
        showRenameError(input, err);
      } else {
        input.classList.remove('invalid');
        hideRenameError();
      }
      requestLiveFileIcon(state);
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        commitInlineRename(false);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelInlineRename(true);
      }
    });
    input.addEventListener('blur', function () {
      commitInlineRename(true);
    });
  }

  function startInlineRename(row) {
    const info = rowMenuInfo(row);
    if (info.isRoot && !contentsRoot) {
      return;
    }
    if (renamingState) {
      cancelInlineRename(false);
    }

    const nameEl = row.querySelector('.entry-name');
    if (!nameEl) {
      return;
    }

    const originalName = remoteBasename(info.path);
    const parentPath = remoteDirname(info.path);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = originalName;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', '重命名 ' + originalName);

    const iconEl = info.type !== 'directory' ? row.querySelector('.entry-icon') : null;
    const state = {
      mode: 'rename',
      path: info.path,
      isRoot: info.isRoot,
      isDirectory: info.type === 'directory',
      entryType: info.type,
      parentPath: parentPath,
      originalName: originalName,
      row: row,
      nameEl: nameEl,
      iconEl: iconEl,
      originalIconKey: row.dataset.iconKey || null,
      iconRequestId: 0,
      openedAt: Date.now(),
      input: input,
      handled: false
    };
    renamingState = state;

    row.classList.add('renaming');
    row.draggable = false;
    nameEl.classList.add('hidden');
    row.appendChild(input);
    bindInlineInputEvents(input, state);

    input.focus();
    const dot = originalName.lastIndexOf('.');
    if (info.type !== 'directory' && dot > 0) {
      input.setSelectionRange(0, dot);
    } else {
      input.select();
    }
  }

  function resolveCreateTargetParent() {
    if (contentsRoot === null) {
      return '';
    }
    const preferred =
      selectionAnchorPath && selectedItems.has(selectionAnchorPath)
        ? selectedItems.get(selectionAnchorPath)
        : Array.from(selectedItems.values())[0];
    if (!preferred || preferred.isRoot) {
      return contentsRoot;
    }
    return preferred.entryType === 'directory'
      ? preferred.path
      : remoteDirname(preferred.path);
  }

  function startInlineCreate(parentPath, isDirectory) {
    if (contentsRoot === null) {
      return;
    }
    if (renamingState) {
      commitInlineRename(true);
      if (renamingState) {
        cancelInlineRename(false);
      }
    }
    const targetParent = typeof parentPath === 'string' ? parentPath : contentsRoot;
    let parentRow = findRow(targetParent);
    if (!parentRow) {
      return;
    }

    if (targetParent === contentsRoot) {
      if (!rootExpanded) {
        rootExpanded = true;
        saveRootExpanded();
        renderContents(ROOT_ANIMATE);
      }
    } else if (!expanded.has(targetParent)) {
      expanded.add(targetParent);
      if (!listingCache.has(targetParent) && !loading.has(targetParent)) {
        pendingCreate = { parentPath: targetParent, isDirectory: isDirectory };
        requestListing(targetParent);
        return;
      }
      renderContents(targetParent);
    } else if (loading.has(targetParent) || !listingCache.has(targetParent)) {
      pendingCreate = { parentPath: targetParent, isDirectory: isDirectory };
      if (!loading.has(targetParent)) {
        requestListing(targetParent);
      }
      return;
    }

    parentRow = findRow(targetParent);
    const childBox = parentRow && parentRow.nextElementSibling;
    const treeLevel =
      childBox && childBox.classList.contains('tree-children')
        ? childBox.querySelector('.tree-level')
        : null;
    if (!parentRow || !treeLevel) {
      return;
    }

    const level = Number(parentRow.getAttribute('aria-level')) || 1;
    const draftRow = document.createElement('div');
    draftRow.className = 'tree-row renaming' + (isDirectory ? ' directory' : '');
    draftRow.style.paddingLeft = rowPadding(level) + 'px';
    draftRow.draggable = false;

    let iconEl = null;
    if (isDirectory) {
      draftRow.appendChild(createChevron(false));
    } else {
      iconEl = document.createElement('span');
      applyIconToElement(iconEl, defaultFileIconKey, 'file');
      draftRow.appendChild(iconEl);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = '';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', isDirectory ? '新建文件夹名称' : '新建文件名称');
    draftRow.appendChild(input);

    const emptyMsg = treeLevel.querySelector(':scope > .tree-message');
    if (emptyMsg) {
      emptyMsg.style.display = 'none';
    }

    let insertBeforeNode = null;
    if (isDirectory) {
      insertBeforeNode = treeLevel.firstChild;
    } else {
      const children = treeLevel.children;
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (
          child.classList &&
          child.classList.contains('tree-row') &&
          !child.classList.contains('directory')
        ) {
          insertBeforeNode = child;
          break;
        }
      }
    }
    treeLevel.insertBefore(draftRow, insertBeforeNode);
    draftRow.scrollIntoView({ block: 'nearest' });
    contentsScrollbar.update();

    const state = {
      mode: 'create',
      isDirectory: isDirectory,
      isRoot: false,
      entryType: isDirectory ? 'directory' : 'file',
      parentPath: targetParent,
      parentRow: parentRow,
      hiddenEmptyEl: emptyMsg || null,
      row: draftRow,
      iconEl: iconEl,
      iconRequestId: 0,
      openedAt: Date.now(),
      input: input,
      handled: false
    };
    renamingState = state;
    bindInlineInputEvents(input, state);
    input.focus();
  }

  function isValidDropTarget(items, targetDir) {
    if (targetDir === null || targetDir === undefined || !items || items.length === 0) {
      return false;
    }
    const movesSomething = items.some(function (item) {
      return remoteDirname(item.path) !== targetDir;
    });
    if (!movesSomething) {
      return false;
    }
    return items.every(function (item) {
      return !(item.entryType === 'directory' && isRemoteInsideOrEqualPath(item.path, targetDir));
    });
  }

  function setDropTargetHighlight(targetDir) {
    if (dragState) {
      dragState.currentDropTargetDir = targetDir;
    }
    const previous = contentsBody.querySelectorAll('.tree-row.drop-target');
    for (let i = 0; i < previous.length; i += 1) {
      previous[i].classList.remove('drop-target');
    }
    if (targetDir === null || targetDir === undefined) {
      return;
    }
    const targetRow = findRow(targetDir);
    if (targetRow) {
      targetRow.classList.add('drop-target');
    }
  }

  function clearDragHoverTimer() {
    if (dragState && dragState.hoverTimer) {
      clearTimeout(dragState.hoverTimer);
      dragState.hoverTimer = null;
    }
    if (dragState) {
      dragState.hoverDir = null;
    }
  }

  function stopDragAutoScroll() {
    if (dragState && dragState.autoScrollRaf) {
      cancelAnimationFrame(dragState.autoScrollRaf);
      dragState.autoScrollRaf = null;
    }
    if (dragState) {
      dragState.scrollVelocity = 0;
    }
  }

  function updateDragAutoScroll(clientY) {
    if (!dragState) {
      return;
    }
    const rect = contentsBody.getBoundingClientRect();
    const edge = 28;
    let velocity = 0;
    if (clientY < rect.top + edge) {
      velocity = -Math.max(2, Math.round((edge - Math.max(0, clientY - rect.top)) / 4));
    } else if (clientY > rect.bottom - edge) {
      velocity = Math.max(2, Math.round((edge - Math.max(0, rect.bottom - clientY)) / 4));
    }
    dragState.scrollVelocity = velocity;
    if (velocity !== 0 && !dragState.autoScrollRaf) {
      const step = function () {
        if (!dragState || dragState.scrollVelocity === 0) {
          if (dragState) {
            dragState.autoScrollRaf = null;
          }
          return;
        }
        contentsBody.scrollTop += dragState.scrollVelocity;
        dragState.autoScrollRaf = requestAnimationFrame(step);
      };
      dragState.autoScrollRaf = requestAnimationFrame(step);
    }
  }

  function cleanupDragState() {
    if (!dragState) {
      return;
    }
    clearDragHoverTimer();
    stopDragAutoScroll();
    setDropTargetHighlight(null);
    contentsBody.classList.remove('dragging-items');
    dragState = null;
  }

  function isPointOverChevron(row, clientX, clientY) {
    const chevron = row.querySelector('.chevron');
    if (!chevron) {
      return false;
    }
    const rect = chevron.getBoundingClientRect();
    const pad = 2;
    return (
      clientX >= rect.left - pad &&
      clientX <= rect.right + pad &&
      clientY >= rect.top - pad &&
      clientY <= rect.bottom + pad
    );
  }

  function resolveDropTargetFromEvent(event) {
    const target = event.target;
    const row =
      target && typeof target.closest === 'function'
        ? target.closest('.tree-row')
        : null;
    if (row) {
      const info = rowMenuInfo(row);
      if (info.type === 'directory') {
        return { row: row, info: info, targetDir: info.path };
      }
      return {
        row: row,
        info: info,
        targetDir: remoteDirname(info.path)
      };
    }
    if (contentsRoot !== null) {
      return { row: null, info: null, targetDir: contentsRoot };
    }
    return { row: null, info: null, targetDir: null };
  }

  if (contextMenu) {
    contextMenu.addEventListener('contextmenu', function (event) {
      event.preventDefault();
    });

    contextMenu.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeContextMenu(true);
        return;
      }
      if (event.key === 'Tab') {
        closeContextMenu(true);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (
          document.activeElement &&
          document.activeElement.classList.contains('context-menu-item')
        ) {
          document.activeElement.click();
        }
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = Array.prototype.slice.call(
          contextMenu.querySelectorAll('.context-menu-item:not(.disabled)')
        );
        if (!items.length) {
          return;
        }
        const index = items.indexOf(document.activeElement);
        let next;
        if (index < 0) {
          next = event.key === 'ArrowDown' ? 0 : items.length - 1;
        } else {
          next =
            event.key === 'ArrowDown'
              ? (index + 1) % items.length
              : (index - 1 + items.length) % items.length;
        }
        items[next].focus();
      }
    });
  }

  contentsBody.addEventListener('click', function (event) {
    const target = event.target;
    const row =
      target && typeof target.closest === 'function'
        ? target.closest('.tree-row')
        : null;
    if (!row) {
      if (renamingState) {
        commitInlineRename(true);
      }
      clearSelection();
    }
  });

  contentsBody.addEventListener('contextmenu', function (event) {
    const target = event.target;
    const row =
      target && typeof target.closest === 'function'
        ? target.closest('.tree-row')
        : null;

    if (!row && contentsRoot === null) {
      return;
    }

    if (renamingState) {
      commitInlineRename(true);
    }

    event.preventDefault();
    if (row) {
      row.focus();
      const info = rowMenuInfo(row);
      if (!selectedItems.has(info.path)) {
        selectSingle(info);
      }
      showContextMenu(event.clientX, event.clientY, buildRowMenu(info), row, false);
    } else {
      showContextMenu(event.clientX, event.clientY, buildBlankMenu(), null, false);
    }
  });

  contentsBody.addEventListener('keydown', function (event) {
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }

    const activeRow =
      document.activeElement &&
      document.activeElement.classList &&
      document.activeElement.classList.contains('tree-row')
        ? document.activeElement
        : null;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const rows = Array.prototype.slice.call(contentsBody.querySelectorAll('.tree-row'));
      if (rows.length === 0) {
        return;
      }
      event.preventDefault();
      const idx = activeRow ? rows.indexOf(activeRow) : -1;
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(rows.length - 1, idx < 0 ? 0 : idx + 1)
          : Math.max(0, idx < 0 ? 0 : idx - 1);
      const nextRow = rows[nextIndex];
      nextRow.focus();
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
        selectSingle(rowMenuInfo(nextRow));
      }
      return;
    }

    if (event.key === 'Escape') {
      if (clipboard && clipboard.mode === 'cut') {
        clipboard = null;
        syncSelectionDom();
      } else if (selectedItems.size > 1) {
        if (activeRow) {
          selectSingle(rowMenuInfo(activeRow));
        } else {
          clearSelection();
        }
      }
      return;
    }

    if (event.key === 'F2') {
      const selected = getSelectedItems();
      const targetRow =
        selected.length === 1 ? findRow(selected[0].path) : activeRow;
      if (targetRow) {
        event.preventDefault();
        startInlineRename(targetRow);
      }
      return;
    }

    if (event.key === 'Delete' || (isMac && event.key === 'Backspace' && event.metaKey)) {
      const selected = getSelectedItems().filter(function (item) {
        return !(item.isRoot && !contentsRoot);
      });
      if (selected.length === 0 && activeRow) {
        const info = rowMenuInfo(activeRow);
        if (!(info.isRoot && !contentsRoot)) {
          selected.push(toSelectionItem(info));
        }
      }
      if (selected.length === 0) {
        return;
      }
      event.preventDefault();
      if (selected.length === 1) {
        const only = selected[0];
        vscode.postMessage({
          type: 'remoteAction',
          action: 'delete',
          path: only.path,
          entryType: only.entryType,
          isRoot: Boolean(only.isRoot)
        });
      } else {
        vscode.postMessage({
          type: 'remoteAction',
          action: 'delete',
          items: selected
        });
      }
      return;
    }

    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.altKey) {
      return;
    }
    const lower = event.key.toLowerCase();
    if (lower === 'c' || lower === 'x') {
      let items = getSelectedNonRootItems();
      if (items.length === 0 && activeRow) {
        const info = rowMenuInfo(activeRow);
        if (!info.isRoot) {
          items = [toSelectionItem(info)];
        }
      }
      if (items.length > 0) {
        event.preventDefault();
        setClipboard(lower === 'x' ? 'cut' : 'copy', items);
      }
      return;
    }

    if (lower === 'v') {
      if (!hasClipboardItems()) {
        return;
      }
      event.preventDefault();
      const info = activeRow ? rowMenuInfo(activeRow) : null;
      triggerPaste(pasteTargetForInfo(info));
    }
  });

  contentsBody.addEventListener('dragover', function (event) {
    if (!dragState) {
      return;
    }
    updateDragAutoScroll(event.clientY);

    const resolved = resolveDropTargetFromEvent(event);
    const targetDir = resolved.targetDir;
    const canDrop = isValidDropTarget(dragState.items, targetDir);

    if (resolved.row && resolved.info && resolved.info.type === 'directory') {
      const info = resolved.info;
      const isCollapsed = info.isRoot ? !rootExpanded : !expanded.has(info.path);
      const canExpandForDrag =
        isCollapsed &&
        !dragState.items.some(function (item) {
          return item.entryType === 'directory' && isRemoteInsideOrEqualPath(item.path, info.path);
        });

      if (canExpandForDrag && isPointOverChevron(resolved.row, event.clientX, event.clientY)) {
        if (dragState.chevronTriggeredDir !== info.path) {
          dragState.chevronTriggeredDir = info.path;
          clearDragHoverTimer();
          expandDirectoryOnDrag(info, resolved.row);
        }
      } else {
        if (dragState.chevronTriggeredDir && dragState.chevronTriggeredDir !== info.path) {
          dragState.chevronTriggeredDir = null;
        }
        if (canExpandForDrag) {
          if (dragState.hoverDir !== info.path) {
            clearDragHoverTimer();
            dragState.hoverDir = info.path;
            dragState.hoverTimer = setTimeout(function () {
              if (dragState && dragState.hoverDir === info.path) {
                dragState.hoverTimer = null;
                expandDirectoryOnDrag(info, resolved.row);
              }
            }, 550);
          }
        } else {
          clearDragHoverTimer();
        }
      }
    } else {
      dragState.chevronTriggeredDir = null;
      clearDragHoverTimer();
    }

    if (canDrop) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      setDropTargetHighlight(targetDir);
    } else {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
      setDropTargetHighlight(null);
    }
  });

  contentsBody.addEventListener('dragleave', function (event) {
    if (!dragState) {
      return;
    }
    const related = event.relatedTarget;
    if (!related || !contentsBody.contains(related)) {
      clearDragHoverTimer();
      stopDragAutoScroll();
      setDropTargetHighlight(null);
    }
  });

  contentsBody.addEventListener('drop', function (event) {
    if (!dragState) {
      return;
    }
    event.preventDefault();
    const resolved = resolveDropTargetFromEvent(event);
    const targetDir = resolved.targetDir;
    const valid = isValidDropTarget(dragState.items, targetDir);
    const movedItems = dragState.items.slice();
    cleanupDragState();
    if (!valid || targetDir === null) {
      return;
    }
    vscode.postMessage({
      type: 'remoteAction',
      action: 'move',
      items: movedItems,
      targetDir: targetDir
    });
  });

  contentsBody.addEventListener(
    'scroll',
    function () {
      closeContextMenu(false);
      if (renamingState) {
        if (Date.now() - renamingState.openedAt < 150) {
          return;
        }
        commitInlineRename(true);
      }
    },
    { passive: true }
  );
  window.addEventListener('resize', function () {
    closeContextMenu(false);
  });
  window.addEventListener('blur', function () {
    closeContextMenu(false);
    cleanupDragState();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      closeContextMenu(false);
      cleanupDragState();
    }
  });
  document.addEventListener(
    'pointerdown',
    function (event) {
      if (
        contextMenu &&
        !contextMenu.classList.contains('hidden') &&
        !contextMenu.contains(event.target)
      ) {
        closeContextMenu(false);
      }
    },
    true
  );
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && contextMenu && !contextMenu.classList.contains('hidden')) {
      closeContextMenu(true);
    }
  });

  function resetContents() {
    cleanupInlineRename(false);
    cleanupDragState();
    pendingCreate = null;
    contentsRoot = null;
    rootMessage = null;
    listingCache.clear();
    expanded.clear();
    loading.clear();
    listingErrors.clear();
  }

  function requestRefresh() {
    resetContents();
    renderContents();
    vscode.postMessage({ type: 'refreshContents' });
  }

  function findRow(path) {
    const rows = contentsBody.querySelectorAll('.tree-row');
    for (let index = 0; index < rows.length; index += 1) {
      if (rows[index].dataset.path === path) {
        return rows[index];
      }
    }
    return undefined;
  }

  function animateCollapse(row, childBox, done) {
    if (row) {
      const chevron = row.querySelector('.chevron');
      if (chevron) {
        chevron.classList.remove('expanded');
      }
      row.setAttribute('aria-expanded', 'false');
    }
    if (!childBox || !childBox.classList.contains('tree-children')) {
      done();
      return;
    }
    childBox.style.maxHeight = childBox.scrollHeight + 'px';
    void childBox.offsetHeight;
    childBox.classList.add('collapsing');
    setTimeout(done, 180);
  }

  function saveRootExpanded() {
    const state = vscode.getState() || {};
    state.rootExpanded = rootExpanded;
    vscode.setState(state);
  }

  function requestListing(path) {
    loading.add(path);
    listingErrors.delete(path);
    renderContents();
    vscode.postMessage({ type: 'listContents', path: path });
  }

  function toggleRoot() {
    if (rootCollapsing) {
      return;
    }
    if (rootExpanded) {
      const row = findRow(contentsRoot || '');
      const childBox = row && row.nextElementSibling;
      rootCollapsing = true;
      animateCollapse(row, childBox, function () {
        rootCollapsing = false;
        rootExpanded = false;
        Array.from(selectedItems.values()).forEach(function (item) {
          if (!item.isRoot) {
            selectedItems.delete(item.path);
          }
        });
        saveRootExpanded();
        renderContents();
      });
      return;
    }

    rootExpanded = true;
    saveRootExpanded();
    renderContents(ROOT_ANIMATE);
  }

  function expandDirectoryOnDrag(info, row) {
    if (!row || !dragState) {
      return;
    }
    if (info.isRoot) {
      if (rootExpanded || rootCollapsing) {
        return;
      }
      rootExpanded = true;
      saveRootExpanded();
      ensureChildBoxInPlace(row, contentsRoot, 1, ROOT_ANIMATE);
      return;
    }

    if (info.type !== 'directory' || expanded.has(info.path) || collapsingPaths.has(info.path)) {
      return;
    }
    expanded.add(info.path);
    const level = Number(row.getAttribute('aria-level')) || 1;
    ensureChildBoxInPlace(row, info.path, level, info.path);
    if (!listingCache.has(info.path) && !listingErrors.has(info.path) && !loading.has(info.path)) {
      loading.add(info.path);
      listingErrors.delete(info.path);
      vscode.postMessage({ type: 'listContents', path: info.path });
    }
  }

  function renderChildBoxContents(childBox, dirPath, depth, animatePath) {
    childBox.textContent = '';
    if (listingCache.has(dirPath)) {
      childBox.appendChild(buildEntries(listingCache.get(dirPath), depth, animatePath));
      return;
    }
    if (listingErrors.has(dirPath)) {
      const errorRow = document.createElement('div');
      errorRow.className = 'tree-message error';
      errorRow.style.paddingLeft = childPadding(depth) + 'px';
      errorRow.textContent = listingErrors.get(dirPath);
      const retry = document.createElement('button');
      retry.className = 'link-button';
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', function (event) {
        event.stopPropagation();
        requestListing(dirPath);
      });
      errorRow.appendChild(retry);
      childBox.appendChild(errorRow);
      return;
    }
    const loadingRow = document.createElement('div');
    loadingRow.className = 'tree-message';
    loadingRow.style.paddingLeft = childPadding(depth) + 'px';
    loadingRow.textContent = '加载中…';
    childBox.appendChild(loadingRow);
  }

  function ensureChildBoxInPlace(row, dirPath, depth, animatePath) {
    const chevron = row.querySelector('.chevron');
    if (chevron) {
      chevron.classList.add('expanded');
    }
    row.setAttribute('aria-expanded', 'true');
    let childBox = row.nextElementSibling;
    if (!childBox || !childBox.classList.contains('tree-children')) {
      childBox = document.createElement('div');
      childBox.className = 'tree-children expanding';
      childBox.setAttribute('role', 'group');
      row.insertAdjacentElement('afterend', childBox);
    }
    renderChildBoxContents(childBox, dirPath, depth, animatePath);
    syncSelectionDom();
    contentsScrollbar.update();
  }

  function attachRowDrag(row, info) {
    if (info.isRoot) {
      row.draggable = false;
      return;
    }
    row.draggable = true;
    row.addEventListener('dragstart', function (event) {
      if (renamingState) {
        event.preventDefault();
        return;
      }
      closeContextMenu(false);
      if (!selectedItems.has(info.path)) {
        selectSingle(info);
      }
      const items = getSelectedNonRootItems();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      dragState = {
        items: items,
        sourcePaths: new Set(
          items.map(function (item) {
            return item.path;
          })
        ),
        currentDropTargetDir: null,
        hoverDir: null,
        hoverTimer: null,
        chevronTriggeredDir: null,
        autoScrollRaf: null,
        scrollVelocity: 0
      };
      contentsBody.classList.add('dragging-items');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData(DRAG_MIME, JSON.stringify(items));
          event.dataTransfer.setData(
            'text/plain',
            items
              .map(function (item) {
                return item.path;
              })
              .join('\n')
          );
        } catch (_) {
          // ignore
        }
      }
    });
    row.addEventListener('dragend', function () {
      cleanupDragState();
    });
  }

  function toggleDirectory(entry) {
    if (entry.type !== 'directory' || collapsingPaths.has(entry.path)) {
      return;
    }

    if (expanded.has(entry.path)) {
      const row = findRow(entry.path);
      const childBox = row && row.nextElementSibling;
      collapsingPaths.add(entry.path);
      animateCollapse(row, childBox, function () {
        collapsingPaths.delete(entry.path);
        expanded.delete(entry.path);
        pruneSelectionBelow(entry.path);
        renderContents();
      });
      return;
    }

    expanded.add(entry.path);
    if (!listingCache.has(entry.path) && !listingErrors.has(entry.path) && !loading.has(entry.path)) {
      requestListing(entry.path);
      return;
    }
    renderContents(entry.path);
  }

  function iconClass(type) {
    if (type === 'notebook') {
      return 'notebook';
    }
    return 'file';
  }

  function createChevron(expandedState) {
    const span = document.createElement('span');
    span.className = 'chevron' + (expandedState ? ' expanded' : '');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M6.14601 3.14579C5.95101 3.34079 5.95101 3.65779 6.14601 3.85279L10.292 7.99879L6.14601 12.1448C5.95101 12.3398 5.95101 12.6568 6.14601 12.8518C6.34101 13.0468 6.65801 13.0468 6.85301 12.8518L11.353 8.35179C11.548 8.15679 11.548 7.83979 11.353 7.64478L6.85301 3.14479C6.65801 2.94979 6.34101 2.95079 6.14601 3.14579Z'
    );
    svg.appendChild(path);
    span.appendChild(svg);
    return span;
  }

  function rowPadding(depth) {
    return 4 + depth * 10;
  }

  function childPadding(depth) {
    return rowPadding(depth) + 18;
  }

  function buildRootRow(root, entries, animatePath) {
    const container = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'tree-row directory root-row';
    row.dataset.path = root;
    row.dataset.type = 'directory';
    row.style.paddingLeft = rowPadding(0) + 'px';
    row.tabIndex = 0;
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', '1');
    row.setAttribute('aria-expanded', rootExpanded ? 'true' : 'false');
    row.title = root ? '/' + root : '/';

    row.appendChild(createChevron(rootExpanded));

    const name = document.createElement('span');
    name.className = 'entry-name';
    name.textContent = root || '/';
    row.appendChild(name);

    row.addEventListener('click', function (event) {
      handleRowSelectionClick(event, rowMenuInfo(row), toggleRoot);
    });
    attachRowDrag(row, rowMenuInfo(row));
    row.addEventListener('keydown', function (event) {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        const info = rowMenuInfo(row);
        if (!selectedItems.has(info.path)) {
          selectSingle(info);
        }
        const rect = row.getBoundingClientRect();
        showContextMenu(
          rect.left + 12,
          rect.bottom,
          buildRowMenu(info),
          row,
          true
        );
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectSingle(rowMenuInfo(row));
        toggleRoot();
      }
    });

    container.appendChild(row);

    if (rootExpanded) {
      const childBox = document.createElement('div');
      childBox.className = 'tree-children';
      childBox.setAttribute('role', 'group');
      if (animatePath === ROOT_ANIMATE) {
        childBox.classList.add('expanding');
      }

      if (!entries) {
        const loadingRow = document.createElement('div');
        loadingRow.className = 'tree-message';
        loadingRow.style.paddingLeft = childPadding(1) + 'px';
        loadingRow.textContent = '加载中…';
        childBox.appendChild(loadingRow);
      } else {
        childBox.appendChild(buildEntries(entries, 1, animatePath));
      }
      container.appendChild(childBox);
    }

    return container;
  }

  function mergeIcons(icons) {
    if (!icons || typeof icons !== 'object') {
      return;
    }
    Object.keys(icons).forEach(function (key) {
      iconCache.set(key, icons[key]);
    });
  }

  function loadIconFonts(fonts) {
    if (!Array.isArray(fonts)) {
      return;
    }
    fonts.forEach(function (font) {
      if (!font || !font.family || !font.dataUri || loadedFonts.has(font.family)) {
        return;
      }
      loadedFonts.add(font.family);
      try {
        const face = new FontFace(font.family, 'url("' + font.dataUri + '")');
        document.fonts.add(face);
        face.load().catch(function () {
          // Fall back to CSS icons if the font cannot be loaded.
        });
      } catch (_) {
        // FontFace unavailable; CSS fallback remains.
      }
    });
  }

  function renderResolvedIcon(container, icon) {
    if (!icon || !icon.kind) {
      return;
    }

    if (icon.kind === 'font') {
      const glyph = document.createElement('span');
      glyph.className = 'icon-glyph';
      glyph.textContent = icon.char || '';
      glyph.style.fontFamily = icon.family;
      if (icon.color) {
        glyph.style.color = icon.color;
      }
      container.appendChild(glyph);
      return;
    }

    if (icon.kind === 'svg') {
      container.classList.add('svg-icon');
      container.innerHTML = icon.svg || '';
      return;
    }

    if (icon.kind === 'image') {
      const image = document.createElement('img');
      image.src = icon.uri || '';
      image.alt = '';
      container.appendChild(image);
    }
  }

  function buildEntries(entries, depth, animatePath) {
    const container = document.createElement('div');
    container.className = 'tree-level';
    container.setAttribute('role', 'group');

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tree-message';
      empty.style.paddingLeft = childPadding(depth) + 'px';
      empty.textContent = '目录为空。';
      container.appendChild(empty);
      return container;
    }

    entries.forEach(function (entry) {
      const isDirectory = entry.type === 'directory';
      const isOpen = expanded.has(entry.path);

      const row = document.createElement('div');
      row.className = 'tree-row' + (isDirectory ? ' directory' : '');
      row.dataset.path = entry.path;
      row.dataset.type = entry.type;
      if (typeof entry.size === 'number' && Number.isFinite(entry.size)) {
        row.dataset.size = String(entry.size);
      }
      row.style.paddingLeft = rowPadding(depth) + 'px';
      row.tabIndex = 0;
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-level', String(depth + 1));
      row.title = entry.path;
      if (isDirectory) {
        row.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }

      if (isDirectory) {
        // Folders are identified by the chevron; no folder icon.
        row.appendChild(createChevron(isOpen));
      } else {
        if (entry.iconKey) {
          row.dataset.iconKey = entry.iconKey;
        }
        const icon = document.createElement('span');
        applyIconToElement(icon, entry.iconKey, entry.type);
        row.appendChild(icon);
      }

      const name = document.createElement('span');
      name.className = 'entry-name';
      name.textContent = entry.name;
      row.appendChild(name);

      const rowInfo = {
        path: entry.path,
        type: entry.type,
        size: typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : undefined,
        isRoot: false
      };

      row.addEventListener('click', function (event) {
        handleRowSelectionClick(event, rowInfo, function () {
          if (isDirectory) {
            toggleDirectory(entry);
          }
        });
      });
      if (!isDirectory) {
        row.addEventListener('dblclick', function (event) {
          if (event.ctrlKey || event.metaKey || event.shiftKey || renamingState) {
            return;
          }
          vscode.postMessage({
            type: 'remoteAction',
            action: 'open',
            path: entry.path,
            entryType: entry.type
          });
        });
      }
      attachRowDrag(row, rowInfo);
      row.addEventListener('keydown', function (event) {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          if (!selectedItems.has(rowInfo.path)) {
            selectSingle(rowInfo);
          }
          const rect = row.getBoundingClientRect();
          showContextMenu(
            rect.left + 12,
            rect.bottom,
            buildRowMenu(rowInfo),
            row,
            true
          );
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectSingle(rowInfo);
          if (isDirectory) {
            toggleDirectory(entry);
          } else {
            vscode.postMessage({
              type: 'remoteAction',
              action: 'open',
              path: entry.path,
              entryType: entry.type
            });
          }
        }
      });

      container.appendChild(row);

      if (isDirectory && isOpen) {
        const childBox = document.createElement('div');
        childBox.className = 'tree-children';
        childBox.setAttribute('role', 'group');
        if (animatePath === entry.path) {
          childBox.classList.add('expanding');
        }
        renderChildBoxContents(childBox, entry.path, depth + 1, animatePath);
        container.appendChild(childBox);
      }
    });

    return container;
  }

  function messageBlock(text, className) {
    const block = document.createElement('div');
    block.className = className || 'contents-error';
    block.textContent = text;
    return block;
  }

  function createActionButton(label, secondary, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button' + (secondary ? ' secondary' : '');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function renderContents(animatePath) {
    closeContextMenu(false);
    if (renamingState) {
      cancelInlineRename(false);
    }
    const activePath =
      document.activeElement && document.activeElement.dataset
        ? document.activeElement.dataset.path
        : undefined;
    const scrollTop = contentsBody.scrollTop;
    contentsBody.textContent = '';

    if (rootMessage) {
      if (rootMessage.kind === 'empty') {
        const text =
          rootMessage.reason === 'no-url'
            ? '尚未设置 Kaggle Jupyter URL。'
            : '目录为空。';
        const block = messageBlock(text, 'contents-empty');
        if (rootMessage.reason === 'no-url') {
          const actions = document.createElement('div');
          actions.className = 'empty-actions';
          actions.appendChild(
            createActionButton('设置 Jupyter URL', false, function () {
              vscode.postMessage({ type: 'openUrlSettings' });
            })
          );
          actions.appendChild(
            createActionButton('打开连接设置', true, function () {
              vscode.postMessage({ type: 'focusConnection' });
            })
          );
          block.appendChild(actions);
        }
        contentsBody.appendChild(block);
      } else {
        const block = messageBlock(rootMessage.message);
        const retry = document.createElement('button');
        retry.className = 'link-button';
        retry.type = 'button';
        retry.textContent = '重试';
        retry.addEventListener('click', requestRefresh);
        block.appendChild(retry);
        contentsBody.appendChild(block);
      }
    } else if (contentsRoot === null) {
      const loadingRow = document.createElement('div');
      loadingRow.className = 'tree-message';
      loadingRow.textContent = '加载中…';
      contentsBody.appendChild(loadingRow);
    } else {
      contentsBody.appendChild(
        buildRootRow(contentsRoot, listingCache.get(contentsRoot), animatePath)
      );
    }

    pruneInvisibleSelection();
    syncSelectionDom();

    contentsBody.scrollTop = scrollTop;

    if (typeof activePath === 'string') {
      const rows = contentsBody.querySelectorAll('.tree-row');
      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index].dataset.path === activePath) {
          rows[index].focus();
          break;
        }
      }
    }

    contentsScrollbar.update();
    setTimeout(function () {
      contentsScrollbar.update();
    }, 220);
  }

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || !message.type) {
      return;
    }

    if (message.type === 'startCreate') {
      startInlineCreate(resolveCreateTargetParent(), Boolean(message.isDirectory));
      return;
    }

    if (message.type === 'iconTheme') {
      loadIconFonts(message.fonts);
      nameIconCache.clear();
      defaultFileIconKey = message.defaultFileIconKey || null;
      if (message.defaultFileIconKey && message.defaultFileIcon) {
        iconCache.set(message.defaultFileIconKey, message.defaultFileIcon);
      }
      return;
    }

    if (message.type === 'resolvedFileIcon') {
      if (message.iconKey && message.icon) {
        iconCache.set(message.iconKey, message.icon);
      }
      if (typeof message.name === 'string') {
        nameIconCache.set(message.name.toLowerCase(), message.iconKey || null);
      }
      if (
        renamingState &&
        !renamingState.isDirectory &&
        renamingState.iconEl &&
        renamingState.iconRequestId === message.requestId
      ) {
        applyIconToElement(
          renamingState.iconEl,
          message.iconKey || null,
          renamingState.entryType || 'file'
        );
      }
      return;
    }

    if (message.type === 'treeMutation') {
      const paths = Array.isArray(message.invalidate) ? message.invalidate : [];
      paths.forEach(invalidateSubtree);
      closeContextMenu(false);
      syncSelectionDom();
      return;
    }

    if (message.type === 'clearClipboard') {
      clipboard = null;
      syncSelectionDom();
      return;
    }

    if (message.type === 'contentsRoot') {
      const nextRoot = typeof message.root === 'string' ? message.root : '';
      if (nextRoot !== lastContentsRoot) {
        lastContentsRoot = nextRoot;
        rootExpanded = true;
        selectedItems.clear();
        selectionAnchorPath = null;
        clipboard = null;
      }
      resetContents();
      mergeIcons(message.icons);
      contentsRoot = nextRoot;
      listingCache.set(contentsRoot, Array.isArray(message.entries) ? message.entries : []);
      renderContents();
      return;
    }

    if (message.type === 'contentsEmpty') {
      resetContents();
      rootMessage = { kind: 'empty', reason: message.reason || 'empty' };
      renderContents();
      return;
    }

    if (message.type === 'contentsError') {
      resetContents();
      rootMessage = { kind: 'error', message: message.message || '加载目录失败' };
      renderContents();
      return;
    }

    if (message.type === 'listing') {
      mergeIcons(message.icons);
      listingCache.set(message.path, Array.isArray(message.entries) ? message.entries : []);
      loading.delete(message.path);
      listingErrors.delete(message.path);
      if (dragState) {
        const targetRow = findRow(message.path);
        if (targetRow && (message.path === contentsRoot ? rootExpanded : expanded.has(message.path))) {
          const level = Number(targetRow.getAttribute('aria-level')) || 1;
          ensureChildBoxInPlace(targetRow, message.path, level, message.path);
          return;
        }
      }
      renderContents(message.path);
      if (pendingCreate && pendingCreate.parentPath === message.path) {
        const nextCreate = pendingCreate;
        pendingCreate = null;
        startInlineCreate(nextCreate.parentPath, nextCreate.isDirectory);
      }
      return;
    }

    if (message.type === 'listingError') {
      loading.delete(message.path);
      if (pendingCreate && pendingCreate.parentPath === message.path) {
        pendingCreate = null;
      }
      const text = message.message || '加载失败';
      if (message.path === contentsRoot) {
        resetContents();
        rootMessage = { kind: 'error', message: text };
        renderContents();
        return;
      }
      listingErrors.set(message.path, text);
      if (dragState) {
        const targetRow = findRow(message.path);
        if (targetRow && expanded.has(message.path)) {
          const level = Number(targetRow.getAttribute('aria-level')) || 1;
          ensureChildBoxInPlace(targetRow, message.path, level, message.path);
          return;
        }
      }
      renderContents(message.path);
    }
  });

  renderContents();
  vscode.postMessage({ type: 'ready' });
})();

