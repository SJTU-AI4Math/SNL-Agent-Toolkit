import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { createManagedEntity, deleteManagedEntity, getManagedEntity, listManagedEntities, updateManagedEntity } from '../lib/entity-crud.ts';
import { entryEntityPath, macroEntityPath, packageManifestPath } from '../lib/entity-storage.ts';

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'workspace-v0.1.0');
const roots: string[] = [];

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixtureCopy(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-crud-v010-'));
  roots.push(root);
  await cp(path.join(FIXTURE, '.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  return root;
}

async function mutateJson(file: string, mutate: (value: Record<string, unknown>) => void): Promise<void> {
  const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  mutate(value);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

describe('unified CRUD on workspace v0.1.0', () => {
  it('uses authoritative current schema gates for Package, Entry, and Macro lists', async () => {
    const cases = [
      { type: 'entry-package' as const, relative: packageManifestPath('Logic'), future: 3 },
      { type: 'entry' as const, relative: entryEntityPath('_unpackaged', 'entry.localized'), future: 2 },
      { type: 'macro' as const, relative: macroEntityPath('Logic', 'FOL.implies'), future: 2 },
    ];
    for (const item of cases) {
      const root = await fixtureCopy();
      await mutateJson(path.join(root, '.SNL_Doc', item.relative), (value) => {
        value.schema_version = item.future;
      });
      await assert.rejects(
        () => listManagedEntities(root, item.type),
        /schema version|schema_version|current Package manifest/i,
        item.type,
      );
    }
  });

  it('preserves unknown Entry and Macro envelope fields while writing current markers', async () => {
    const root = await fixtureCopy();
    const macroFile = path.join(root, '.SNL_Doc', macroEntityPath('Logic', 'FOL.implies'));
    await mutateJson(macroFile, (envelope) => {
      envelope.envelope_extension = { keep: 'macro-envelope' };
    });

    const entry = await getManagedEntity(root, 'entry', 'entry.localized');
    assert.ok(entry);
    entry.value.content = {};
    const entryResult = await updateManagedEntity(root, 'entry', entry.id, entry.value, entry.revision);
    assert.equal(entryResult.status, 'ok');
    const entryEnvelope = JSON.parse(await readFile(path.join(
      root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized'),
    ), 'utf8'));
    assert.equal(entryEnvelope.schema_version, 1);
    assert.deepEqual(entryEnvelope.vendor_extension, { keep: 'envelope' });

    const macro = await getManagedEntity(root, 'macro', 'Logic::FOL.implies');
    assert.ok(macro);
    macro.value.description = 'Updated';
    const macroResult = await updateManagedEntity(root, 'macro', macro.id, macro.value, macro.revision);
    assert.equal(macroResult.status, 'ok');
    const macroEnvelope = JSON.parse(await readFile(macroFile, 'utf8'));
    assert.equal(macroEnvelope.schema_version, 1);
    assert.deepEqual(macroEnvelope.envelope_extension, { keep: 'macro-envelope' });
  });


  it('binds Entry CAS revisions to unknown persisted envelope extensions', async () => {
    const root = await fixtureCopy();
    const entry = await getManagedEntity(root, 'entry', 'entry.localized');
    assert.ok(entry);
    const file = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', entry.id));
    await mutateJson(file, (envelope) => {
      envelope.concurrent_extension = { writer: 'external' };
    });
    entry.value.content = {};
    const result = await updateManagedEntity(root, 'entry', entry.id, entry.value, entry.revision);
    assert.equal(result.status, 'conflict');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).concurrent_extension, { writer: 'external' });
  });

  it('rejects Package updates that try to change derived Entry membership', async () => {
    const root = await fixtureCopy();
    const pkg = await getManagedEntity(root, 'entry-package', '_unpackaged');
    assert.ok(pkg);
    pkg.value.entry_ids = [];
    pkg.value.description = 'Changed';
    const result = await updateManagedEntity(root, 'entry-package', pkg.id, pkg.value, pkg.revision);
    assert.equal(result.status, 'invalid');
    const manifest = JSON.parse(await readFile(path.join(
      root, '.SNL_Doc', packageManifestPath('_unpackaged'),
    ), 'utf8'));
    assert.deepEqual(manifest.entry_ids, ['entry.localized']);
    assert.equal(manifest.description, '');
  });


  it('removes a deleted Entry from its owning Package membership index', async () => {
    const root = await fixtureCopy();
    await mutateJson(path.join(root, '.SNL_Doc', macroEntityPath('Logic', 'FOL.implies')), (envelope) => {
      const macro = envelope.macro as Record<string, unknown>;
      macro.source = { entries: [], urls: [] };
    });
    const entry = await getManagedEntity(root, 'entry', 'entry.localized');
    assert.ok(entry);
    entry.value.content = {};
    const updated = await updateManagedEntity(root, 'entry', entry.id, entry.value, entry.revision);
    assert.equal(updated.status, 'ok');
    assert.equal(updated.status === 'ok' ? updated.entity.id : '', entry.id);
    const result = await deleteManagedEntity(
      root, 'entry', entry.id,
      updated.status === 'ok' ? updated.entity.revision : '',
    );
    assert.equal(result.status, 'ok');
    const manifest = JSON.parse(await readFile(path.join(
      root, '.SNL_Doc', packageManifestPath('_unpackaged'),
    ), 'utf8'));
    assert.deepEqual(manifest.entry_ids, []);
    assert.deepEqual(await listManagedEntities(root, 'entry'), []);
  });


  it('moves an updated Entry and both Package membership indexes transactionally', async () => {
    const root = await fixtureCopy();
    const entry = await getManagedEntity(root, 'entry', 'entry.localized');
    assert.ok(entry);
    entry.value.package = 'Logic';
    entry.value.content = {};
    const result = await updateManagedEntity(root, 'entry', entry.id, entry.value, entry.revision);
    assert.equal(result.status, 'ok');
    await assert.rejects(
      readFile(path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', entry.id))),
      /ENOENT/,
    );
    const moved = JSON.parse(await readFile(path.join(
      root, '.SNL_Doc', entryEntityPath('Logic', entry.id),
    ), 'utf8'));
    assert.equal(moved.schema_version, 1);
    assert.deepEqual(moved.vendor_extension, { keep: 'envelope' });
    const source = JSON.parse(await readFile(path.join(
      root, '.SNL_Doc', packageManifestPath('_unpackaged'),
    ), 'utf8'));
    const destination = JSON.parse(await readFile(path.join(
      root, '.SNL_Doc', packageManifestPath('Logic'),
    ), 'utf8'));
    assert.deepEqual(source.entry_ids, []);
    assert.deepEqual(destination.entry_ids, ['entry.localized']);
    assert.equal((await getManagedEntity(root, 'entry', entry.id))?.value.package, 'Logic');
  });


  it('keeps a Package manifest when config deletion fails and permits a clean retry', async () => {
    const root = await fixtureCopy();
    const created = await createManagedEntity(root, 'entry-package', { id: 'Algebra', name: 'Algebra', description: '' });
    assert.equal(created.status, 'ok');
    assert.equal(created.status === 'ok' ? created.entity.id : '', 'Algebra');
    const manifestFile = path.join(root, '.SNL_Doc', packageManifestPath('Algebra'));
    const configFile = path.join(root, '.SNL_Doc', 'config.json');
    const concurrentConfig = JSON.parse(await readFile(configFile, 'utf8'));
    concurrentConfig.concurrent_extension = { keep: true };

    await assert.rejects(
      deleteManagedEntity(
        root, 'entry-package', 'Algebra',
        created.status === 'ok' ? created.entity.revision : '',
        { beforeConfigInstall: async () => writeFile(configFile, `${JSON.stringify(concurrentConfig, null, 2)}\n`) },
      ),
      /changed.*refusing/i,
    );
    assert.equal((await readFile(manifestFile, 'utf8')).length > 0, true);
    assert.deepEqual(JSON.parse(await readFile(configFile, 'utf8')).concurrent_extension, { keep: true });

    const current = await getManagedEntity(root, 'entry-package', 'Algebra');
    assert.ok(current);
    const retry = await deleteManagedEntity(root, 'entry-package', 'Algebra', current.revision);
    assert.equal(retry.status, 'ok');
    await assert.rejects(() => readFile(manifestFile), /ENOENT/);
    assert.equal((JSON.parse(await readFile(configFile, 'utf8')).active_macro_packages as string[]).includes('Algebra'), false);
  });

});
