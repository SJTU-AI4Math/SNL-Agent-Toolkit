import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
const cli = path.resolve('src/cli/snl.ts');
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
function invoke(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { cwd, encoding: 'utf8', timeout: 10000 });
}
test('bare snl reports the missing workspace with init guidance and writes nothing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-web-missing-'));
  try {
    const result = invoke(root, []);
    assert.equal(result.status, 2, result.stderr);
    const reply = JSON.parse(result.stdout);
    assert.equal(reply.error.code, 'web.workspace-missing');
    assert.match(reply.error.message, /snl init/);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('root help advertises the local host separately from operation commands', () => {
  const result = invoke(tmpdir(), ['--help']);
  assert.equal(result.status, 0);
  const reply = JSON.parse(result.stdout);
  assert.equal(reply.data.web.defaultPort, 4911);
  assert.equal(reply.data.web.host, '127.0.0.1');
  assert.equal(reply.data.web.readOnly, true);
  assert.ok(!reply.data.commands.includes('serve'));
});
test('bare host rejects malformed ports before any listener is started', () => {
  for (const port of ['0', '65536', '-1', '4911junk', '3.5', '']) {
    const result = invoke(tmpdir(), ['--port', port]);
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'usage.invalid');
  }
});
