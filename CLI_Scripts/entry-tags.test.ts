import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { createManagedEntity, getManagedEntity, updateManagedEntity, validateManagedWorkspace } from '../lib/entity-crud.ts';
import { entryEntityPath } from '../lib/entity-storage.ts';
import { lintEntry } from '../lib/lint-entry.ts';
import { readEntries, readEntryKinds } from '../lib/snl-doc.ts';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
import { createEntityAdapter } from '../plugin-src/entity-adapter.ts';
import { createToolkitTools } from '../plugin-src/toolkit-tools.ts';

const roots: string[] = [];
const tags = ['', ' ', 'Alpha', 'alpha', 'a,b;#\\/[]', '__proto__', 'constructor', '中文', 'Alpha'];
const draft = { id: 'entry.tags', package: 'Logic', kind: 'definition', title: 'Tags', content: {}, contribution_info: null, pointer: null };
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-entry-tags-'));
  roots.push(root);
  await cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  return root;
}
// Compare every directory and file byte, including lock/staging residue.
async function tree(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(relative: string) {
    for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.join(relative, item.name);
      if (item.isDirectory()) { result[name] = 'directory'; await visit(name); }
      else { assert.ok(item.isFile()); result[name] = (await readFile(path.join(root, name))).toString('base64'); }
    }
  }
  await visit('.SNL_Doc');
  return result;
}
async function current(root: string, id = draft.id) {
  const value = await getManagedEntity(root, 'entry', id);
  assert.ok(value);
  return value;
}

test('Entry tags lint accepts exact string arrays and rejects every present malformed value', async () => {
  const root = await fixture();
  const ctx = { entryKinds: await readEntryKinds(root), macros: {}, siblingEntries: [] };
  for (const value of [draft, { ...draft, tags: [] }, { ...draft, tags }]) {
    assert.equal(lintEntry(value, ctx).issues.filter(issue => issue.severity === 'error').length, 0);
  }
  for (const invalid of [null, 'a', 1, false, {}, ['a', 1], [null], undefined]) {
    const issues = lintEntry({ ...draft, tags: invalid }, ctx).issues;
    assert.ok(issues.some(issue => issue.code === 'entry.bad-tags' && issue.path === 'tags'), JSON.stringify(invalid));
  }
});

test('real CRUD preserves tags on omitted update, move, copy-by-create and rename; explicit [] clears', async () => {
  const root = await fixture();
  const untouched = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized'));
  const original = await readFile(untouched, 'utf8');
  assert.equal((await createManagedEntity(root, 'entry', { ...draft, tags })).status, 'ok');
  let entity = await current(root);
  assert.deepEqual(entity.value.tags, tags);
  const { tags: omitted, ...value } = entity.value;
  assert.deepEqual(omitted, tags);
  const update = { ...value, title: 'Unrelated title edit' };
  assert.equal((await updateManagedEntity(root, 'entry', entity.id, update, entity.revision)).status, 'ok');
  assert.equal(Object.hasOwn(update, 'tags'), false, 'must not mutate caller input');
  entity = await current(root);
  assert.deepEqual(entity.value.tags, tags);
  assert.equal((await updateManagedEntity(root, 'entry', entity.id, { ...entity.value, package: '_unpackaged' }, entity.revision)).status, 'ok');
  entity = await current(root);
  assert.deepEqual(entity.value.tags, tags);
  assert.equal((await createManagedEntity(root, 'entry', { ...entity.value, id: 'entry.tags.copy' })).status, 'ok');
  assert.deepEqual((await current(root, 'entry.tags.copy')).value.tags, tags);
  const renamed = await executeOperation({ protocol: OPERATION_PROTOCOL, root, command: 'entry/rename', arguments: { id: entity.id, to: 'entry.tags.renamed', expectedRevision: entity.revision } });
  assert.equal(renamed.exitCode, 0, JSON.stringify(renamed.response));
  entity = await current(root, 'entry.tags.renamed');
  assert.deepEqual(entity.value.tags, tags);
  assert.equal((await updateManagedEntity(root, 'entry', entity.id, { ...entity.value, tags: [] }, entity.revision)).status, 'ok');
  assert.deepEqual((await current(root, entity.id)).value.tags, []);
  assert.equal(await readFile(untouched, 'utf8'), original, 'old absent-tag Entry remains byte-identical');
  const envelope = JSON.parse(await readFile(path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', entity.id)), 'utf8'));
  assert.equal(envelope.version, 1);
  assert.equal(envelope.schema_version, 1);
  assert.equal((await validateManagedWorkspace(root)).valid, true);
});

test('malformed create and update reject before any persisted byte/path changes', async () => {
  const root = await fixture();
  assert.equal((await createManagedEntity(root, 'entry', { ...draft, tags })).status, 'ok');
  const entity = await current(root);
  for (const invalid of [null, 'a', 2, false, {}, ['a', 1], [null], undefined]) {
    const before = await tree(root);
    const created = await createManagedEntity(root, 'entry', { ...draft, id: 'entry.bad', tags: invalid });
    assert.equal(created.status, 'invalid', JSON.stringify(invalid));
    assert.deepEqual(await tree(root), before);
    let writes = 0;
    const updated = await updateManagedEntity(root, 'entry', entity.id, { ...entity.value, tags: invalid }, entity.revision, { beforeEntityInstall: () => { writes += 1; } });
    assert.equal(updated.status, 'invalid', JSON.stringify(invalid));
    assert.equal(writes, 0);
    assert.deepEqual(await tree(root), before);
  }
});

test('strict current reader and workspace validator reject malformed stored tags without writes', async () => {
  for (const invalid of [null, 'a', {}, ['a', false]]) {
    const root = await fixture();
    const file = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized'));
    const envelope = JSON.parse(await readFile(file, 'utf8'));
    envelope.entry.tags = invalid;
    await writeFile(file, `${JSON.stringify(envelope, null, 2)}\n`);
    const before = await tree(root);
    await assert.rejects(readEntries(root), /tags/);
    await assert.rejects(getManagedEntity(root, 'entry', 'entry.localized'), /tags/);
    assert.equal((await validateManagedWorkspace(root)).valid, false);
    assert.deepEqual(await tree(root), before);
  }
});

test('absent tags remain absent on ordinary saves and read-only validation never rewrites old records', async () => {
  const root = await fixture();
  const before = await tree(root);
  const entity = await current(root, 'entry.localized');
  assert.equal(Object.hasOwn(entity.value, 'tags'), false);
  assert.equal((await validateManagedWorkspace(root)).valid, true);
  assert.deepEqual(await tree(root), before);
  assert.equal((await updateManagedEntity(root, 'entry', entity.id, { ...entity.value, title: 'Still untagged' }, entity.revision)).status, 'ok');
  assert.equal(Object.hasOwn((await current(root, entity.id)).value, 'tags'), false);
});

test('shipped unified CLI and both MCP bundles preserve tags and reject malformed updates', async () => {
  const root = await fixture();
  const repo = path.resolve(import.meta.dirname, '..');
  function cli(args: string[], input?: unknown) {
    const call = spawnSync(process.execPath, ['dist/cli/snl.mjs', '--root', root, '--json', ...args], {
      cwd: repo, encoding: 'utf8', input: input === undefined ? undefined : JSON.stringify(input), timeout: 15000,
    });
    assert.equal(call.stderr, '');
    return { status: call.status, body: JSON.parse(call.stdout) };
  }
  let call = cli(['entry', 'create', '--input', '-'], { ...draft, tags });
  assert.equal(call.status, 0, JSON.stringify(call.body));
  let entity = call.body.data.entity;
  assert.deepEqual(entity.value.tags, tags);
  const { tags: omitted, ...value } = entity.value;
  assert.deepEqual(omitted, tags);
  call = cli(['entry', 'update', entity.id, '--if-match', entity.revision, '--input', '-'], { ...value, title: 'Bundled CLI' });
  assert.equal(call.status, 0, JSON.stringify(call.body));
  entity = call.body.data.entity;
  assert.deepEqual(entity.value.tags, tags);
  for (const bundle of ['dist/mcp/server.cjs', 'agent-plugin/dist/mcp/server.cjs']) {
    const before = await tree(root);
    const requests = [
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'snl_entity_get', arguments: { root, entityType: 'entry', id: entity.id } } },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'snl_entity_apply', arguments: { root, entityType: 'entry', action: 'update', id: entity.id, expectedRevision: entity.revision, value: { ...entity.value, tags: null } } } },
    ];
    const result = spawnSync(process.execPath, [bundle], { cwd: repo, encoding: 'utf8', input: requests.map(request => JSON.stringify(request)).join('\n') + '\n', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    const responses = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(responses[0].result.structuredContent.entity.value.tags, tags);
    assert.equal(responses[1].result.structuredContent.status, 'invalid');
    assert.deepEqual(await tree(root), before);
  }
  const before = await tree(root);
  call = cli(['entry', 'update', entity.id, '--if-match', entity.revision, '--input', '-'], { ...entity.value, tags: ['ok', null] });
  assert.equal(call.status, 1);
  assert.deepEqual(await tree(root), before);
  call = cli(['entry', 'update', entity.id, '--if-match', entity.revision, '--input', '-'], { ...entity.value, tags: [] });
  assert.equal(call.status, 0);
  assert.deepEqual(cli(['entry', 'get', entity.id]).body.data.entity.value.tags, []);
});

test('MCP generic entity schema/adapter and operation path preserve and validate canonical Entry tags', async () => {
  const root = await fixture();
  const tools = createToolkitTools(createEntityAdapter());
  const apply = tools.find(tool => tool.name === 'snl_entity_apply')!;
  const get = tools.find(tool => tool.name === 'snl_entity_get')!;
  const created = await apply.execute({ root, entityType: 'entry', action: 'create', value: { ...draft, tags } }) as { status: string };
  assert.equal(created.status, 'ok');
  const read = await get.execute({ root, entityType: 'entry', id: draft.id }) as { entity: { value: Record<string, unknown> } };
  assert.deepEqual(read.entity.value.tags, tags);
  let entity = await current(root);
  const { tags: omitted, ...value } = entity.value;
  assert.deepEqual(omitted, tags);
  const updated = await apply.execute({ root, entityType: 'entry', action: 'update', id: entity.id, expectedRevision: entity.revision, value: { ...value, title: 'Via MCP' } }) as { status: string };
  assert.equal(updated.status, 'ok');
  entity = await current(root);
  assert.deepEqual(entity.value.tags, tags);
  const before = await tree(root);
  const rejected = await apply.execute({ root, entityType: 'entry', action: 'update', id: entity.id, expectedRevision: entity.revision, value: { ...entity.value, tags: null } }) as { status: string };
  assert.equal(rejected.status, 'invalid');
  assert.deepEqual(await tree(root), before);
  const operation = await executeOperation({ protocol: OPERATION_PROTOCOL, root, command: 'entry/create', arguments: { value: { ...draft, id: 'entry.bad', tags: ['ok', null] } } });
  assert.equal(operation.exitCode, 1);
  assert.deepEqual(await tree(root), before);
});
