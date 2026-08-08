import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { querySnoogl, rankSnooglCandidates } from '../lib/snoogle-query.ts';
import { entryEntityPath, macroEntityPath, makeEntityStorageReceipt, packageManifestPath } from '../lib/entity-storage.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snoogle-query-'));
  roots.push(root);
  const doc = path.join(root, '.SNL_Doc');
  await Promise.all(['entries', 'macros', 'packages', 'term_macros'].map((dir) => fs.mkdir(path.join(doc, dir), { recursive: true })));
  const legacyEntries: unknown[] = [];
  const legacyPackages = new Map<string, unknown>();
  await fs.writeFile(path.join(doc, 'entries.json'), JSON.stringify(legacyEntries) + '\n');
  await fs.writeFile(path.join(doc, packageManifestPath('_unpackaged')), JSON.stringify({ format: 'snl-package', version: 1, id: '_unpackaged', name: 'Unpackaged', description: '' }, null, 2) + '\n');
  await fs.writeFile(path.join(doc, packageManifestPath('logic')), JSON.stringify({ format: 'snl-package', version: 1, id: 'logic', name: 'Logic', description: '' }, null, 2) + '\n');
  for (const entry of [
    { id: 'Type.to', package: '_unpackaged', kind: 'definition', title: 'conversion', content: { snl: 'Type.to' }, contribution_info: null, pointer: null },
    { id: 'Type.toFun', package: '_unpackaged', kind: 'theorem', title: 'function conversion', content: { snl: 'Type.toFun' }, contribution_info: null, pointer: null },
    { id: 'Other.quant', package: '_unpackaged', kind: 'definition', title: 'universal quantifier', content: { snl: 'Logic.forall' }, contribution_info: null, pointer: null },
  ]) {
    await fs.writeFile(path.join(doc, entryEntityPath(entry.package, entry.id)), JSON.stringify({ format: 'snl-entry', version: 1, package: entry.package, entry }, null, 2) + '\n');
  }
  for (const macro of [
    { name: 'Logic.forall', kind: 'binder', description: '', source: { entries: [], urls: [] }, dynamic_arity: false, default_style: { en: 'default' }, tags: ['quantifier'], styles: [{ style_name: 'default', mode: 'formula_inline', template: '#0', tags: [] }] },
    { name: 'Logic.forallLike', kind: 'binder', description: '', source: { entries: [], urls: [] }, dynamic_arity: false, default_style: { en: 'default' }, tags: [], styles: [{ style_name: 'default', mode: 'formula_inline', template: '#0', tags: [] }] },
  ]) {
    await fs.writeFile(path.join(doc, macroEntityPath('logic', macro.name)), JSON.stringify({ format: 'snl-macro', version: 1, package: 'logic', macro }, null, 2) + '\n');
  }
  await fs.writeFile(path.join(doc, 'config.json'), JSON.stringify({
    version: '0.0.6', active_macro_packages: ['logic'],
    entity_storage: { version: 1, legacy_backup_version: '0.0.5', entry_default_package: '_unpackaged', receipt: makeEntityStorageReceipt(legacyEntries, legacyPackages, true) },
  }, null, 2) + '\n');
  return root;
}

describe('SNoogL query core', () => {
  it('uses SNoogL namespace exactness and AND-token semantics', () => {
    const candidates = [
      { id: 'Type.toFun', labels: ['conversion'] },
      { id: 'Type.to', labels: ['conversion'] },
      { id: 'Other.to', labels: [] },
    ];
    assert.deepEqual(rankSnooglCandidates('Type.to', candidates).slice(0, 2).map((item) => item.id), ['Type.to', 'Type.toFun']);
    assert.deepEqual(rankSnooglCandidates('Type missing', candidates), []);
  });

  it('queries the live 0.0.6 Entry catalog without filters and returns stable DTOs', async () => {
    const root = await fixture();
    const response = await querySnoogl(root, 'entry', 'Type.to');
    assert.equal(response.schemaVersion, 1);
    assert.equal(response.mode, 'entry');
    assert.deepEqual(response.results.slice(0, 2).map((hit) => hit.id), ['Type.to', 'Type.toFun']);
    assert.deepEqual(Object.keys(response.results[0]).sort(), ['entryKind', 'id', 'kind', 'score', 'title']);
    const titleResults = (await querySnoogl(root, 'entry', 'universal quantifier')).results;
    assert.equal(titleResults[0]?.id, 'Other.quant');
  });

  it('queries active Macros by tail, namespace, and tags', async () => {
    const root = await fixture();
    const tagged = await querySnoogl(root, 'macro', 'quantifier forall');
    assert.deepEqual(tagged.results.map((hit) => hit.id), ['Logic.forall']);
    const partial = await querySnoogl(root, 'macro', 'Logic.forall');
    assert.deepEqual(partial.results.map((hit) => hit.id), ['Logic.forall', 'Logic.forallLike']);
  });
});

describe('public query and Style rename CLIs', () => {
  it('requires exactly one SNoogL mode and exposes no filter flags', () => {
    const both = spawnSync(process.execPath, ['bin/snoogle.mjs', '--macro', 'x', '--entry', 'y'], { cwd: path.resolve('.'), encoding: 'utf8' });
    assert.equal(both.status, 2);
    assert.match(both.stderr, /exactly one|mutually exclusive/i);
    const filter = spawnSync(process.execPath, ['bin/snoogle.mjs', '--entry', 'x', '--kind', 'definition'], { cwd: path.resolve('.'), encoding: 'utf8' });
    assert.equal(filter.status, 2);
    assert.match(filter.stderr, /Unknown flag:\s*--kind/i);
  });

  it('publishes accurate help for SNoogL and scoped Style rename', () => {
    const commands = [
      ['bin/snoogle.mjs', '--macro <query>'],
      ['bin/snl-rename-style.mjs', '--package <id> --macro <id>'],
    ] as const;
    for (const [file, expected] of commands) {
      const result = spawnSync(process.execPath, [file, '--help'], { cwd: path.resolve('.'), encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.includes(expected), result.stdout);
    }
  });
});
