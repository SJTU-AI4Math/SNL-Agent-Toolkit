import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { apply as sourceDsh } from '../plugin-src/dsh-adapter.ts';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, it } from 'node:test';
import { deleteManagedEntity, getManagedEntity } from '../lib/entity-crud.ts';
import { entryEntityPath, packageManifestPath } from '../lib/entity-storage.ts';
import { repairPackageEntryIds } from '../lib/package-membership-repair.ts';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';

const repo = path.resolve(import.meta.dirname, '..');
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'snl-preservation-'));
  roots.push(root);
  await fs.cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  const manifest = path.join(root, '.SNL_Doc', packageManifestPath('_unpackaged'));
  const entry = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized'));
  return { root, manifest, entry };
}
const formats = {
  minified: (value: unknown) => JSON.stringify(value),
  CRLF: (value: unknown) => JSON.stringify(value, null, 4).replaceAll('\n', '\r\n') + '\r\n',
};
for (const [format, serialize] of Object.entries(formats)) {
  for (const defect of ['missing title', 'invalid kind']) {
    it(`F1 refuses ${defect} before any manifest install (${format})`, async (t) => {
      const { root, manifest, entry } = await fixture();
      const value = JSON.parse(await fs.readFile(manifest, 'utf8'));
      value.entry_ids = [];
      const raw = serialize(value);
      await fs.writeFile(manifest, raw);
      const before = await fs.stat(manifest);
      const envelope = JSON.parse(await fs.readFile(entry, 'utf8'));
      if (defect === 'missing title') delete envelope.entry.title;
      else envelope.entry.kind = 'missing-kind';
      await fs.writeFile(entry, JSON.stringify(envelope));
      const link = fs.link;
      let installs = 0;
      t.mock.method(fs, 'link', async (...args: Parameters<typeof fs.link>) => {
        if (args[1] === manifest) installs++;
        return link(...args);
      });
      const result = await executeOperation({ protocol: OPERATION_PROTOCOL, command: 'repair/package-entry-ids', root, arguments: { id: '_unpackaged' } });
      assert.equal(result.response.ok, false);
      assert.deepEqual({ installs, bytes: await fs.readFile(manifest, 'utf8'), inode: (await fs.stat(manifest)).ino },
        { installs: 0, bytes: raw, inode: before.ino });
    });
  }
  it(`F1 replays raw ${format} bytes after post-install payload corruption`, async (t) => {
    const { root, manifest, entry } = await fixture();
    const value = JSON.parse(await fs.readFile(manifest, 'utf8'));
    value.entry_ids = [];
    const raw = serialize(value);
    await fs.writeFile(manifest, raw);
    const link = fs.link;
    let injected = false;
    t.mock.method(fs, 'link', async (...args: Parameters<typeof fs.link>) => {
      await link(...args);
      if (args[1] === manifest && !injected) {
        injected = true;
        const envelope = JSON.parse(await fs.readFile(entry, 'utf8'));
        delete envelope.entry.title;
        await fs.writeFile(entry, JSON.stringify(envelope));
      }
    });
    await assert.rejects(() => repairPackageEntryIds(root, '_unpackaged'), /Entry payload/);
    assert.equal(injected, true);
    assert.equal(await fs.readFile(manifest, 'utf8'), raw);
  });
}

it('F1 retains mandatory canonical Entry markers for repair on legacy 0.0.11', async () => {
  const { root, manifest, entry } = await fixture();
  const configFile = path.join(root, '.SNL_Doc/config.json');
  const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
  config.version = '0.0.11';
  await fs.writeFile(configFile, JSON.stringify(config));
  const value = JSON.parse(await fs.readFile(manifest, 'utf8'));
  value.entry_ids = [];
  const raw = JSON.stringify(value);
  await fs.writeFile(manifest, raw);
  const envelope = JSON.parse(await fs.readFile(entry, 'utf8'));
  delete envelope.schema_version;
  await fs.writeFile(entry, JSON.stringify(envelope));
  await assert.rejects(() => repairPackageEntryIds(root, '_unpackaged'), /schema_version|canonical Entry/);
  assert.equal(await fs.readFile(manifest, 'utf8'), raw);
});

it('F1 rejects sibling corruption before any target install, not just after rollback', async (t) => {
  for (const defect of ['missing membership', 'duplicate membership', 'wrong schema', 'missing name']) {
    const { root, manifest } = await fixture();
    const value = JSON.parse(await fs.readFile(manifest, 'utf8'));
    value.entry_ids = [];
    const raw = JSON.stringify(value);
    await fs.writeFile(manifest, raw);
    const before = await fs.stat(manifest);
    const sibling = path.join(root, '.SNL_Doc', packageManifestPath('Logic'));
    const other = JSON.parse(await fs.readFile(sibling, 'utf8'));
    if (defect === 'missing membership') other.entry_ids = ['ghost'];
    if (defect === 'duplicate membership') other.entry_ids = ['ghost', 'ghost'];
    if (defect === 'wrong schema') other.schema_version = 3;
    if (defect === 'missing name') delete other.name;
    const siblingRaw = JSON.stringify(other);
    await fs.writeFile(sibling, siblingRaw);
    const link = fs.link;
    let installs = 0;
    const mocked = t.mock.method(fs, 'link', async (...args: Parameters<typeof fs.link>) => {
      if (args[1] === manifest) installs++;
      return link(...args);
    });
    try {
      await assert.rejects(() => repairPackageEntryIds(root, '_unpackaged'), /entry_ids|manifest/i);
      assert.equal(installs, 0, defect);
      assert.equal((await fs.stat(manifest)).ino, before.ino);
      assert.equal(await fs.readFile(manifest, 'utf8'), raw);
      assert.equal(await fs.readFile(sibling, 'utf8'), siblingRaw);
    } finally { mocked.mock.restore(); }
  }
});

// Artifact characterization: the same negative and positive public contract
// must execute in rebuilt CLI/MCP/DSH, not just appear as bundled source text.
for (const mode of ['source', 'CLI', 'DSH source', 'DSH bundle', 'MCP', 'agent MCP']) {
  it(`F1 public repair source/artifact parity: ${mode}`, async () => {
    async function call(root: string): Promise<{ ok: boolean; data?: { changed: boolean } }> {
      const args = { root, command: 'repair/package-entry-ids', arguments: { id: '_unpackaged' } };
      if (mode === 'source') return (await executeOperation({ protocol: OPERATION_PROTOCOL, ...args })).response as any;
      if (mode.startsWith('DSH')) {
        const apply = mode === 'DSH source' ? sourceDsh : (await import(pathToFileURL(path.join(repo, 'dist/dsh/adapter.mjs')).href)).apply;
        const tools: Array<Record<string, any>> = [];
        await apply({ tools: { register(tool: Record<string, any>) { tools.push(tool); } } });
        return tools.find(tool => tool.name === 'snl_execute')!.execute(args, { signal: new AbortController().signal });
      }
      const result = mode === 'CLI'
        ? spawnSync(process.execPath, ['dist/cli/snl.mjs', 'repair', 'package-entry-ids', '_unpackaged', '--root', root, '--json'], { cwd: repo, encoding: 'utf8', timeout: 15000 })
        : spawnSync(process.execPath, [mode === 'MCP' ? 'dist/mcp/server.cjs' : 'agent-plugin/dist/mcp/server.cjs'], {
          cwd: repo, encoding: 'utf8', timeout: 15000,
          input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'snl_execute', arguments: args } }) + '\n',
        });
      assert.ifError(result.error);
      assert.equal(result.stderr, '');
      const body = JSON.parse(result.stdout.trim());
      if (mode === 'CLI') { assert.equal(result.status, body.ok ? 0 : 2); return body; }
      assert.equal(result.status, 0);
      return body.result.structuredContent;
    }
    for (const serialize of Object.values(formats)) for (const defect of ['title', 'kind']) {
      const { root, manifest, entry } = await fixture();
      const value = JSON.parse(await fs.readFile(manifest, 'utf8'));
      value.entry_ids = [];
      const raw = serialize(value);
      await fs.writeFile(manifest, raw);
      const before = await fs.stat(manifest);
      const valid = await fs.readFile(entry, 'utf8');
      const envelope = JSON.parse(valid);
      if (defect === 'title') delete envelope.entry.title;
      else envelope.entry.kind = 'missing-kind';
      await fs.writeFile(entry, JSON.stringify(envelope));
      assert.equal((await call(root)).ok, false);
      assert.equal(await fs.readFile(manifest, 'utf8'), raw);
      assert.equal((await fs.stat(manifest)).ino, before.ino);
      await fs.writeFile(entry, valid);
      assert.equal((await call(root)).ok, true);
      assert.deepEqual(JSON.parse(await fs.readFile(manifest, 'utf8')).entry_ids, ['entry.localized']);
      assert.equal((await call(root)).data?.changed, false);
    }
  });
}

for (const field of ['mtimeMs', 'atimeMs', 'mode'] as const) {
  it(`F2 restores canonical root, nested directories and files ${field} under restrictive umask`, async () => {
    const { root } = await fixture();
    const dir = path.join(root, '.SNL_Doc/libraries/sample');
    await fs.mkdir(dir, { recursive: true });
    for (const [name, text] of Object.entries({ 'meta.json': '{}\n', 'graph.json': '{"nodes":[],"relationships":[]}\n', 'counters.json': '{"counters":[]}\n' }))
      await fs.writeFile(path.join(dir, name), text);
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    const expected = new Map<string, { mtimeMs: number; atimeMs: number; mode: number }>();
    const mask = process.umask();
    try {
      await assert.rejects(() => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDirectoryRemove: async captured => {
          await fs.mkdir(path.join(captured, 'documents/nested'), { recursive: true });
          await fs.writeFile(path.join(captured, 'documents/nested/late.txt'), 'late');
        },
        beforeLibraryRestoreInstall: async () => {
          const libraries = path.dirname(dir);
          const name = (await fs.readdir(libraries)).find(n => n.startsWith('.sample.snl-entity-') && n.endsWith('.deleted'));
          assert.ok(name);
          const captured = path.join(libraries, name);
          // Last capture seam: reset atime after earlier validation reads, and
          // before snapshot reads can update it. Check canonical paths, not recovery copies.
          for (const relative of ['meta.json', 'documents/nested/late.txt', 'documents/nested', 'documents', '']) {
            const file = path.join(captured, relative);
            const mode = (await fs.stat(file)).isDirectory() ? 0o751 : 0o640;
            await fs.chmod(file, mode);
            await fs.utimes(file, 1700000000, 1700000100);
            const stat = await fs.stat(file);
            expected.set(relative, { atimeMs: stat.atimeMs, mtimeMs: stat.mtimeMs, mode: stat.mode & 0o7777 });
          }
          process.umask(0o077);
        },
      }), /changed while deletion was in flight.*restored/i);
    } finally { process.umask(mask); }
    assert.equal(expected.size, 5);
    const observed = [];
    for (const [relative, before] of expected) {
      const stat = await fs.stat(path.join(dir, relative));
      observed.push([relative, field === 'mode' ? stat.mode & 0o7777 : stat[field], before[field]]);
    }
    assert.deepEqual(observed.map(([relative, actual]) => [relative, actual]), observed.map(([relative, , expected]) => [relative, expected]));
    assert.equal(await fs.readFile(path.join(dir, 'documents/nested/late.txt'), 'utf8'), 'late');
    assert.equal(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'), '{}\n');
  });
}
