# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VS Code extension ("Kaggle Connector") that uploads local files/folders to a *running* Kaggle Jupyter session via the Jupyter Contents API (`PUT /api/contents/{path}`). There is no Kaggle API token: the user pastes the session's "VS Code Compatible URL" (contains a JWT, expires with the session) into the sidebar. It lives in SecretStorage (`SECRET_KEY` in `src/config.ts`), never in `settings.json`; logs must redact it via `displayServerUrl()`. Remote paths are relative to the Jupyter root — on Kaggle that is `/kaggle/working`, the only writable location.

`colab-vscode/` is a vendored copy of Google's Colab extension kept as a UX reference (menu groups, sash, icons). It is outside the build and typecheck — do not modify or bundle it. The root `*.py` scripts are legacy prototypes of the same Contents-API approach, not part of the extension.

## Commands

- `npm run build` — esbuild bundles `src/extension.ts` → `dist/extension.js` (CJS, node18, `vscode` external). **`dist/` is committed; rebuild after any `src/` change** or the running extension keeps the old code.
- `npm run watch` — watch build.
- `npm run typecheck` — `tsc --noEmit` (strict, `noUnusedLocals`/`noUnusedParameters`).
- `npm test` — `node:test` via tsx. The script lists test files explicitly: **new test files must be appended to `scripts.test` in `package.json`**.
  - One file: `node --import tsx --test test/upload.test.ts`
  - One case: `node --import tsx --test --test-name-pattern="hash" test/upload.test.ts`
- `npm run package` — typecheck + build + `vsce package --no-dependencies`.
- F5 in VS Code launches the Extension Development Host (`.vscode/launch.json`, preLaunchTask `npm: build`).
- There is no lint script.

## Architecture

Layering rule: `src/core/` is pure TypeScript with **no `vscode` import** — that is the unit-testable layer, since `node:test` runs outside a VS Code host. Tests cover `core/*`, `client.ts` (against a local `node:http` server), `remoteSave.ts` and `keepAlive.ts`; modules that import `vscode` (`extension`, `webview`, `remoteFs`, `upload`, `config`, `proxy`) are not directly unit-testable. Keep new pure logic in `core/`.

Request path: `extension.ts` (commands + orchestration) → `upload.ts` pipeline → `client.ts` (`JupyterClient`) → `http.ts`.

- `http.ts` deliberately does **not** follow redirects — a redirect to the login page is the session-expired signal. `timeoutMs` is socket inactivity; `deadlineMs` is a wall-clock cap used by the session probe (expired Kaggle links can hang ~30s before answering).
- `client.ts`: Contents API wrapper. `probeSession()` (GET `/api/status`) never throws; it returns `{alive, error, likelyExpired}`. Server clock offset is calibrated from the HTTP `Date` header for mtime comparisons.
- `upload.ts` pipeline: `collectSelections` (recursive walk, excludes, symlink skip, size cap) → `planUploads` (local→remote mapping via `core/paths`, duplicate-path conflicts) → `preflightUploads` (remote dir listing + `core/uploadPolicy.decideUpload`: hash when the server provides one, else size+mtime with tolerance) → `executeUpload` (bounded concurrency, exponential-backoff retries for network/5xx only, all workers abort on session errors).
- `core/errors.ts`: single error taxonomy (`KaggleError.kind`). `classifyHttpError` distinguishes Jupyter's JSON 404 (`notFound`) from the proxy's plain-text/HTML 404 (`auth` = expired session). `isSessionError` = auth/redirect/nonJson; `isConnectionError` adds timeout/network/dns/tls/gateway. Business errors (`notFound`, read-only `forbidden`, `tooLarge`, `cancelled`) must not be treated as disconnection.

Connection state (drives the explorer menu):

- `core/connectionState.ts` (pure) + `probe.ts` (`ProbeCoordinator`: 20s success-only cache, in-flight dedupe) are owned by `extension.ts` and shared with the webview. Generation/probeSeq tickets discard stale async results (URL changed/cleared mid-probe, slow probe overtaken by a newer one).
- The boolean is mirrored to the `kaggleConnector.connected` context key. `package.json` uses `when` for visibility and `enablement` for clickability of `kaggleConnector.upload`; group `5b_importexport@31` keeps it at a fixed position for files and folders (Colab pattern).
- Every path that learns liveness must update the state: startup probe (`onStartupFinished`), save/clear URL, test connection, upload pre-probe (always fresh, never cached), `sessionExpired` upload summaries, webview refresh/list/remote actions, and `remoteFs` failures via its `onConnectionError` callback.

Sidebar and remote editing:

- `webview.ts` + `media/webview.js|css`: vanilla-JS webview (no bundler), strict CSP (webview resources + `data:` URIs only). The `ready` handshake rehydrates persisted state; `autosave` messages persist committed fields without resetting the form — **do not push `state` on configuration changes**, it would clobber what the user is typing.
- `remoteFs.ts`: `FileSystemProvider` for the `kaggle-remote:` scheme so remote files open as editable documents. Saves flow through `RemoteUploadQueue` (`remoteSave.ts`): debounced when VS Code auto-save is on, immediate otherwise; `kaggleConnector.saveRemoteNow` (Ctrl+S on remote editors) forces a flush; pending uploads also flush on tab close, window blur and `deactivate()`.
- `keepAlive.ts`: pure TypeScript background keep-alive service (`KeepAliveManager`). Sends periodic `GET /api/kernels` requests (which refresh Jupyter Server's `last_activity`, unlike `/api/status` which is treated as a health check) at a configured interval (default 10 minutes) when connected. If `/api/kernels` returns 404, falls back to `/api/status`. If session expires, marks `ConnectionState` as disconnected and stops polling.
- `jupyter.ts`: optional kernel-source integration with `ms-toolsai.jupyter` (Colab-style `createJupyterServerCollection`), soft dependency with a one-time install prompt. Lazy by design: Jupyter is only activated once a URL exists and a notebook is open/opened or the user explicitly saves. It uses a per-URL deterministic server id via `core/url.jupyterServerId` (Jupyter caches `UniversalRemoteKernelFinder` by server handle and its `updateConnection` only mutates label without refreshing baseUrl, so server id must change per session URL to connect to the new session), splits the URL into `baseUrl` + `token` via `core/url.jupyterConnectionParts`, fires `onDidChangeServers` on save/clear, and must call the Jupyter API directly from this extension's stack because Jupyter infers the caller extension id from it.
- `config.ts`: clamped typed getters; writes target Workspace settings when a workspace is open, else Global. `proxy.ts` precedence: `kaggleConnector.proxy` → `http.proxy` (honoring `noProxy`) → `HTTPS_PROXY`/`HTTP_PROXY`.

## Conventions

- All user-facing strings are hardcoded Simplified Chinese (no `package.nls` localization).
- New tests use `node:test` + `node:assert/strict` in `test/*.test.ts` and must be registered in `scripts.test`.
- Session URLs expire (Kaggle sessions ≤12h); error flows should offer the "更新 Jupyter URL" recovery instead of generic failure messages.
