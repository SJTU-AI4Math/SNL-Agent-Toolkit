#!/usr/bin/env node
// Run against an independently installed npm tarball, never source imports.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { cp, mkdtemp, readdir, readFile, rm, chmod, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const consumer = path.resolve(process.argv[2] ?? '.');
const require = createRequire(path.join(consumer, 'package.json'));
const packageRoot = path.dirname(require.resolve('@snl-doc/agent-toolkit/package.json'));
const fixture = path.resolve(import.meta.dirname, '../CLI_Scripts/fixtures/workspace-v0.1.0/.SNL_Doc');
const tags = ['中文', '', '__proto__', 'same', 'same'];
const evidence = [];
const registry = [];
const dsh = await import(pathToFileURL(require.resolve('@snl-doc/agent-toolkit/dsh')).href);
await dsh.apply({ tools: { register(tool) { registry.push(tool); } } });
assert.equal(registry.length, 7);
const execute = registry.find(t => t.name === 'snl_execute');
assert.ok(execute);
async function tree(root) {
  const out = [];
  async function visit(dir) {
    for (const item of (await readdir(path.join(root, dir), { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : 1)) {
      const name = path.join(dir, item.name);
      const mode = (await lstat(path.join(root, name))).mode;
      if (item.isDirectory()) { out.push([name, `directory:${mode}`]); await visit(name); }
      else { assert.ok(item.isFile()); out.push([name, `${mode}:${(await readFile(path.join(root, name))).toString('base64')}`]); }
    }
  }
  await visit(''); return out;
}
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.data; }
function receipt(check) { return { operations: check.normalizedOperations, checkedDigest: check.checkedDigest, expectedWorkspaceRevision: check.expectedWorkspaceRevision }; }
for (const adapter of ['cli', 'dist/mcp/server.cjs', 'agent-plugin/dist/mcp/server.cjs', 'dsh']) {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-batch-packed-'));
  try {
    await cp(fixture, path.join(root, '.SNL_Doc'), { recursive: true });
    function cli(args, input) {
      const run = spawnSync(process.execPath, [path.join(packageRoot, 'dist/cli/snl.mjs'), '--root', root, '--json', ...args], { encoding: 'utf8', input, timeout: 30000 });
      assert.equal(run.stderr, ''); assert.equal(run.signal, null);
      const result = JSON.parse(run.stdout); assert.equal(run.status === 0, result.ok); return result;
    }
    async function call(command, args = {}) {
      if (adapter === 'dsh') return execute.execute({ root, command, arguments: args }, { signal: new AbortController().signal });
      if (adapter === 'cli') {
        const tokens = command.split('/');
        if (command === 'batch/check') return cli([...tokens, '--input', '-'], JSON.stringify(args.operations));
        if (command === 'batch/apply') return cli([...tokens, '--input', '-'], JSON.stringify(args));
        if (command.endsWith('/get')) return cli([...tokens, args.id]);
        if (command.endsWith('/update')) return cli([...tokens, args.id, '--if-match', args.expectedRevision, '--input', '-'], JSON.stringify(args.value));
        return cli(tokens);
      }
      const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'snl_execute', arguments: { root, command, arguments: args } } };
      const run = spawnSync(process.execPath, [path.join(packageRoot, adapter)], { encoding: 'utf8', input: JSON.stringify(request)+'\n', timeout: 30000 });
      assert.equal(run.status, 0, run.stderr); assert.equal(run.stderr, '');
      const result = JSON.parse(run.stdout); assert.equal(result.error, undefined);
      return result.result.structuredContent;
    }
    const help = ok(await call('help'));
    assert.ok(help.commands.includes('batch/check')); assert.ok(help.commands.includes('batch/apply'));
    assert.ok(!help.commands.includes('relationship/generate')); assert.equal(help.web.readOnly, true);
    const discovery = ok(await call('batch'));
    assert.equal(discovery.operationCommands.length, 7); assert.ok(!discovery.operationCommands.includes('library/create'));
    const operations = [
      { command: 'entry/create', arguments: { value: { id: 'packed.dependent', package: 'Packed', kind: 'definition', tags } } },
      { command: 'relationship/create', arguments: { value: { id: 'packed.depends', from: 'packed.dependent', to: 'entry.localized', label: 'depends', metadata: { manual: true } } } },
      { command: 'entry-package/create', arguments: { value: { id: 'Packed' } } },
    ];
    for (const [relative, mode] of [['entries', 0o2775], ['', 0o1777], ['config.json', 0o4755]]) {
      const target = path.join(root, '.SNL_Doc', relative);
      const originalMode = (await lstat(target)).mode & 0o7777;
      await chmod(target, mode & 0o777);
      const emptyReceipt = receipt(ok(await call('batch/check', { operations: [] })));
      await chmod(target, mode);
      assert.equal((await lstat(target)).mode & 0o7777, mode);
      const specialTree = await tree(root);
      const check = await call('batch/check', { operations: [] });
      assert.equal(check.ok, false, `${adapter} check accepted unsupported ${mode.toString(8)}`);
      assert.equal(check.error.code, 'workspace.unsupported-mode');
      const apply = await call('batch/apply', emptyReceipt);
      assert.equal(apply.ok, false);
      assert.equal(apply.error.code, 'workspace.unsupported-mode');
      assert.deepEqual(await tree(root), specialTree);
      await chmod(target, originalMode);
    }
    const before = await tree(root);
    const empty = receipt(ok(await call('batch/check', { operations: [] })));
    ok(await call('batch/apply', empty));
    assert.deepEqual(await tree(root), before);
    const checked = ok(await call('batch/check', { operations }));
    assert.deepEqual(await tree(root), before);
    const bad = await call('batch/apply', { ...receipt(checked), checkedDigest: 'tampered' });
    assert.equal(bad.ok, false); assert.equal(bad.error.code, 'batch.digest-conflict'); assert.deepEqual(await tree(root), before);
    const stale = await call('batch/apply', { ...receipt(checked), expectedWorkspaceRevision: 'stale' });
    assert.equal(stale.ok, false); assert.equal(stale.error.code, 'batch.workspace-conflict'); assert.deepEqual(await tree(root), before);
    for (const invalid of [
      [{ command: 'library/create', arguments: { value: { id: 'unsupported' } } }],
      [...operations, operations[0]],
      [{ command: 'entry/create', arguments: { value: { id: 'bad.tags', kind: 'definition', tags: [null] } } }],
    ]) { assert.equal((await call('batch/check', { operations: invalid })).ok, false); assert.deepEqual(await tree(root), before); }
    if (adapter === 'cli') {
      const invalid = cli(['batch', 'check', '--input', '-'], '[{"command":"entry/create","command":"library/create","arguments":{"value":{}}}]');
      assert.equal(invalid.error.code, 'input.invalid-json'); assert.deepEqual(await tree(root), before);
    }
    const applied = ok(await call('batch/apply', receipt(checked)));
    assert.equal(applied.publication, 'linux-directory-exchange'); assert.equal(applied.results.length, operations.length);
    let entity = ok(await call('entry/get', { id: 'packed.dependent' })).entity;
    assert.deepEqual(entity.value.tags, tags);
    const { tags: omitted, ...value } = entity.value; assert.deepEqual(omitted, tags);
    const oldRevision = entity.revision;
    ok(await call('entry/update', { id: entity.id, expectedRevision: entity.revision, value: { ...value, title: 'preserved' } }));
    entity = ok(await call('entry/get', { id: entity.id })).entity; assert.deepEqual(entity.value.tags, tags);
    const committed = await tree(root);
    assert.equal((await call('entry/update', { id: entity.id, expectedRevision: oldRevision, value })).ok, false);
    assert.deepEqual(await tree(root), committed);
    assert.equal((await call('batch/apply', receipt(checked))).error.code, 'batch.workspace-conflict');
    assert.deepEqual(await tree(root), committed);
    ok(await call('entry/update', { id: entity.id, expectedRevision: entity.revision, value: { ...entity.value, tags: [] } }));
    assert.deepEqual(ok(await call('entry/get', { id: entity.id })).entity.value.tags, []);
    assert.equal(ok(await call('validate', { scope: 'workspace' })).valid, true);
    assert.deepEqual(await readdir(root), ['.SNL_Doc']);
    assert.ok(!(await readdir(path.join(root, '.SNL_Doc'))).includes('.data-write.lock'));
    evidence.push({ adapter, ok: true, publication: applied.publication, cases: ['special-modes-check-reject','special-only-stale-apply-reject','empty-batch-full-mode-preservation','discovery','dependent-create','read-only-check','digest-tamper','stale-revision','replay','Library-reject','duplicate-reject','invalid-tags','tag-preservation-and-clear','old-entity-revision','no-residue','validation'] });
  } finally { await rm(root, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ packageRoot, evidence }, null, 2));
