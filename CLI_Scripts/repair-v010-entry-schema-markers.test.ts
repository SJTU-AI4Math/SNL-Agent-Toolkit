import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const script = path.resolve('scripts/repair-v010-entry-schema-markers.mjs');

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-entry-schema-repair-'));
  const entries = path.join(root, '.SNL_Doc', 'entries');
  await mkdir(entries, { recursive: true });
  await writeFile(
    path.join(root, '.SNL_Doc', 'config.json'),
    `${JSON.stringify({ version: '0.1.0', entity_storage: { version: 1 } }, null, 2)}\n`,
  );
  return root;
}

test('repairs only missing current Entry schema markers and is idempotent', async () => {
  const root = await fixture();
  try {
    const entries = path.join(root, '.SNL_Doc', 'entries');
    const legacy = '{\n  "format": "snl-entry",\n  "version": 1,\n  "package": "P",\n  "entry": {"id":"P.x"}\n}\n';
    const current = '{\n  "format": "snl-entry",\n  "version": 1,\n  "schema_version": 1,\n  "package": "P",\n  "entry": {"id":"P.y"}\n}\n';
    await writeFile(path.join(entries, 'legacy.json'), legacy);
    await chmod(path.join(entries, 'legacy.json'), 0o640);
    await writeFile(path.join(entries, 'current.json'), current);

    const first = JSON.parse((await execFileAsync('node', [script, root])).stdout);
    assert.deepEqual(first, { status: 'ok', scanned: 2, repaired: 1 });
    assert.match(await readFile(path.join(entries, 'legacy.json'), 'utf8'), /"version": 1,\n  "schema_version": 1,/u);
    assert.equal((await stat(path.join(entries, 'legacy.json'))).mode & 0o777, 0o640);
    assert.equal(await readFile(path.join(entries, 'current.json'), 'utf8'), current);

    const repaired = await readFile(path.join(entries, 'legacy.json'), 'utf8');
    const second = JSON.parse((await execFileAsync('node', [script, root])).stdout);
    assert.deepEqual(second, { status: 'ok', scanned: 2, repaired: 0 });
    assert.equal(await readFile(path.join(entries, 'legacy.json'), 'utf8'), repaired);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unsupported schema markers without changing the file', async () => {
  const root = await fixture();
  try {
    const file = path.join(root, '.SNL_Doc', 'entries', 'future.json');
    const future = '{\n  "format": "snl-entry",\n  "version": 1,\n  "schema_version": 2,\n  "package": "P",\n  "entry": {"id":"P.future"}\n}\n';
    await writeFile(file, future);
    await assert.rejects(execFileAsync('node', [script, root]), /unsupported schema_version 2/u);
    assert.equal(await readFile(file, 'utf8'), future);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
