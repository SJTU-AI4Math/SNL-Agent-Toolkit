import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { serveRemoteReader } from '../src/web/remote';
import type { WorkspaceReader } from '../src/web/workspace';

test('remote Reader requires TLS and rejects unauthorized, write and filesystem requests', async t => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'snl-remote-reader-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const keyPath = path.join(temporary, 'key.pem');
  const certPath = path.join(temporary, 'cert.pem');
  const configPath = path.join(temporary, 'openssl.cnf');
  await writeFile(configPath, '[req]\ndistinguished_name = dn\n[dn]\n');
  const issued = spawnSync('openssl', ['req', '-config', configPath, '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', keyPath, '-out', certPath],
  { encoding: 'utf8', timeout: 15_000 });
  if ((issued.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return t.skip('OpenSSL is required to issue a temporary test certificate');
  assert.equal(issued.status, 0, issued.stderr);
  const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
  const token = randomBytes(32).toString('base64url');
  let reads = 0;
  const reader: WorkspaceReader = {
    async getWorkspace() {
      reads++;
      return { id: 'local', name: 'Math', root: '/private/path', libraries: [], capabilities: { edit: false } };
    },
    async getSnapshot(slug) {
      reads++;
      if (slug !== 'Algebra') throw new Error('Path: /private/path');
      return {
        version: 1, renderSnapshotId: 'math-algebra', library: { slug, title: 'Algebra', warnings: [], outline: [] },
        entries: [], entryKinds: [], entryPackages: {}, macroKinds: [], macros: {}, relationships: [],
        preferences: { language: 'en', color_scheme: 'light', motion: 'reduced' }, languages: [], contentLanguage: 'en', resources: {},
      };
    },
  };
  const running = await serveRemoteReader(reader, { host: '127.0.0.1', port: 0, key, cert, token });
  t.after(running.close);
  function get(pathname: string, credential: string | null = token, method = 'GET', ca?: Buffer) {
    return new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const req = request(running.url + pathname, {
        ca, method, headers: credential === null ? {} : { authorization: 'Bearer ' + credential },
      }, res => {
        res.setEncoding('utf8');
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.end();
    });
  }
  const workspace = '/__snl/api/workspace';
  const snapshot = '/__snl/api/snapshot';
  await assert.rejects(get(workspace));
  assert.equal((await get(workspace, null, 'GET', cert)).status, 401);
  assert.equal((await get(workspace, token + 'a', 'GET', cert)).status, 401);
  assert.equal((await get(workspace, token, 'POST', cert)).status, 405);
  assert.equal((await get('/.env', token, 'GET', cert)).status, 404);
  assert.equal((await get(snapshot + '?library=A&library=B', token, 'GET', cert)).status, 400);
  assert.equal(reads, 0);
  const catalog = await get(workspace, token, 'GET', cert);
  assert.equal(catalog.status, 200);
  assert.deepEqual(JSON.parse(catalog.body), { id: 'remote', name: 'Math', libraries: [], capabilities: { edit: false } });
  const library = await get(snapshot + '?library=Algebra', token, 'GET', cert);
  assert.equal(library.status, 200);
  assert.equal(JSON.parse(library.body).library.slug, 'Algebra');
  const unknown = await get(snapshot + '?library=..%2Fprivate', token, 'GET', cert);
  assert.equal(unknown.status, 422);
  assert.doesNotMatch(unknown.body, /private\/path/);
});
