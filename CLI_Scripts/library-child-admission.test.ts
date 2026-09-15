import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { deleteManagedEntity, getManagedEntity } from '../lib/entity-crud.ts';

it('F2-R1 public Library rollback refuses child exchange without foreign metadata or content writes', async (t) => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'snl-child-admission-'));
  try {
    await fs.cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
    const dir = path.join(root, '.SNL_Doc/libraries/sample');
    await fs.mkdir(dir, { recursive: true });
    for (const [name, text] of Object.entries({ 'meta.json': '{}\n', 'graph.json': '{"nodes":[],"relationships":[]}\n', 'counters.json': '{"counters":[]}\n' }))
      await fs.writeFile(path.join(dir, name), text);
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    const foreign = path.join(root, 'foreign');
    await fs.mkdir(foreign, { mode: 0o755 });
    await fs.utimes(foreign, 1600000000, 1600000100);
    const metadata = async (p: string) => { const s = await fs.stat(p); return { dev: s.dev, ino: s.ino, mode: s.mode, atimeMs: s.atimeMs, mtimeMs: s.mtimeMs }; };
    const before = await metadata(foreign);
    const mkdir = fs.mkdir;
    let injected = false;
    // Exact baseline seam: successful public child mkdir, before its first open.
    // A staged implementation instead reaches the public publication seam below.
    t.mock.method(fs, 'mkdir', async (...args: Parameters<typeof fs.mkdir>) => {
      const result = await mkdir(...args);
      if (String(args[0]).startsWith('/proc/self/fd/') && path.basename(String(args[0])) === 'documents') {
        injected = true;
        await fs.rename(foreign, args[0]);
      }
      return result;
    });
    const mkdtemp = fs.mkdtemp;
    t.mock.method(fs, 'mkdtemp', async (...args: Parameters<typeof fs.mkdtemp>) => {
      const result = await mkdtemp(...args);
      if (String(args[0]).includes('.snl-restore-child-') && !injected) {
        // Occupy the public destination before no-replace publication.
        injected = true;
        await fs.rename(foreign, path.join(dir, 'documents'));
      }
      return result;
    });
    let failure: unknown;
    try {
      await deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDirectoryRemove: async captured => {
          const child = path.join(captured, 'documents');
          await mkdir(child, { mode: 0o751 });
          await fs.utimes(child, 1700000000, 1700000100);
        },
      });
    } catch (error) { failure = error; }
    assert.equal(injected, true);
    const destination = path.join(dir, 'documents');
    assert.deepEqual(await metadata(destination), before, 'foreign inode/mode/atime/mtime must remain untouched');
    assert.deepEqual(await fs.readdir(destination), [], 'foreign contents remain empty');
    assert.match(String(failure), /recovery failed without overwriting concurrent data/);
    assert.match(String(failure), /concurrent replacement/);
  } finally { t.mock.restoreAll(); await fs.rm(root, { recursive: true, force: true }); }
});

// Public adapters run the same real rollback in separate Node processes. The
// preload controls only fs scheduling, never substitutes operation results.
for (const mode of ['CLI', 'DSH source', 'DSH bundle', 'MCP', 'agent MCP']) {
  it(`F2-R1 child refusal and stable metadata parity: ${mode}`, async () => {
    const repo = path.resolve(import.meta.dirname, '..');
    for (const exchange of [false, true]) {
      const root = await fs.mkdtemp(path.join(tmpdir(), 'snl-child-parity-'));
      try {
        await fs.cp(path.join(repo, 'CLI_Scripts/fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
        const dir = path.join(root, '.SNL_Doc/libraries/sample');
        await fs.mkdir(dir, { recursive: true });
        for (const [name, text] of Object.entries({ 'meta.json': '{}', 'graph.json': '{"nodes":[],"relationships":[]}', 'counters.json': '{"counters":[]}' }))
          await fs.writeFile(path.join(dir, name), text);
        const library = await getManagedEntity(root, 'library', 'sample');
        assert.ok(library);
        const foreign = path.join(root, 'foreign');
        await fs.mkdir(foreign, { mode: 0o755 });
        await fs.utimes(foreign, 1600000000, 1600000100);
        const metadata = async (p: string) => { const s = await fs.stat(p); return { ino: s.ino, mode: s.mode & 0o7777, atimeMs: s.atimeMs, mtimeMs: s.mtimeMs }; };
        const before = await metadata(foreign);
        const preload = path.join(root, 'schedule.mjs');
        await fs.writeFile(preload, `
import { promises as fs } from 'node:fs';
import path from 'node:path';
const root = ${JSON.stringify(root)}, exchange = ${exchange};
const originalRmdir = fs.rmdir, originalMkdtemp = fs.mkdtemp;
let late = false, occupied = false;
fs.rmdir = async (...args) => {
  if (!late && String(args[0]).endsWith('.deleted')) {
    late = true;
    const child = path.join(String(args[0]), 'documents');
    await fs.mkdir(child, { mode: 0o751 });
    await fs.chmod(child, 0o751);
    await fs.utimes(child, 1700000000, 1700000100);
  }
  return originalRmdir(...args);
};
fs.mkdtemp = async (...args) => {
  const result = await originalMkdtemp(...args);
  if (exchange && !occupied && String(args[0]).includes('.snl-restore-child-')) {
    occupied = true;
    await fs.rename(path.join(root, 'foreign'), path.join(root, '.SNL_Doc/libraries/sample/documents'));
  }
  return result;
};
`);
        const args = { root, action: 'delete', entityType: 'library', id: 'sample', expectedRevision: library.revision };
        let command: string[], input: string | undefined;
        if (mode === 'CLI') command = ['dist/cli/snl-entity.mjs', '--root', root, '--json', 'delete', '--type', 'library', '--if-match', library.revision, 'sample'];
        else if (mode.includes('MCP')) {
          command = [mode === 'MCP' ? 'dist/mcp/server.cjs' : 'agent-plugin/dist/mcp/server.cjs'];
          input = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'snl_entity_apply', arguments: args } }) + '\n';
        } else {
          const adapter = pathToFileURL(path.join(repo, mode === 'DSH source' ? 'plugin-src/dsh-adapter.ts' : 'dist/dsh/adapter.mjs')).href;
          command = ['--import', 'tsx', '--input-type=module', '-e', `
const { apply } = await import(${JSON.stringify(adapter)});
const tools = [];
await apply({ tools: { register(tool) { tools.push(tool); } } });
try { console.log(JSON.stringify(await tools.find(t => t.name === 'snl_entity_apply').execute(${JSON.stringify(args)}, { signal: new AbortController().signal }))); }
catch (error) { console.log(JSON.stringify({ error: String(error) })); }
`];
        }
        const result = spawnSync(process.execPath, ['--import', preload, ...command], { cwd: repo, encoding: 'utf8', input, timeout: 15000 });
        assert.ifError(result.error);
        assert.equal(result.stderr, '');
        assert.ok(result.stdout.trim());
        assert.doesNotThrow(() => JSON.parse(result.stdout.trim()));
        const child = path.join(dir, 'documents');
        if (exchange) {
          assert.deepEqual(await metadata(child), before);
          assert.match(result.stdout, /recovery failed without overwriting concurrent data/);
          assert.match(result.stdout, /renameat2 no-replace/);
        } else {
          const observed = await metadata(child);
          assert.deepEqual({ ...observed, ino: 0 }, { ino: 0, mode: 0o751, atimeMs: 1700000000000, mtimeMs: 1700000100000 });
          assert.match(result.stdout, /directory was restored/);
        }
        assert.deepEqual(await fs.readdir(child), []);
      } finally { await fs.rm(root, { recursive: true, force: true }); }
    }
  });
}
