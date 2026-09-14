import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, test } from 'node:test';
import { apply as sourceDsh } from '../plugin-src/dsh-adapter.ts';

const repo = path.resolve(import.meta.dirname, '..');
const roots: string[] = [];
const tags = ['', ' ', 'Alpha', 'alpha', '__proto__', 'constructor', 'a,b;#\\/[]', '中文', 'Alpha'];
const draft = { id: 'entry.adapter-tags', package: 'Logic', kind: 'definition', title: 'Tags', content: {}, contribution_info: null, pointer: null };
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-tags-adapters-'));
  roots.push(root);
  await cp(path.join(repo, 'CLI_Scripts/fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  return root;
}
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

for (const mode of ['source', 'bundle']) {
  test(`DSH ${mode} real adapter preserves exact tags, CAS, omission and clear; invalid writes leave no residue`, async () => {
    const root = await fixture();
    const apply = mode === 'source' ? sourceDsh : (await import(pathToFileURL(path.join(repo, 'dist/dsh/adapter.mjs')).href)).apply;
    const tools: Array<Record<string, any>> = [];
    await apply({ tools: { register(tool: Record<string, any>) { tools.push(tool); } } });
    async function call(name: string, args: Record<string, unknown>) {
      const tool = tools.find(item => item.name === name);
      assert.ok(tool);
      return tool.execute({ root, ...args }, { signal: new AbortController().signal });
    }
    let result = await call('snl_entity_apply', { entityType: 'entry', action: 'create', value: { ...draft, tags } });
    assert.equal(result.status, 'ok');
    let entity = (await call('snl_entity_get', { entityType: 'entry', id: draft.id })).entity;
    assert.deepEqual(entity.value.tags, tags);
    const oldRevision = entity.revision;
    const { tags: omitted, ...value } = entity.value;
    assert.deepEqual(omitted, tags);
    result = await call('snl_execute', { command: 'entry/update', arguments: { id: draft.id, expectedRevision: entity.revision, value: { ...value, title: 'Via DSH' } } });
    assert.equal(result.ok, true);
    entity = result.data.entity;
    assert.deepEqual(entity.value.tags, tags);
    const before = await tree(root);
    result = await call('snl_entity_apply', { entityType: 'entry', action: 'update', id: draft.id, expectedRevision: oldRevision, value: { ...entity.value, tags: [] } });
    assert.equal(result.status, 'conflict');
    assert.deepEqual(await tree(root), before);
    for (const invalid of [null, 'text', {}, ['ok', null]]) {
      result = await call('snl_entity_apply', { entityType: 'entry', action: 'update', id: draft.id, expectedRevision: entity.revision, value: { ...entity.value, tags: invalid } });
      assert.equal(result.status, 'invalid');
      assert.deepEqual(await tree(root), before);
      result = await call('snl_execute', { command: 'entry/create', arguments: { value: { ...draft, id: 'entry.invalid', tags: invalid } } });
      assert.equal(result.ok, false);
      assert.deepEqual(await tree(root), before);
    }
    result = await call('snl_entity_apply', { entityType: 'entry', action: 'update', id: draft.id, expectedRevision: entity.revision, value: { ...entity.value, tags: [] } });
    assert.equal(result.status, 'ok');
    assert.deepEqual((await call('snl_entity_get', { entityType: 'entry', id: draft.id })).entity.value.tags, []);
    assert.equal((await call('snl_workspace_validate', {})).valid, true);
  });
}

test('legacy snl-entity bundled CLI preserves tags on omitted update and clears only explicit []', async () => {
  const root = await fixture();
  const input = path.join(root, 'input.json');
  async function cli(args: string[], value?: unknown) {
    if (value !== undefined) await writeFile(input, JSON.stringify(value));
    const call = spawnSync(process.execPath, [path.join(repo, 'dist/cli/snl-entity.mjs'), '--root', root, '--type', 'entry', '--json', ...args,
      ...(value === undefined ? [] : ['--input', input])], { encoding: 'utf8', timeout: 15000 });
    assert.equal(call.stderr, '');
    return { code: call.status, body: JSON.parse(call.stdout) };
  }
  let result = await cli(['create'], { ...draft, tags });
  assert.equal(result.code, 0);
  let entity = result.body.entity;
  assert.deepEqual(entity.value.tags, tags);
  const { tags: omitted, ...value } = entity.value;
  assert.deepEqual(omitted, tags);
  result = await cli(['update', entity.id, '--if-match', entity.revision], { ...value, title: 'Legacy CLI' });
  assert.equal(result.code, 0);
  entity = result.body.entity;
  assert.deepEqual(entity.value.tags, tags);
  const before = await tree(root);
  result = await cli(['update', entity.id, '--if-match', entity.revision], { ...entity.value, tags: null });
  assert.equal(result.code, 1);
  assert.equal(result.body.status, 'invalid');
  assert.deepEqual(await tree(root), before);
  result = await cli(['update', entity.id, '--if-match', entity.revision], { ...entity.value, tags: [] });
  assert.equal(result.code, 0);
  assert.deepEqual((await cli(['get', entity.id])).body.entity.value.tags, []);
});
