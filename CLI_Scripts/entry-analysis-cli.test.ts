import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, it } from 'node:test';
import { entryEntityPath, macroEntityPath, makeEntityStorageReceipt, packageManifestPath } from '../lib/entity-storage.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function json(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-entry-tools-'));
  roots.push(root);
  const doc = path.join(root, '.SNL_Doc');
  await Promise.all(['entries', 'macros', 'packages'].map((name) => mkdir(path.join(doc, name), { recursive: true })));
  await json(path.join(doc, 'config.json'), {
    version: '0.0.6', active_macro_packages: ['Logic'],
    entity_storage: { version: 1, legacy_backup_version: '0.0.5', entry_default_package: '_unpackaged', receipt: makeEntityStorageReceipt(null, new Map(), false) },
  });
  await json(path.join(doc, packageManifestPath('_unpackaged')), { format: 'snl-package', version: 1, id: '_unpackaged', name: 'Unpackaged', description: '' });
  await json(path.join(doc, packageManifestPath('Logic')), { format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '' });
  const entries = [
    { id: 'ctx', package: '_unpackaged', kind: 'definition', title: 'Context', content: { snl: 'root(@A)' }, contribution_info: null, pointer: null },
    { id: 'target', package: '_unpackaged', kind: 'definition', title: 'Target', content: { snl: 'Logic.eq(A@ctx,Logic.zero)' }, contribution_info: null, pointer: null },
  ];
  for (const entry of entries) await json(path.join(doc, entryEntityPath(entry.package, entry.id)), { format: 'snl-entry', version: 1, package: entry.package, entry });
  const macros = [
    { name: 'Logic.eq', description: '', source: { entries: ['ctx'], urls: [] }, dynamic_arity: false, default_style: { en: 'default' }, tags: [], styles: [{ style_name: 'default', mode: 'formula_inline', template: '#0 = #1', tags: [] }] },
    { name: 'Logic.zero', description: '', source: { entries: [], urls: ['https://example.test/zero'] }, dynamic_arity: false, default_style: { en: 'default' }, tags: [], styles: [{ style_name: 'default', mode: 'formula_inline', template: '0', tags: [] }] },
  ];
  for (const macro of macros) await json(path.join(doc, macroEntityPath('Logic', macro.name)), { format: 'snl-macro', version: 1, package: 'Logic', macro });
  return root;
}

function run(root: string, cli: string, args: string[]) {
  return spawnSync(process.execPath, [path.resolve('bin', `${cli}.mjs`), '--root', root, '--json', ...args], { encoding: 'utf8' });
}

describe('single Entry analysis CLIs', () => {
  it('computes authoritative SSI for exactly one Entry using the workspace context and Macro sources', async () => {
    const root = await workspace();
    const result = run(root, 'snl-entry-ssi', ['target']);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.deepEqual(body, {
      status: 'ok', entryId: 'target',
      metrics: { weakSemanticFreedom: 0, strongSemanticFreedom: 0, weightedTotal: 3, weightedWeakSemanticFreedom: 0, weightedStrongSemanticFreedom: 0, structuralIndex: 1 },
    });
  });

  it('returns one structured JSON failure for a missing Entry', async () => {
    const root = await workspace();
    for (const cli of ['snl-entry-ssi', 'snl-entry-latex']) {
      const result = run(root, cli, ['missing']);
      assert.equal(result.status, 2);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), { status: 'error', code: 'entry.not-found', message: 'Entry not found: missing' });
    }
  });

  it('assembles bare LaTeX for exactly one Entry without htmlData wrappers', async () => {
    const root = await workspace();
    const result = run(root, 'snl-entry-latex', ['target']);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.deepEqual(body, { status: 'ok', entryId: 'target', latex: 'A = 0', notes: [] });
    assert.equal(body.latex.includes('\\htmlData'), false);
  });
});
