import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
import { createManagedEntity, getManagedEntity, updateManagedEntity, validateManagedWorkspace } from '../lib/entity-crud.ts';
import { createWorkspaceReader, type WorkspaceReaderModel } from '../src/web/workspace.ts';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snl-web-workspace-')); roots.push(root);
  const init = await executeOperation({ protocol: OPERATION_PROTOCOL, root, command: 'init', arguments: {} });
  assert.equal(init.response.ok, true, JSON.stringify(init.response));
  for (const id of ['Root', 'Elsewhere']) {
    const result = await createManagedEntity(root, 'entry', { id, kind: 'entry', title: id, content: { markdown: `![image](image.svg) ![missing](missing.png)` }, pointer: null, contribution_info: null });
    assert.equal(result.status, 'ok', JSON.stringify(result));
  }
  const library = await createManagedEntity(root, 'library', { slug: 'book', meta: { title: 'Book' }, graph: { nodes: [{ id: 'n', label: 'Entry', props: { entryId: 'Root' } }], relationships: [] }, counters: { counters: [] } });
  assert.equal(library.status, 'ok', JSON.stringify(library));
  const relation = await createManagedEntity(root, 'relationship', { id: 'related', from: 'Root', to: 'Elsewhere', label: 'uses', metadata: null });
  assert.equal(relation.status, 'ok', JSON.stringify(relation));
  const validation = await validateManagedWorkspace(root);
  assert.equal(validation.valid, true, JSON.stringify(validation.issues));
  await mkdir(path.join(root, '.SNL_Doc/assets'), { recursive: true });
  await writeFile(path.join(root, '.SNL_Doc/assets/image.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return root;
}
async function bytes(root: string, prefix = ''): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const file = path.join(prefix, item.name);
    if (item.isDirectory()) Object.assign(result, await bytes(root, file));
    else if (item.isFile()) result[file] = (await readFile(path.join(root, file))).toString('base64');
  }
  return result;
}
// Thin test double for host/IO tests, not evidence of real renderer correctness.
const model: WorkspaceReaderModel = {
  buildWorkspaceReaderSnapshot(input) {
    return { version: 1, renderSnapshotId: 'test', library: { slug: input.library.slug, title: input.library.metadata?.title ?? '', outline: [], warnings: [] },
      entries: input.entries, entryKinds: input.entryKinds, entryPackages: {}, macros: input.macros, macroKinds: input.macroKinds, relationships: input.relationships,
      preferences: { language: 'en', color_scheme: 'light', motion: 'full' }, contentLanguage: 'en', languages: [], resources: {} };
  },
  readerAssetPaths() { return ['image.svg', 'missing.png']; },
};

test('loads an official workspace read-only and refreshes the complete raw data', async () => {
  const root = await fixture();
  const before = await bytes(root); const cwd = process.cwd();
  const reader = await createWorkspaceReader(root, model);
  assert.deepEqual(await reader.getWorkspace(), { id: 'local', name: path.basename(root), root: await realpath(root), libraries: [{ slug: 'book', title: 'Book', entryCount: 1, relationshipCount: 0 }], capabilities: { edit: false } });
  const snapshot = await reader.getSnapshot('book');
  assert.deepEqual(snapshot.entries.map(e => e.id).sort(), ['Elsewhere', 'Root']);
  assert.equal(snapshot.relationships.length, 1);
  assert.ok(Object.keys(snapshot.macros).length > 0, 'official BasicMacros are loaded');
  assert.match(snapshot.resources['image.svg'].url, /^data:image\/svg\+xml;base64,/);
  assert.match(snapshot.resources['image.svg'].revision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(snapshot.resources['image.svg'].text, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.ok(snapshot.library.warnings.some(w => w.includes('missing.png')));
  assert.equal(Object.hasOwn(snapshot.resources, 'missing.png'), false);
  assert.deepEqual(await bytes(root), before);
  assert.equal(process.cwd(), cwd);
  const entity = await getManagedEntity(root, 'entry', 'Elsewhere'); assert.ok(entity);
  const changed = await updateManagedEntity(root, 'entry', 'Elsewhere', { ...entity.value, title: 'Fresh title' }, entity.revision);
  assert.equal(changed.status, 'ok', JSON.stringify(changed));
  assert.equal((await reader.getSnapshot('book')).entries.find(e => e.id === 'Elsewhere')?.title, 'Fresh title');
});

test('Library table statistics track graph occurrences and refresh without building snapshots', async () => {
  const root = await fixture();
  const reader = await createWorkspaceReader(root, { ...model, buildWorkspaceReaderSnapshot() { throw new Error('catalog must not build snapshots'); } });
  const entity = await getManagedEntity(root, 'library', 'book'); assert.ok(entity);
  const changed = await updateManagedEntity(root, 'library', 'book', { ...entity.value, graph: {
    nodes: [
      { id: 'one', label: 'Entry', props: { entryId: 'Root' } },
      { id: 'two', label: 'Entry', props: { entryId: 'Root' } },
      { id: 'placeholder', label: 'Entry', props: {} },
    ], relationships: [{ from: 'one', to: 'two', label: 'branch' }, { from: 'two', to: 'placeholder', label: 'branch' }],
  } }, entity.revision);
  assert.equal(changed.status, 'ok', JSON.stringify(changed));
  assert.deepEqual((await reader.getWorkspace()).libraries, [{ slug: 'book', title: 'Book', entryCount: 3, relationshipCount: 2 }]);
  const updated = await getManagedEntity(root, 'library', 'book'); assert.ok(updated);
  assert.equal((await updateManagedEntity(root, 'library', 'book', { ...updated.value, graph: { nodes: [], relationships: [] } }, updated.revision)).status, 'ok');
  assert.deepEqual((await reader.getWorkspace()).libraries, [{ slug: 'book', title: 'Book', entryCount: 0, relationshipCount: 0 }]);
});

test('rejects invalid roots and Library slugs without exposing repository paths', async () => {
  const root = await fixture();
  const reader = await createWorkspaceReader(root, model);
  for (const slug of ['', '.', '..', '../book', '/book', 'book/../../', 'book\\\\child', '%2e%2e', 'book%2fchild', ' book', 'book\u0000']) {
    await assert.rejects(() => reader.getSnapshot(slug), /Invalid Library slug/);
  }
  await assert.rejects(() => reader.getSnapshot('unknown'), /Library not found/);
  await assert.rejects(() => createWorkspaceReader(path.join(root, 'missing'), model));
  await assert.rejects(() => createWorkspaceReader(path.join(root, '.SNL_Doc/config.json'), model), /directory/);
  const empty = await mkdtemp(path.join(os.tmpdir(), 'snl-web-empty-')); roots.push(empty);
  await assert.rejects(() => createWorkspaceReader(empty, model), /No .SNL_Doc/);
  await mkdir(path.join(empty, '.SNL_Doc'));
  await assert.rejects(() => createWorkspaceReader(empty, model), /Invalid .SNL_Doc workspace/);
  await rm(path.join(empty, '.SNL_Doc'), { recursive: true });
  await symlink(path.join(root, '.SNL_Doc'), path.join(empty, '.SNL_Doc'));
  await assert.rejects(() => createWorkspaceReader(empty, model), /non-symlink/);
});

test('only serves referenced assets, never traversal, repository files, or symlink escapes', async () => {
  const root = await fixture();
  const assetDir = path.join(root, '.SNL_Doc/assets');
  await writeFile(path.join(root, 'private.svg'), 'repository secret');
  await symlink(path.join(root, 'private.svg'), path.join(assetDir, 'link.svg'));
  await symlink(root, path.join(assetDir, 'linked'));
  await writeFile(path.join(assetDir, 'unreferenced.svg'), 'unreferenced secret');
  await writeFile(path.join(assetDir, '__proto__'), 'own-key asset');
  const forbidden = ['../private.svg', '../../private.svg', '/etc/passwd', '%2e%2e/private.svg', 'linked/private.svg', 'link.svg', 'file:///etc/passwd', 'image.svg/child'];
  const reader = await createWorkspaceReader(root, { ...model, readerAssetPaths: () => ['image.svg', '__proto__', ...forbidden] });
  const snapshot = await reader.getSnapshot('book');
  assert.deepEqual(Object.keys(snapshot.resources).sort(), ['__proto__', 'image.svg']);
  assert.equal(Object.hasOwn(snapshot.resources, '__proto__'), true);
  assert.match(snapshot.resources.__proto__.url, /^data:application\/octet-stream;base64,/);
  assert.equal(snapshot.library.warnings.length, forbidden.length);
  assert.equal(JSON.stringify(snapshot).includes('repository secret'), false);
  const revision = snapshot.renderSnapshotId;
  await writeFile(path.join(assetDir, 'image.svg'), '<svg>changed</svg>');
  assert.notEqual((await reader.getSnapshot('book')).renderSnapshotId, revision);
  await rm(assetDir, { recursive: true });
  await symlink(root, assetDir);
  assert.deepEqual(Object.keys((await reader.getSnapshot('book')).resources), []);
});

test('canonicalizes an admitted root alias and isolates multiple workspaces', async () => {
  const first = await fixture(); const second = await fixture();
  const current = await getManagedEntity(second, 'entry', 'Root'); assert.ok(current);
  const update = await updateManagedEntity(second, 'entry', 'Root', { ...current.value, title: 'Second workspace' }, current.revision);
  assert.equal(update.status, 'ok');
  const alias = first + '-alias'; roots.push(alias); await symlink(first, alias);
  const a = await createWorkspaceReader(alias, model); const b = await createWorkspaceReader(second, model);
  assert.equal((await a.getWorkspace()).root, await realpath(first));
  assert.equal((await a.getSnapshot('book')).entries.find(e => e.id === 'Root')?.title, 'Root');
  assert.equal((await b.getSnapshot('book')).entries.find(e => e.id === 'Root')?.title, 'Second workspace');
});

test('real Node ESM Reader model integrates with official init/CRUD fixture', { skip: !process.env.SNL_READER_MODEL_PATH }, async () => {
  const root = await fixture();
  const reader = await createWorkspaceReader(root, process.env.SNL_READER_MODEL_PATH!);
  const snapshot = await reader.getSnapshot('book');
  assert.equal(snapshot.library.outline[0].entry?.id, 'Root');
  assert.equal(snapshot.entries.length, 2);
  assert.equal(snapshot.relationships[0].to, 'Elsewhere');
  assert.match(snapshot.resources['image.svg'].url, /^data:image\/svg\+xml;base64,/);
});
