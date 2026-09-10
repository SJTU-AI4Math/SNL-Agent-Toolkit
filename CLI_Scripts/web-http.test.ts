import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import test from 'node:test';
import { serveWorkspace, WEB_DEFAULT_PORT, WEB_HOST } from '../src/web/server.ts';

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'snl-web-http-'));
  await writeFile(path.join(dir, 'index.html'), '<script src="/__snl/static/reader.js"></script>');
  await writeFile(path.join(dir, 'reader.js'), '// controlled transport fixture, not browser acceptance');
  await writeFile(path.join(dir, 'reader.css'), 'body { margin:0 }');
  let current = 'Initial';
  const reader = {
    async getWorkspace() { return { id: 'local', name: current, libraries: [] }; },
    async getSnapshot(slug: string) { if (slug !== 'Main') throw new Error('Unknown Library'); return { library: slug, title: current }; },
  };
  const host = await serveWorkspace(reader, dir, 0);
  return { ...host, change(value: string) { current = value; }, async cleanup() { await host.close(); await rm(dir, { recursive: true, force: true }); } };
}
function raw(url: string, pathname: string, headers: Record<string, string> = {}, method = 'GET'): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = request({ hostname: u.hostname, port: u.port, path: pathname, headers, method }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', value => body += value);
      res.on('end', () => resolve({ status: res.statusCode!, body }));
    });
    req.on('error', reject); req.end();
  });
}
test('HTTP transport serves the common reader and fresh data without exposing a directory', async () => {
  assert.equal(WEB_DEFAULT_PORT, 4911); assert.equal(WEB_HOST, '127.0.0.1');
  const f = await fixture();
  try {
    const home = await fetch(f.url);
    assert.equal(home.status, 200); assert.match(await home.text(), /\/__snl\/static\/reader.js/);
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
    assert.equal((await fetch(f.url + '/__snl/static/reader.css')).status, 200);
    assert.equal((await (await fetch(f.url + '/__snl/api/workspace')).json()).name, 'Initial');
    f.change('Updated');
    assert.equal((await (await fetch(f.url + '/__snl/api/snapshot?library=Main')).json()).title, 'Updated');
    assert.equal((await fetch(f.url + '/__snl/api/snapshot?library=Missing')).status, 400);
    assert.equal((await fetch(f.url + '/__snl/api/snapshot')).status, 400);
    for (const pathname of ['/.env', '/.SNL_Doc/config.json', '/__snl/static/model.mjs', '/src/cli/snl.ts', '/__snl/api/execute']) assert.equal((await raw(f.url, pathname)).status, 404, pathname);
    for (const pathname of ['/../../.env', '/%2e%2e/.env', '//external.test/', '/__snl/static/..%2fmodel.mjs']) assert.equal((await raw(f.url, pathname)).status, 400, pathname);
  } finally { await f.cleanup(); }
});
test('loopback service rejects cross-site, rebinding and write requests and occupied ports', async () => {
  const f = await fixture();
  try {
    assert.equal((await raw(f.url, '/', { Host: 'attacker.invalid' })).status, 403);
    assert.equal((await raw(f.url, '/__snl/api/workspace', { Origin: 'https://attacker.invalid' })).status, 403);
    assert.equal((await raw(f.url, '/', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await raw(f.url, '/', { Origin: 'null' })).status, 403);
    assert.equal((await raw(f.url, '/__snl/api/workspace', { Origin: f.url })).status, 200);
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) assert.equal((await raw(f.url, '/__snl/api/workspace', {}, method)).status, 405);
    const dir = await mkdtemp(path.join(tmpdir(), 'snl-web-occupied-'));
    try {
      await writeFile(path.join(dir, 'index.html'), '');
      await writeFile(path.join(dir, 'reader.js'), ''); await writeFile(path.join(dir, 'reader.css'), '');
      await assert.rejects(serveWorkspace({ getWorkspace: async () => ({}), getSnapshot: async () => ({}) }, dir, Number(new URL(f.url).port)), { code: 'web.port-in-use' });
      assert.equal((await fetch(f.url)).status, 200);
    } finally { await rm(dir, { recursive: true, force: true }); }
  } finally { await f.cleanup(); }
});
