import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request, type IncomingMessage, type ServerResponse } from 'node:http';
import { watch, type FSWatcher } from 'node:fs';
import test from 'node:test';
import { serveWorkspace, type WebWatchOptions } from '../src/web/server.ts';
import { WATCH_UNAVAILABLE } from '../src/web/changes.ts';

type Event = { event: string; data: Record<string, string> };
async function fixture(options: WebWatchOptions = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-web-events-'));
  await mkdir(path.join(root, '.SNL_Doc'));
  await writeFile(path.join(root, '.SNL_Doc/config.json'), '{}');
  for (const name of ['index.html', 'reader.js', 'reader.css']) await writeFile(path.join(root, name), '');
  let reads = 0;
  const reader = { async getWorkspace() { reads++; return {}; }, async getSnapshot() { reads++; return {}; } };
  const host = await serveWorkspace(reader, root, 0, { root, ...options });
  return { ...host, root, reads: () => reads, async cleanup() { await host.close(); await rm(root, { recursive: true, force: true }); } };
}
async function subscribe(url: string) {
  let response: IncomingMessage;
  const events: Event[] = [];
  const req = request(url + '/__snl/api/events');
  const headers = new Promise<IncomingMessage>((resolve, reject) => { req.once('response', resolve); req.once('error', reject); });
  req.end();
  response = await headers;
  let buffer = '';
  let heartbeats = 0;
  response.setEncoding('utf8');
  response.on('data', chunk => {
    buffer += chunk;
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
      if (frame === ': heartbeat') heartbeats++;
      const name = /^event: (.*)$/m.exec(frame)?.[1];
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      if (name && data) events.push({ event: name, data: JSON.parse(data) });
    }
  });
  return { response, events, heartbeats: () => heartbeats, close() { req.destroy(); response.destroy(); } };
}
async function until(check: () => boolean, message: string, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}

test('SSE immediately announces an opaque revision then a debounced real file change, without reading snapshots', { timeout: 10000 }, async () => {
  const f = await fixture();
  let stream: Awaited<ReturnType<typeof subscribe>> | undefined;
  try {
    stream = await subscribe(f.url);
    assert.equal(stream.response.statusCode, 200);
    assert.match(stream.response.headers['content-type']!, /^text\/event-stream/);
    await until(() => stream!.events.length === 1, 'initial change event');
    assert.equal(stream.events[0].event, 'change');
    assert.deepEqual(Object.keys(stream.events[0].data), ['revision']);
    const first = stream.events[0].data.revision;
    assert.ok(first); assert.ok(!first.includes(f.root));
    await writeFile(path.join(f.root, '.SNL_Doc/config.json'), '{"name":"changed"}');
    await until(() => stream!.events.length === 2, 'file edit notification');
    assert.equal(stream.events[1].event, 'change');
    assert.notEqual(stream.events[1].data.revision, first);
    assert.equal(f.reads(), 0);
  } finally { stream?.close(); await f.cleanup(); }
});

function trackedWatchers() {
  const active = new Set<FSWatcher>();
  let calls = 0;
  const options: WebWatchOptions = { heartbeatMs: 40, watch: { debounceMs: 40, retryMs: 70, watchDirectory(directory, changed) {
    calls++;
    const watcher = watch(directory, (_event, name) => changed(name?.toString() ?? null));
    active.add(watcher); watcher.once('close', () => active.delete(watcher));
    return watcher;
  } } };
  return { active, options, calls: () => calls };
}

test('subscribers share watches/revisions, reconnect receives current revision, heartbeat and HEAD work, direct server.close drains streams', { timeout: 10000 }, async () => {
  const tracker = trackedWatchers();
  const f = await fixture(tracker.options);
  const streams: Awaited<ReturnType<typeof subscribe>>[] = [];
  let closed = false;
  try {
    const head = await fetch(f.url + '/__snl/api/events', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const one = await subscribe(f.url); streams.push(one);
    const two = await subscribe(f.url); streams.push(two);
    await until(() => one.events.length === 1 && two.events.length === 1, 'both initial revisions');
    assert.deepEqual(one.events, two.events);
    assert.equal(tracker.calls(), 2); assert.equal(tracker.active.size, 2);
    await until(() => one.heartbeats() > 0 && two.heartbeats() > 0, 'idle SSE heartbeat');
    await writeFile(path.join(f.root, '.SNL_Doc/config.json'), 'changed');
    await until(() => one.events.length === 2 && two.events.length === 2, 'shared change');
    assert.deepEqual(one.events, two.events);
    one.close();
    const reconnect = await subscribe(f.url); streams.push(reconnect);
    await until(() => reconnect.events.length === 1, 'reconnect initial revision');
    assert.deepEqual(reconnect.events[0], two.events.at(-1));
    assert.equal(tracker.calls(), 2);
    await new Promise<void>((resolve, reject) => f.server.close(error => error ? reject(error) : resolve()));
    closed = true;
    await until(() => tracker.active.size === 0 && two.response.destroyed && reconnect.response.destroyed, 'all stream/watch handles drained');
  } finally { streams.forEach(stream => stream.close()); if (!closed) await f.close(); await rm(f.root, { recursive: true, force: true }); }
});

test('SSE reuses Host, Origin, Fetch-Site, readonly-method and path safety gates', { timeout: 10000 }, async () => {
  const f = await fixture();
  const raw = (pathname: string, headers: Record<string, string> = {}, method = 'GET') => new Promise<number>((resolve, reject) => {
    const url = new URL(f.url);
    const req = request({ hostname: url.hostname, port: url.port, path: pathname, headers, method }, res => {
      res.resume(); res.once('end', () => resolve(res.statusCode!));
    });
    req.once('error', reject); req.end();
  });
  try {
    const route = '/__snl/api/events';
    const deniedHeaders: Record<string, string>[] = [{ Host: 'evil.invalid' }, { Origin: 'https://evil.invalid' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }];
    for (const headers of deniedHeaders) {
      assert.equal(await raw(route, headers), 403);
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) assert.equal(await raw(route, {}, method), 405);
    for (const pathname of ['/__snl/api/%65vents/../events', '/__snl/api/../api/events', '/__snl/api/%2e%2e/events', '//__snl/api/events']) {
      assert.equal(await raw(pathname), 400);
    }
    assert.equal(await raw(route, { Origin: f.url }, 'HEAD'), 200);
    assert.equal(f.reads(), 0);
  } finally { await f.cleanup(); }
});

test('SSE sanitizes watcher errors, keeps manual reads available, recovers, and tells new subscribers when unavailable', { timeout: 10000 }, async () => {
  const tracker = trackedWatchers();
  const f = await fixture(tracker.options);
  const streams: Awaited<ReturnType<typeof subscribe>>[] = [];
  try {
    const first = await subscribe(f.url); streams.push(first);
    await until(() => first.events.length === 1, 'initial revision');
    [...tracker.active][0].emit('error', new Error('/private/workspace/secret.json ENOSPC'));
    await until(() => first.events.some(event => event.event === 'unavailable'), 'unavailability event');
    assert.deepEqual(first.events[1], { event: 'unavailable', data: { message: WATCH_UNAVAILABLE } });
    assert.equal((await fetch(f.url + '/__snl/api/workspace')).status, 200);
    assert.equal((await fetch(f.url + '/__snl/api/snapshot?library=Main')).status, 200);
    await until(() => first.events.length === 3, 'recovery change');
    assert.equal(first.events[2].event, 'change');
    assert.notEqual(first.events[2].data.revision, first.events[0].data.revision);
    await rm(path.join(f.root, '.SNL_Doc'), { recursive: true });
    await until(() => first.events.at(-1)?.event === 'unavailable', 'root loss event');
    const reconnect = await subscribe(f.url); streams.push(reconnect);
    await until(() => reconnect.events.length === 2, 'initial revision followed by current unavailable status');
    assert.equal(reconnect.events[0].event, 'change');
    assert.deepEqual(reconnect.events[1], { event: 'unavailable', data: { message: WATCH_UNAVAILABLE } });
    await mkdir(path.join(f.root, '.SNL_Doc'));
    await until(() => reconnect.events.length === 3, 'root recovery');
    assert.equal(reconnect.events[2].event, 'change');
  } finally { streams.forEach(stream => stream.close()); await f.cleanup(); }
});

test('listen failure closes the already-created shared watcher and does not retry after disposal', { timeout: 10000 }, async () => {
  const f = await fixture();
  const tracker = trackedWatchers();
  try {
    await assert.rejects(serveWorkspace({ getWorkspace: async () => ({}), getSnapshot: async () => ({}) },
      f.root, Number(new URL(f.url).port), { root: f.root, ...tracker.options }), { code: 'web.port-in-use' });
    await until(() => tracker.active.size === 0, 'startup failure closes watch handles');
    assert.equal(tracker.calls(), 2);
    await writeFile(path.join(f.root, '.SNL_Doc/config.json'), 'after failed startup');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(tracker.calls(), 2);
    assert.equal((await fetch(f.url)).status, 200);
  } finally { await f.cleanup(); }
});

test('a backpressured SSE response is disconnected rather than accumulating an unbounded queue', { timeout: 10000 }, async () => {
  const f = await fixture({ heartbeatMs: 40 });
  let writes = 0;
  f.server.prependListener('request', (req, res) => {
    if (req.url !== '/__snl/api/events') return;
    const original = res.write.bind(res);
    // Deterministically exercise Node's backpressure signal on a real HTTP
    // stream; waiting for machine-dependent TCP buffers to fill is flaky.
    res.write = ((...args: Parameters<ServerResponse['write']>) => {
      writes++;
      const result = original(...args);
      return writes > 1 ? false : result;
    }) as ServerResponse['write'];
  });
  let stream: Awaited<ReturnType<typeof subscribe>> | undefined;
  try {
    stream = await subscribe(f.url);
    await until(() => stream!.events.length === 1, 'initial frame');
    await until(() => stream!.response.destroyed, 'slow stream closed on first backpressure signal');
    await new Promise(resolve => setTimeout(resolve, 130));
    assert.equal(writes, 2);
    assert.equal((await fetch(f.url + '/__snl/api/workspace')).status, 200);
  } finally { stream?.close(); await f.cleanup(); }
});
