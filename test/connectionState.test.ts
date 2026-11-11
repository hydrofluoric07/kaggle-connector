import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConnectionState } from '../src/core/connectionState';
import { isConnectionError, KaggleError } from '../src/core/errors';

function track(state: ConnectionState): boolean[] {
  const changes: boolean[] = [];
  state.onDidChange((connected) => changes.push(connected));
  return changes;
}

test('starts disconnected and ignores a probe without a URL', () => {
  const state = new ConnectionState();
  assert.equal(state.connected, false);
  assert.equal(state.beginProbe(''), undefined);
  assert.equal(state.connected, false);
});

test('probe results flip the connection state', () => {
  const state = new ConnectionState();
  const changes = track(state);

  const alive = state.beginProbe('https://host/proxy');
  assert.ok(alive);
  assert.equal(state.completeProbe(alive, true), true);
  assert.equal(state.connected, true);

  const dead = state.beginProbe('https://host/proxy');
  assert.ok(dead);
  assert.equal(state.completeProbe(dead, false), true);
  assert.equal(state.connected, false);

  assert.deepEqual(changes, [true, false]);
});

test('onDidChange only fires when the value actually changes', () => {
  const state = new ConnectionState();
  const changes = track(state);

  const first = state.beginProbe('https://host/proxy');
  assert.ok(first);
  state.completeProbe(first, true);
  const second = state.beginProbe('https://host/proxy');
  assert.ok(second);
  state.completeProbe(second, true);

  assert.deepEqual(changes, [true]);
});

test('changing or clearing the URL resets the connection', () => {
  const state = new ConnectionState();
  const changes = track(state);

  state.syncUrl('https://host/a');
  const ticket = state.beginProbe('https://host/a');
  assert.ok(ticket);
  state.completeProbe(ticket, true);
  assert.equal(state.connected, true);

  state.syncUrl('https://host/b');
  assert.equal(state.connected, false);
  assert.deepEqual(changes, [true, false]);
});

test('a probe that resolves after the URL was cleared is discarded', () => {
  const state = new ConnectionState();
  const changes = track(state);

  const ticket = state.beginProbe('https://host/a');
  assert.ok(ticket);
  state.syncUrl('');

  assert.equal(state.completeProbe(ticket, true), false);
  assert.equal(state.connected, false);
  assert.deepEqual(changes, []);
});

test('a probe for a replaced URL is discarded', () => {
  const state = new ConnectionState();
  const changes = track(state);

  const ticket = state.beginProbe('https://host/a');
  assert.ok(ticket);
  state.syncUrl('https://host/b');

  assert.equal(state.completeProbe(ticket, true), false);
  assert.equal(state.connected, false);
  assert.deepEqual(changes, []);
});

test('a slow older probe cannot overwrite a newer successful probe', () => {
  const state = new ConnectionState();
  const changes = track(state);

  const slow = state.beginProbe('https://host/a');
  assert.ok(slow);
  const fast = state.beginProbe('https://host/a');
  assert.ok(fast);

  assert.equal(state.completeProbe(fast, true), true);
  assert.equal(state.connected, true);

  assert.equal(state.completeProbe(slow, false), false);
  assert.equal(state.connected, true);
  assert.deepEqual(changes, [true]);
});

test('re-saving the same URL invalidates tickets captured earlier', () => {
  const state = new ConnectionState();
  const ticket = state.beginProbe('https://host/a');
  assert.ok(ticket);
  state.completeProbe(ticket, true);

  const operation = state.captureTicket();
  state.syncUrl('');
  state.syncUrl('https://host/a');
  assert.equal(state.connected, false);

  assert.equal(state.markDisconnected(operation), false);
});

test('markConnected and markDisconnected update the current generation', () => {
  const state = new ConnectionState();
  const changes = track(state);

  state.syncUrl('https://host/a');
  assert.equal(state.markConnected(state.captureTicket()), true);
  assert.equal(state.connected, true);

  assert.equal(state.markDisconnected(), true);
  assert.equal(state.connected, false);
  assert.deepEqual(changes, [true, false]);
});

test('isConnectionError separates connectivity from business failures', () => {
  assert.equal(isConnectionError(new KaggleError('auth', 'unauthorized')), true);
  assert.equal(isConnectionError(new KaggleError('redirect', 'login')), true);
  assert.equal(isConnectionError(new KaggleError('nonJson', 'html')), true);
  assert.equal(isConnectionError(new KaggleError('timeout', 'slow')), true);
  assert.equal(isConnectionError(new KaggleError('network', 'down')), true);
  assert.equal(isConnectionError(new KaggleError('dns', 'no host')), true);
  assert.equal(isConnectionError(new KaggleError('tls', 'bad cert')), true);
  assert.equal(isConnectionError(new KaggleError('gateway', '503')), true);

  assert.equal(isConnectionError(new KaggleError('notFound', 'missing')), false);
  assert.equal(isConnectionError(new KaggleError('badRequest', 'bad path')), false);
  assert.equal(isConnectionError(new KaggleError('forbidden', 'read only')), false);
  assert.equal(isConnectionError(new KaggleError('tooLarge', 'big')), false);
  assert.equal(isConnectionError(new KaggleError('cancelled', 'cancelled')), false);
  assert.equal(isConnectionError(new KaggleError('server', '500')), false);
  assert.equal(isConnectionError(new Error('plain')), false);
});
