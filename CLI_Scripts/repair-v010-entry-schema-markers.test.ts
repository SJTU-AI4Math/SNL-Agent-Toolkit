import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { repairV010EntrySchemaMarkers } from '../scripts/repair-v010-entry-schema-markers.ts';

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

function envelope(id: string, title: string, schemaVersion?: number): string {
  return `${JSON.stringify({
    format: 'snl-entry',
    version: 1,
    ...(schemaVersion === undefined ? {} : { schema_version: schemaVersion }),
    package: 'P',
    entry: { id, title },
  }, null, 2)}\n`;
}

test('repairs only missing current Entry schema markers and is idempotent', async () => {
  const root = await fixture();
  try {
    const entries = path.join(root, '.SNL_Doc', 'entries');
    const legacyFile = path.join(entries, 'legacy.json');
    const currentFile = path.join(entries, 'current.json');
    const current = envelope('P.y', 'current', 1);
    await writeFile(legacyFile, envelope('P.x', 'legacy'));
    await chmod(legacyFile, 0o666);
    await writeFile(currentFile, current);

    const originalUmask = process.umask(0o077);
    try {
      assert.deepEqual(await repairV010EntrySchemaMarkers(root), { status: 'ok', scanned: 2, repaired: 1 });
    } finally {
      process.umask(originalUmask);
    }
    assert.match(await readFile(legacyFile, 'utf8'), /"version": 1,\n  "schema_version": 1,/u);
    assert.equal((await stat(legacyFile)).mode & 0o777, 0o666);
    assert.equal(await readFile(currentFile, 'utf8'), current);

    const repaired = await readFile(legacyFile, 'utf8');
    assert.deepEqual(await repairV010EntrySchemaMarkers(root), { status: 'ok', scanned: 2, repaired: 0 });
    assert.equal(await readFile(legacyFile, 'utf8'), repaired);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unsupported schema markers without changing the file', async () => {
  const root = await fixture();
  try {
    const file = path.join(root, '.SNL_Doc', 'entries', 'future.json');
    const future = envelope('P.future', 'future', 2);
    await writeFile(file, future);
    await assert.rejects(repairV010EntrySchemaMarkers(root), /unsupported schema_version 2/u);
    assert.equal(await readFile(file, 'utf8'), future);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('detects a non-cooperative concurrent replacement instead of losing it', async () => {
  const root = await fixture();
  try {
    const file = path.join(root, '.SNL_Doc', 'entries', 'entry.json');
    await writeFile(file, envelope('P.x', 'before'));
    const concurrent = envelope('P.x', 'concurrent');
    await assert.rejects(
      repairV010EntrySchemaMarkers(root, {
        beforeWrites: async () => { await writeFile(file, concurrent); },
      }),
      /changed concurrently; refusing to overwrite/u,
    );
    assert.equal(await readFile(file, 'utf8'), concurrent);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects indirect Entry paths before writing any envelope', async () => {
  const root = await fixture();
  const external = path.join(await mkdtemp(path.join(tmpdir(), 'snl-entry-external-')), 'outside.json');
  try {
    const entries = path.join(root, '.SNL_Doc', 'entries');
    const regular = path.join(entries, 'a.json');
    await writeFile(regular, envelope('P.a', 'regular'));
    await writeFile(external, envelope('P.z', 'external'));
    await symlink(external, path.join(entries, 'z.json'));

    await assert.rejects(repairV010EntrySchemaMarkers(root), /regular, non-symlink Entry envelope/u);
    assert.equal(await readFile(regular, 'utf8'), envelope('P.a', 'regular'));
    assert.equal(await readFile(external, 'utf8'), envelope('P.z', 'external'));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(path.dirname(external), { recursive: true, force: true });
  }
});

test('rejects noncanonical JSON instead of changing bytes beyond the marker', async () => {
  const root = await fixture();
  try {
    const file = path.join(root, '.SNL_Doc', 'entries', 'entry.json');
    const noncanonical = '{"format":"snl-entry","version":1,"package":"P","entry":{"id":"P.x","title":"compact"}}\n';
    await writeFile(file, noncanonical);
    await assert.rejects(repairV010EntrySchemaMarkers(root), /canonical Toolkit JSON serialization/u);
    assert.equal(await readFile(file, 'utf8'), noncanonical);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a symlinked .SNL_Doc before creating a lock in its target', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-entry-schema-root-'));
  const external = await mkdtemp(path.join(tmpdir(), 'snl-entry-schema-doc-'));
  try {
    await mkdir(path.join(external, 'entries'));
    await writeFile(path.join(external, 'config.json'), `${JSON.stringify({ version: '0.1.0', entity_storage: { version: 1 } }, null, 2)}\n`);
    await symlink(external, path.join(root, '.SNL_Doc'));
    await assert.rejects(repairV010EntrySchemaMarkers(root), /canonical, non-symlink directory/u);
    await assert.rejects(stat(path.join(external, '.data-write.lock')), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});

test('honors the shared Toolkit workspace writer lock', async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, '.SNL_Doc', 'entries', 'entry.json'), envelope('P.x', 'legacy'));
    const lock = path.join(root, '.SNL_Doc', '.data-write.lock');
    await writeFile(lock, `${JSON.stringify({ version: 1, pid: process.pid, hostname: 'test', token: 'held', purpose: 'test writer', createdAt: new Date().toISOString() })}\n`);
    await assert.rejects(repairV010EntrySchemaMarkers(root), /workspace data is locked/u);
    assert.equal(await readFile(path.join(root, '.SNL_Doc', 'entries', 'entry.json'), 'utf8'), envelope('P.x', 'legacy'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
