import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JupyterClient } from '../src/client';
import { ConnectionState } from '../src/core/connectionState';
import { KaggleError } from '../src/core/errors';
import {
  KERNEL_CWD_MARKER,
  STARTUP_SCRIPT_NAME,
  buildKernelConfigureCwdCode,
  buildStartupScriptCode,
  parseKernelConfigureCwdResult,
  splitRemoteDirParts,
  type ConfigureWorkingDirResult
} from '../src/core/remoteCwd';
import { WorkingDirSyncManager } from '../src/workingDirSync';

test('splitRemoteDirParts normalizes and validates segments', () => {
  assert.deepEqual(splitRemoteDirParts('/news_recommender/'), ['news_recommender']);
  assert.deepEqual(splitRemoteDirParts('news_recommender\\src'), ['news_recommender', 'src']);
  assert.deepEqual(splitRemoteDirParts(''), []);
  assert.throws(() => splitRemoteDirParts('../escape'));
});

test('buildStartupScriptCode sets sys.path, PYTHONPATH and chdir inside Jupyter root', () => {
  const script = buildStartupScriptCode(['news_recommender']);
  assert.match(script, /parts = \["news_recommender"\]/);
  assert.match(script, /KC_JUPYTER_ROOT/);
  assert.match(script, /os\.makedirs\(proj, exist_ok=True\)/);
  assert.match(script, /sys\.path\.insert\(0, proj\)/);
  assert.match(script, /os\.environ\["PYTHONPATH"\]/);
  assert.match(script, /os\.chdir\(proj\)/);
});

test('buildKernelConfigureCwdCode embeds base64 startup script and handles disable', () => {
  const enableCode = buildKernelConfigureCwdCode(['news_recommender', 'sub'], true);
  assert.ok(enableCode.includes(STARTUP_SCRIPT_NAME));
  assert.ok(enableCode.includes('enabled = True'));
  const expectedB64 = Buffer.from(
    buildStartupScriptCode(['news_recommender', 'sub']),
    'utf8'
  ).toString('base64');
  assert.ok(enableCode.includes(expectedB64));

  const disableCode = buildKernelConfigureCwdCode([], false);
  assert.ok(disableCode.includes('enabled = False'));
  assert.ok(disableCode.includes('os.unlink(startup_path)'));

  assert.throws(
    () => buildKernelConfigureCwdCode([], true),
    (error: unknown) => error instanceof KaggleError && error.kind === 'badRequest'
  );
});

test('parseKernelConfigureCwdResult extracts structured payload or throws typed error', () => {
  const parsed = parseKernelConfigureCwdResult({
    stdout: `noise\n${KERNEL_CWD_MARKER}${JSON.stringify({
      ok: true,
      startupConfigured: true,
      dirExists: true,
      cwdChanged: true,
      projPath: '/kaggle/working/news_recommender',
      startupPath: '/root/.ipython/profile_default/startup/00-kaggle-connector-cwd.py'
    })}\n`,
    stderr: ''
  });
  assert.deepEqual(parsed, {
    startupConfigured: true,
    dirExists: true,
    cwdChanged: true,
    projPath: '/kaggle/working/news_recommender',
    startupPath: '/root/.ipython/profile_default/startup/00-kaggle-connector-cwd.py'
  });

  assert.throws(
    () =>
      parseKernelConfigureCwdResult({
        stdout: `${KERNEL_CWD_MARKER}${JSON.stringify({ ok: false, error: 'permission denied' })}`,
        stderr: ''
      }),
    (error: unknown) =>
      error instanceof KaggleError &&
      error.kind === 'badRequest' &&
      error.message.includes('permission denied')
  );

  assert.throws(
    () =>
      parseKernelConfigureCwdResult({
        stdout: '',
        stderr: '',
        errorName: 'RuntimeError',
        errorValue: 'boom'
      }),
    (error: unknown) =>
      error instanceof KaggleError &&
      error.kind === 'badRequest' &&
      error.message.includes('RuntimeError')
  );
});

test('WorkingDirSyncManager deduplicates repeated syncs, updates on dir change/upload, and cleans up on disable', async () => {
  const state = new ConnectionState();
  let url = 'https://kaggle.test/k/1/proxy';
  let remoteDir = 'news_recommender';
  let enabled = true;
  const calls: Array<{
    remoteDir: string;
    enabled?: boolean;
    onlyExistingIdle?: boolean;
    disposed: boolean;
  }> = [];
  let nextDirExists = false;

  const manager = new WorkingDirSyncManager({
    clientFactory: () => {
      const entry = {
        remoteDir: '',
        enabled: undefined as boolean | undefined,
        onlyExistingIdle: undefined as boolean | undefined,
        disposed: false
      };
      return {
        async configureKernelWorkingDir(
          dir: string,
          opts?: { enabled?: boolean; onlyExistingIdle?: boolean }
        ): Promise<ConfigureWorkingDirResult> {
          entry.remoteDir = dir;
          entry.enabled = opts?.enabled;
          entry.onlyExistingIdle = opts?.onlyExistingIdle;
          calls.push(entry);
          return {
            startupConfigured: opts?.enabled !== false,
            updatedKernels: nextDirExists && opts?.enabled !== false ? 1 : 0,
            skippedBusyKernels: 0,
            dirExists: nextDirExists && opts?.enabled !== false,
            projPath: `/kaggle/working/${dir}`,
            startupPath: '/root/.ipython/profile_default/startup/00-kaggle-connector-cwd.py'
          };
        },
        async dispose(): Promise<void> {
          entry.disposed = true;
        }
      } as unknown as JupyterClient;
    },
    loadUrl: async () => url,
    getRemoteDir: () => remoteDir,
    isEnabled: () => enabled,
    state,
    log: () => undefined
  });

  // Disconnected: does nothing.
  await manager.sync();
  assert.equal(calls.length, 0);

  // Connected: configures startup script, dirExists=false.
  state.syncUrl(url);
  const ticket = state.beginProbe(url)!;
  state.completeProbe(ticket, true);
  await manager.sync();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].remoteDir, 'news_recommender');
  assert.equal(calls[0].enabled, true);
  assert.equal(calls[0].disposed, true);

  // Repeated sync with same (url, remoteDir, enabled) is a no-op.
  await manager.sync();
  assert.equal(calls.length, 1);

  // After upload creates the directory, onRemoteDirCreated switches idle kernels only.
  nextDirExists = true;
  await manager.onRemoteDirCreated();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].onlyExistingIdle, true);

  // Second onRemoteDirCreated is a no-op because dir already exists.
  await manager.onRemoteDirCreated();
  assert.equal(calls.length, 2);

  // Changing remoteDir triggers a new sync.
  remoteDir = 'other_proj';
  await manager.sync();
  assert.equal(calls.length, 3);
  assert.equal(calls[2].remoteDir, 'other_proj');

  // Disabling cleans up startup script.
  enabled = false;
  await manager.sync();
  assert.equal(calls.length, 4);
  assert.equal(calls[3].enabled, false);

  // Repeated sync while disabled is a no-op.
  await manager.sync();
  assert.equal(calls.length, 4);

  // Session error marks disconnected and resets cached key.
  enabled = true;
  const failingManager = new WorkingDirSyncManager({
    clientFactory: () =>
      ({
        async configureKernelWorkingDir(): Promise<ConfigureWorkingDirResult> {
          throw new KaggleError('auth', 'expired');
        },
        async dispose(): Promise<void> {
          return undefined;
        }
      }) as unknown as JupyterClient,
    loadUrl: async () => url,
    getRemoteDir: () => remoteDir,
    isEnabled: () => true,
    state,
    log: () => undefined
  });
  await failingManager.sync();
  assert.equal(state.connected, false);
});

