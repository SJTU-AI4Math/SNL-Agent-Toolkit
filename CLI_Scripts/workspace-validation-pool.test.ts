import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, it } from 'node:test';
import { validateManagedWorkspace } from '../lib/entity-crud.ts';
import { entryEntityPath, packageManifestPath } from '../lib/entity-storage.ts';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))));
async function writeJson(file: string, value: unknown) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'snl-validation-pool-'));
  roots.push(root);
  const doc = path.join(root, '.SNL_Doc');
  await fs.cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), doc, { recursive: true });
  await writeJson(path.join(doc, 'relationships.json'), { version: 1, relationships: [
    { id: 'valid', from: 'entry.localized', to: 'entry.localized', label: 'uses_context' },
    { id: 'missing', from: 'missing.from', to: 'missing.to', label: 'uses_context' },
  ] });
  const library = path.join(doc, 'libraries/test');
  await fs.mkdir(library);
  await writeJson(path.join(library, 'meta.json'), {});
  await writeJson(path.join(library, 'counters.json'), { counters: [] });
  await writeJson(path.join(library, 'graph.json'), {
    nodes: [
      { id: 'valid', label: 'Entry', props: { entryId: 'entry.localized' } },
      { id: 'missing', label: 'Entry', props: { entryId: 'missing.entry' } },
    ],
    relationships: [{ from: 'ghost', to: 'valid', label: 'branch' }],
  });
  return root;
}
const dependentCodes = ['relationship.dangling-from', 'relationship.dangling-to', 'graph.node.entry-not-in-pool'];

it('public validate reports an unavailable Entry pool without fabricated dangling references', async () => {
  const root = await fixture();
  const file = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized'));
  await fs.writeFile(file, '{broken JSON');
  const operation = await executeOperation({ protocol: OPERATION_PROTOCOL, command: 'validate', root, arguments: { scope: 'workspace' } });
  assert.equal(operation.exitCode, 1);
  assert.equal(operation.response.ok, false);
  if (operation.response.ok) assert.fail('Expected invalid validation');
  assert.equal(operation.response.error.code, 'workspace.invalid');
  const report = operation.response.error.details as Awaited<ReturnType<typeof validateManagedWorkspace>>;
  assert.equal(report.valid, false);
  const rootErrors = report.issues.filter(issue => issue.code === 'entry.read-failed');
  assert.equal(rootErrors.length, 1);
  assert.match(rootErrors[0].message, /Invalid JSON/);
  assert.match(rootErrors[0].message, /entries/);
  assert.deepEqual(report.issues.filter(issue => dependentCodes.includes(issue.code)), []);
  assert.ok(report.issues.some(issue => issue.code === 'graph.rel.dangling-from'), 'Independent graph integrity checks must still run');
});

it('validation still reports real dangling references when the Entry pool is readable', async () => {
  const root = await fixture();
  const report = await validateManagedWorkspace(root);
  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.code === 'entry.read-failed'), false);
  assert.deepEqual(report.issues.filter(issue => dependentCodes.includes(issue.code)).map(issue => [issue.code, issue.path]), [
    ['relationship.dangling-from', 'relationship:missing.from'],
    ['relationship.dangling-to', 'relationship:missing.to'],
    ['graph.node.entry-not-in-pool', 'library:test/graph.json#nodes (id=missing).props.entryId'],
  ]);
});

it('a readable empty Entry pool is not treated as unavailable', async () => {
  const root = await fixture();
  const doc = path.join(root, '.SNL_Doc');
  await fs.rm(path.join(doc, entryEntityPath('_unpackaged', 'entry.localized')));
  await fs.writeFile(path.join(doc, 'entries/.gitkeep'), '');
  const file = path.join(doc, packageManifestPath('_unpackaged'));
  const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  manifest.entry_ids = [];
  await writeJson(file, manifest);
  const report = await validateManagedWorkspace(root);
  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.code === 'entry.read-failed'), false);
  assert.equal(report.issues.filter(issue => dependentCodes.includes(issue.code)).length, 6);
});
