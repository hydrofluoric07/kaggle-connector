(function () {
  const vscode = acquireVsCodeApi();

  const urlInput = document.getElementById('url');
  const remoteDirInput = document.getElementById('remoteDir');
  const pathModeSelect = document.getElementById('pathMode');
  const statusEl = document.getElementById('status');
  const clearButton = document.getElementById('clear');
  const buttons = Array.prototype.slice.call(
    document.querySelectorAll('button:not(.info-button)')
  );
  const settingsScrollArea = document.querySelector('.settings-scroll');
  const settingsScrollEl = document.getElementById('settingsBody');
  const settingsScrollbarEl = document.getElementById('settingsScrollbar');
  const settingsScrollbarThumb = document.getElementById('settingsScrollbarThumb');

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

  const settingsScrollbar = setupOverlayScrollbar(
    settingsScrollArea,
    settingsScrollEl,
    settingsScrollbarEl,
    settingsScrollbarThumb
  );

  function setBusy(busy) {
    const isBusy = Boolean(busy);
    buttons.forEach(function (button) {
      button.disabled = isBusy;
    });
  }

  let statusClearTimer;
  function setStatus(kind, message) {
    clearTimeout(statusClearTimer);
    statusEl.className = 'status ' + (kind || 'info');
    statusEl.textContent = message || '';
    settingsScrollbar.update();
    if (!message) {
      return;
    }
    const delay = kind === 'error' ? 0 : kind === 'warning' ? 3000 : 2000;
    if (delay > 0) {
      statusClearTimer = setTimeout(function () {
        statusEl.className = 'status';
        statusEl.textContent = '';
        settingsScrollbar.update();
      }, delay);
    }
  }

  function send(type) {
    setBusy(true);
    setStatus('info', type === 'test' ? '正在测试连接…' : '正在保存…');
    vscode.postMessage({
      type: type,
      url: urlInput.value,
      remoteDir: remoteDirInput.value,
      pathMode: pathModeSelect.value
    });
  }

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || !message.type) {
      return;
    }

    if (message.type === 'state') {
      const state = message.state || {};
      urlInput.value = state.url || '';
      remoteDirInput.value = state.remoteDir || '';
      pathModeSelect.value = state.pathMode || 'workspaceRelative';
      clearButton.classList.toggle('hidden', !state.hasUrl);
      settingsScrollbar.update();
      return;
    }

    if (message.type === 'status') {
      setBusy(false);
      setStatus(message.kind, message.message);
    }
  });

  document.getElementById('save').addEventListener('click', function () {
    send('save');
  });

  document.getElementById('test').addEventListener('click', function () {
    send('test');
  });

  clearButton.addEventListener('click', function () {
    setBusy(true);
    setStatus('info', '正在清除…');
    vscode.postMessage({ type: 'clearUrl' });
  });

  document.getElementById('toggle').addEventListener('click', function () {
    const visible = urlInput.type === 'text';
    urlInput.type = visible ? 'password' : 'text';
    document.getElementById('toggle').textContent = visible ? '显示' : '隐藏';
  });

  const helpPopover = document.getElementById('helpPopover');
  const HELP_TEXT = {
    url: 'Kaggle Notebook → Run → Kaggle Jupyter Server → 复制 VS Code Compatible URL。',
    remoteDir: '相对于 Jupyter 根目录；Kaggle 上是 /kaggle/working，不能为空。',
    pathMode: '保留相对路径可避免多选时同名文件互相覆盖。'
  };
  let helpAnchor = null;

  function closeHelp() {
    if (helpAnchor) {
      helpAnchor.setAttribute('aria-expanded', 'false');
      helpAnchor = null;
    }
    if (helpPopover) {
      helpPopover.classList.add('hidden');
    }
  }

  function openHelp(button) {
    const text = HELP_TEXT[button.dataset.help];
    if (!text || !helpPopover) {
      return;
    }
    helpPopover.textContent = text;
    helpPopover.classList.remove('hidden');
    helpPopover.style.left = '0px';
    helpPopover.style.top = '0px';

    const rect = button.getBoundingClientRect();
    const box = helpPopover.getBoundingClientRect();
    const margin = 8;
    let left = rect.right - box.width;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - box.width - margin));
    let top = rect.bottom + 6;
    if (top + box.height > window.innerHeight - margin) {
      top = rect.top - box.height - 6;
    }
    top = Math.max(margin, top);
    helpPopover.style.left = left + 'px';
    helpPopover.style.top = top + 'px';

    button.setAttribute('aria-expanded', 'true');
    helpAnchor = button;
  }

  Array.prototype.slice.call(document.querySelectorAll('.info-button')).forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      if (helpAnchor === button) {
        closeHelp();
      } else {
        closeHelp();
        openHelp(button);
      }
    });
  });

  document.addEventListener(
    'pointerdown',
    function (event) {
      if (
        helpAnchor &&
        helpPopover &&
        !helpPopover.contains(event.target) &&
        !helpAnchor.contains(event.target)
      ) {
        closeHelp();
      }
    },
    true
  );
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && helpAnchor) {
      const anchor = helpAnchor;
      closeHelp();
      anchor.focus();
    }
  });
  window.addEventListener('resize', closeHelp);
  window.addEventListener('blur', closeHelp);
  settingsScrollEl.addEventListener('scroll', closeHelp, { passive: true });

  let autosaveTimer;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      vscode.postMessage({
        type: 'autosave',
        url: urlInput.value,
        remoteDir: remoteDirInput.value,
        pathMode: pathModeSelect.value
      });
    }, 250);
  }

  urlInput.addEventListener('change', scheduleAutosave);
  remoteDirInput.addEventListener('change', scheduleAutosave);
  pathModeSelect.addEventListener('change', scheduleAutosave);

  vscode.postMessage({ type: 'ready' });
})();
