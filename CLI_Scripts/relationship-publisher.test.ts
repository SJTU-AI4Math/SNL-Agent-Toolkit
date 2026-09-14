import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, readdir, readFile, mkdir, writeFile, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
import { captureWorkspaceRevision } from '../lib/batch.ts';
const roots: string[] = [];
afterEach(async () => { mock.restoreAll(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-publisher-')); roots.push(root);
  await cp(new URL('./fixtures/workspace-v0.1.0/.SNL_Doc', import.meta.url), path.join(root, '.SNL_Doc'), { recursive: true }); return root;
}
const call = (root: string, args: Record<string, unknown>) => executeOperation({ protocol: OPERATION_PROTOCOL, root, command: 'relationship/generate', arguments: args });
function success(result: Awaited<ReturnType<typeof call>>) {
  assert.equal(result.exitCode, 0, JSON.stringify(result.response)); assert.ok(result.response.ok); return result.response.data as Record<string, any>;
}
async function bytes(root: string) {
  const rows: Record<string, string> = {};
  async function walk(dir: string) { for (const entry of await readdir(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) { rows[path.relative(root, file)] = 'directory'; await walk(file); } else rows[path.relative(root, file)] = (await readFile(file)).toString('base64'); } }
  await walk(root); return rows;
}
test('global dry-run is zero-write; apply persists only generated cache and preserves Authoring revision', async () => {
  const root = await fixture(); const before = await bytes(root); const revision = await captureWorkspaceRevision(root);
  const preview = success(await call(root, { scope: {}, dryRun: true }));
  assert.equal(preview.effectiveScope, 'global'); assert.equal(preview.expectedWorkspaceRevision, revision);
  assert.deepEqual(await bytes(root), before);
  const applied = success(await call(root, { scope: {}, expectedWorkspaceRevision: revision, dryRun: false }));
  assert.equal(applied.published, true); assert.equal(applied.resultingWorkspaceRevision, revision);
  const envelope = JSON.parse(await readFile(path.join(root, '.SNL_Doc/.cache/dependencies/result.json'), 'utf8'));
  assert.equal(envelope.format, 'snl-derived-cache'); assert.equal(envelope.schema, 1); assert.equal(envelope.library, null);
  assert.equal(envelope.generator, 'dependencies'); assert.equal(envelope.version, '1');
  assert.deepEqual(envelope.value, preview.generated); assert.equal(envelope.inputHash, preview.inputHash);
  const after = await bytes(root); for (const [key, value] of Object.entries(before)) assert.equal(after[key], value);
  assert.equal(await captureWorkspaceRevision(root), revision);
});

import { promises as fs } from 'node:fs';
import { generateRelationships } from '../lib/relationship-publisher.ts';
import { dependencyCacheDescriptor } from '../lib/dependency-cache-descriptor.ts';
import { cacheFingerprint, readCache } from '../lib/dependency-cache-storage.ts';
import { readEntries, readActiveMacros } from '../lib/snl-doc.ts';
import { listManagedEntities } from '../lib/entity-crud.ts';
import { spawnSync } from 'node:child_process';

import ts from 'typescript';
import { createHash } from 'node:crypto';
const oracleBase = new URL('./fixtures/relationship-oracle/', import.meta.url);
async function oracleModules() {
  const storage = await readFile(new URL('derivedCache.ts.txt', oracleBase), 'utf8');
  assert.equal(createHash('sha256').update(storage).digest('hex'), 'dba2c834ae9e08a25a38330697e8bd912a9aa9a9198d8f312331ed7b723acaad');
  const encode = (source: string) => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
  const storageUrl = encode(storage);
  const dependency = (await readFile(new URL('dependencyCache.ts.txt', oracleBase), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  const references = await readFile(new URL('snlReferences.ts.txt', oracleBase), 'utf8');
  return { storage: await import(storageUrl), dependency: await import(encode(`import { getOrGenerateCache } from ${JSON.stringify(storageUrl)};\n` + references + '\n' + dependency)) };
}
test('pinned current Extension native cache consumes nonempty output and rejects late stale input', async () => {
  const root = await fixture();
  const op = async (command: string, args: Record<string, unknown>) => success(await executeOperation({ protocol: OPERATION_PROTOCOL, root, command, arguments: args }));
  const entries = await listManagedEntities(root, 'entry'); const target = entries[0];
  const source = (await op('entry/create', { value: { ...target.value, id: 'publisher.source' } })).entity;
  const macro = (await listManagedEntities(root, 'macro'))[0];
  await op('macro/create', { value: { ...macro.value, name: 'PublisherWitness', source: { entries: [target.id], urls: [] } } });
  await op('entry/update', { id: source.id, expectedRevision: source.revision, value: { ...source.value, content: { snl: 'PublisherWitness' } } });
  await op('relationship/create', { value: { id: 'publisher.historical', from: source.id, to: target.id, label: 'depends', metadata: { generator: 'macro-source-scan', legacy: true } } });
  const before = await bytes(root);
  const preview = success(await call(root, { scope: {}, dryRun: true })); assert.ok(preview.generated.length > 0);
  success(await call(root, { scope: {}, expectedWorkspaceRevision: preview.expectedWorkspaceRevision }));
  const oracle = await oracleModules(); const desc = await descriptor(root);
  assert.equal(oracle.storage.cacheFingerprint(desc.input), preview.inputHash);
  assert.deepEqual(await oracle.storage.readCache(root, desc), preview.generated);
  const cacheBefore = await readFile(file(root), 'utf8');
  const snapshot = { entries: await readEntries(root), macros: await readActiveMacros(root), relationships: (await listManagedEntities(root, 'relationship')).map(r => r.value) };
  assert.deepEqual(await oracle.dependency.readDependencyCache(root, snapshot), preview.generated);
  assert.equal(await readFile(file(root), 'utf8'), cacheBefore);
  const after = await bytes(root); for (const [name, value] of Object.entries(before)) assert.equal(after[name], value);
  const current = await listManagedEntities(root, 'entry'); const changed = current.find(e => e.id === source.id)!;
  await op('entry/update', { id: changed.id, expectedRevision: changed.revision, value: { ...changed.value, content: { snl: '' } } });
  await childWrite(file(root), cacheBefore);
  assert.equal(await oracle.storage.readCache(root, await descriptor(root)), undefined);
});

const file = (root: string) => path.join(root, '.SNL_Doc/.cache/dependencies/result.json');
function failure(result: Awaited<ReturnType<typeof call>>, code: string, exit = 2) {
  assert.equal(result.exitCode, exit, JSON.stringify(result)); assert.ok(!result.response.ok); assert.equal(result.response.error.code, code);
}
async function descriptor(root: string) { return dependencyCacheDescriptor({ entries: await readEntries(root), macros: await readActiveMacros(root), relationships: (await listManagedEntities(root, 'relationship')).map(r => r.value as any) }); }
async function childWrite(target: string, text: string) {
  const result = spawnSync(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1],process.argv[2])', target, text], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
}
test('invalid arguments precede all config I/O, including explicit nulls and nonempty/unknown scopes', async () => {
  for (const args of [{}, { scope: null }, { scope: [] }, { scope: { entryIds: [] } }, { scope: {}, dryRun: null }, { scope: {}, dryRun: true, extra: 1 }, { scope: {}, dryRun: true, expectedWorkspaceRevision: null }, { scope: {}, dryRun: false }, { scope: {}, dryRun: 'true' }])
    failure(await call('/nonexistent/snl-publisher', args), 'operation.invalid-arguments');
  const root = await fixture(); const config = path.join(root, '.SNL_Doc/config.json');
  await writeFile(config, '{"version":"99.0.0"}');
  failure(await call(root, { scope: {}, dryRun: true }), 'workspace.unsupported-schema');
  await rm(config); failure(await call(root, { scope: {}, dryRun: true }), 'workspace.operation-failed');
  await writeFile(config, '{}'); await chmod(config, 0);
  try { failure(await call(root, { scope: {}, dryRun: true }), 'workspace.operation-failed'); } finally { await chmod(config, 0o600); }
});
test('future entity schema is unsupported rather than an empty or invalid pool', async () => {
  const root = await fixture(); const names = await readdir(path.join(root, '.SNL_Doc/entries'));
  const target = path.join(root, '.SNL_Doc/entries', names.find(n => n.endsWith('.json'))!);
  const value = JSON.parse(await readFile(target, 'utf8')); value.schema_version = 999; await writeFile(target, JSON.stringify(value));
  failure(await call(root, { scope: {}, dryRun: true }), 'workspace.unsupported-schema');
});
test('stale CAS rejects but cache-only churn preserves preview credentials; saved historical rows unchanged', async () => {
  const root = await fixture(); const preview = success(await call(root, { scope: {}, dryRun: true }));
  await mkdir(path.dirname(file(root)), { recursive: true }); await childWrite(file(root), 'external cache churn');
  success(await call(root, { scope: {}, expectedWorkspaceRevision: preview.expectedWorkspaceRevision }));
  await childWrite(path.join(root, '.SNL_Doc/author-note'), 'new authority');
  const before = await bytes(root);
  failure(await call(root, { scope: {}, expectedWorkspaceRevision: preview.expectedWorkspaceRevision }), 'relationship.workspace-conflict', 1);
  assert.deepEqual(await bytes(root), before);
});
test('strict publication rejects symlink paths and permissions; never succeeds from memory', async () => {
  for (const component of ['.cache', '.cache/dependencies', '.cache/dependencies/result.json']) {
    const root = await fixture(); const outside = path.join(root, 'outside'); await mkdir(outside);
    const target = path.join(root, '.SNL_Doc', component); await mkdir(path.dirname(target), { recursive: true }); await symlink(outside, target);
    const revision = await captureWorkspaceRevision(root);
    failure(await call(root, { scope: {}, expectedWorkspaceRevision: revision }), 'relationship.publication-failed');
    assert.deepEqual(await readdir(outside), []);
    assert.ok(!(await readdir(path.join(root, '.SNL_Doc'))).includes('.data-write.lock'));
  }
  const root = await fixture(); await mkdir(path.dirname(file(root)), { recursive: true });
  await chmod(path.dirname(file(root)), 0o500);
  try { failure(await call(root, { scope: {}, expectedWorkspaceRevision: await captureWorkspaceRevision(root) }), 'relationship.publication-failed'); }
  finally { await chmod(path.dirname(file(root)), 0o700); }
});
test('apply owns the existing shared lock and excludes other Toolkit publishers', async () => {
  const root = await fixture(); const revision = await captureWorkspaceRevision(root);
  await generateRelationships(root, false, revision, { beforePublish: async () => {
    failure(await call(root, { scope: {}, expectedWorkspaceRevision: revision }), 'workspace.locked');
    failure(await call(root, { scope: {}, dryRun: true }), 'workspace.locked');
  } });
  assert.ok(!(await readdir(path.join(root, '.SNL_Doc'))).includes('.data-write.lock'));
});
test('rename failure preserves other publisher result and cleans only owned temporary file', async () => {
  const root = await fixture(); await mkdir(path.dirname(file(root)), { recursive: true }); await childWrite(file(root), 'other publisher');
  mock.method(fs, 'rename', async () => { throw Object.assign(new Error('injected rename EACCES'), { code: 'EACCES' }); });
  failure(await call(root, { scope: {}, expectedWorkspaceRevision: await captureWorkspaceRevision(root) }), 'relationship.publication-failed');
  assert.equal(await readFile(file(root), 'utf8'), 'other publisher'); assert.deepEqual(await readdir(path.dirname(file(root))), ['result.json']);
});
test('separate-process author change before publication rejects old plan without overwriting cache', async () => {
  const root = await fixture(); const revision = await captureWorkspaceRevision(root);
  await assert.rejects(generateRelationships(root, false, revision, { beforePublish: async () => { await childWrite(path.join(root, '.SNL_Doc/author-note'), 'changed'); } }), (e: any) => e.code === 'relationship.workspace-conflict');
  await assert.rejects(readFile(file(root)), { code: 'ENOENT' });
});
test('input recheck occurs after temporary sync, not only before starting cache I/O', async () => {
  const root = await fixture(); const revision = await captureWorkspaceRevision(root); const originalOpen = fs.open;
  mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    const handle = await originalOpen(...args);
    if (String(args[0]).endsWith('.tmp')) { const sync = handle.sync.bind(handle); handle.sync = async () => { await sync(); await childWrite(path.join(root, '.SNL_Doc/author-note'), 'late change'); }; }
    return handle;
  });
  failure(await call(root, { scope: {}, expectedWorkspaceRevision: revision }), 'relationship.workspace-conflict', 1);
  await assert.rejects(readFile(file(root)), { code: 'ENOENT' });
});
test('late stale external publication never reads current; failed readback does not unlink another result', async () => {
  const root = await fixture(); success(await call(root, { scope: {}, expectedWorkspaceRevision: await captureWorkspaceRevision(root) }));
  const old = await readFile(file(root), 'utf8');
  const entry = (await listManagedEntities(root, 'entry'))[0];
  success(await executeOperation({ protocol: OPERATION_PROTOCOL, root, command: 'entry/update', arguments: { id: entry.id, value: { ...entry.value, content: { snl: 'changed' } }, expectedRevision: entry.revision } }));
  const current = await descriptor(root); assert.notEqual(cacheFingerprint(current.input), JSON.parse(old).inputHash);
  await assert.rejects(generateRelationships(root, false, await captureWorkspaceRevision(root), { afterPublish: async () => childWrite(file(root), old) }), (e: any) => e.code === 'relationship.readback-failed');
  assert.equal(await readCache(root, current), undefined); assert.equal(await readFile(file(root), 'utf8'), old);
});
