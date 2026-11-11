import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JupyterClient, SessionProbeResult } from '../src/client';
import { ConnectionState } from '../src/core/connectionState';
import { KaggleError } from '../src/core/errors';
import { KeepAliveManager } from '../src/keepAlive';

interface MockClientOptions {
  alive?: boolean;
  likelyExpired?: boolean;
  error?: KaggleError;
}

function createMockClient(options: MockClientOptions = {}): {
  client: JupyterClient;
  calls: number[];
} {
  const calls: number[] = [];
  const client = {
    keepAlive: async (deadlineMs: number): Promise<SessionProbeResult> => {
      calls.push(deadlineMs);
      return {
        alive: options.alive ?? true,
        likelyExpired: options.likelyExpired ?? false,
        error: options.error
      };
    }
  } as unknown as JupyterClient;
  return { client, calls };
}

test('KeepAliveManager starts timer when connected and enabled', () => {
  const state = new ConnectionState();
  state.syncUrl('https://host/proxy');
  const ticket = state.beginProbe('https://host/proxy');
  if (ticket) state.completeProbe(ticket, true);

  const logs: string[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];

  const manager = new KeepAliveManager({
    clientFactory: () => createMockClient().client,
    loadUrl: async () => 'https://host/proxy',
    isEnabled: () => true,
    getIntervalMs: () => 600000,
    getDeadlineMs: () => 5000,
    state,
    log: (msg) => logs.push(msg),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length as unknown as NodeJS.Timeout;
    },
    clearTimer: () => {}
  });

  manager.sync();
  assert.equal(manager.isScheduled(), true);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 600000);

  manager.dispose();
  assert.equal(manager.isScheduled(), false);
});

test('KeepAliveManager does not schedule timer when disabled or disconnected', () => {
  const state = new ConnectionState();
  const logs: string[] = [];

  let enabled = true;
  const manager = new KeepAliveManager({
    clientFactory: () => createMockClient().client,
    loadUrl: async () => 'https://host/proxy',
    isEnabled: () => enabled,
    getIntervalMs: () => 600000,
    getDeadlineMs: () => 5000,
    state,
    log: (msg) => logs.push(msg)
  });

  // Disconnected
  manager.sync();
  assert.equal(manager.isScheduled(), false);

  // Connected but disabled
  state.syncUrl('https://host/proxy');
  const ticket = state.beginProbe('https://host/proxy');
  if (ticket) state.completeProbe(ticket, true);
  enabled = false;

  manager.sync();
  assert.equal(manager.isScheduled(), false);

  // Enable
  enabled = true;
  manager.sync();
  assert.equal(manager.isScheduled(), true);

  // Disable clears timer
  enabled = false;
  manager.sync();
  assert.equal(manager.isScheduled(), false);

  manager.dispose();
});

test('triggerNow pings successfully and logs activity refresh', async () => {
  const state = new ConnectionState();
  state.syncUrl('https://host/proxy');
  const ticket = state.beginProbe('https://host/proxy');
  if (ticket) state.completeProbe(ticket, true);

  const { client, calls } = createMockClient({ alive: true });
  const logs: string[] = [];
  let currentTime = 1700000000000;

  const manager = new KeepAliveManager({
    clientFactory: () => client,
    loadUrl: async () => 'https://host/proxy',
    isEnabled: () => true,
    getIntervalMs: () => 600000,
    getDeadlineMs: () => 5000,
    state,
    log: (msg) => logs.push(msg),
    now: () => currentTime
  });

  const ok = await manager.triggerNow();
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 5000);
  assert.equal(manager.getLastPingAt(), 1700000000000);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\[保活\] Kaggle 会话活跃时间已刷新/);

  manager.dispose();
});

test('triggerNow handles session expiration by marking disconnected', async () => {
  const state = new ConnectionState();
  state.syncUrl('https://host/proxy');
  const ticket = state.beginProbe('https://host/proxy');
  if (ticket) state.completeProbe(ticket, true);
  assert.equal(state.connected, true);

  const { client } = createMockClient({
    alive: false,
    likelyExpired: true,
    error: new KaggleError('auth', 'Session expired')
  });
  const logs: string[] = [];

  const manager = new KeepAliveManager({
    clientFactory: () => client,
    loadUrl: async () => 'https://host/proxy',
    isEnabled: () => true,
    getIntervalMs: () => 600000,
    getDeadlineMs: () => 5000,
    state,
    log: (msg) => logs.push(msg)
  });

  const ok = await manager.triggerNow();
  assert.equal(ok, false);
  assert.equal(state.connected, false);
  assert.equal(manager.isScheduled(), false);
  assert.match(logs[0], /\[保活\] Kaggle 会话已失效/);

  manager.dispose();
});

test('triggerNow handles transient network error without disconnecting', async () => {
  const state = new ConnectionState();
  state.syncUrl('https://host/proxy');
  const ticket = state.beginProbe('https://host/proxy');
  if (ticket) state.completeProbe(ticket, true);
  assert.equal(state.connected, true);

  const { client } = createMockClient({
    alive: false,
    likelyExpired: false,
    error: new KaggleError('network', 'ECONNRESET')
  });
  const logs: string[] = [];

  const manager = new KeepAliveManager({
    clientFactory: () => client,
    loadUrl: async () => 'https://host/proxy',
    isEnabled: () => true,
    getIntervalMs: () => 600000,
    getDeadlineMs: () => 5000,
    state,
    log: (msg) => logs.push(msg)
  });

  const ok = await manager.triggerNow();
  assert.equal(ok, false);
  assert.equal(state.connected, true);
  assert.match(logs[0], /\[保活\] 保活请求异常/);

  manager.dispose();
});

test('scheduled timer tick triggers keep-alive ping', async () => {
  const state = new ConnectionState();
  state.syncUrl('https://host/proxy');
  const ticket = state.beginProbe('https://host/proxy');
  if (ticket) state.completeProbe(ticket, true);

  const { client, calls } = createMockClient({ alive: true });
  const logs: string[] = [];
  let scheduledFn: (() => void) | undefined;

  const manager = new KeepAliveManager({
    clientFactory: () => client,
    loadUrl: async () => 'https://host/proxy',
    isEnabled: () => true,
    getIntervalMs: () => 600000,
    getDeadlineMs: () => 5000,
    state,
    log: (msg) => logs.push(msg),
    setTimer: (fn) => {
      scheduledFn = fn;
      return 1 as unknown as NodeJS.Timeout;
    },
    clearTimer: () => {
      scheduledFn = undefined;
    }
  });

  manager.sync();
  assert.ok(scheduledFn);

  // Trigger timer callback
  scheduledFn();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(calls.length, 1);
  assert.match(logs[0], /\[保活\] Kaggle 会话活跃时间已刷新/);

  manager.dispose();
});
