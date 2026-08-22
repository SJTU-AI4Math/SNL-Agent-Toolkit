import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { createManagedEntity, deleteManagedEntity, getManagedEntity, listManagedEntities, updateManagedEntity, validateManagedWorkspace } from '../lib/entity-crud.ts';
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

  it('requires current schema markers in v0.1.0 while keeping markerless 0.0.11 compatibility', async () => {
    const cases = [
      { type: 'entry-package' as const, relative: packageManifestPath('Logic') },
      { type: 'entry' as const, relative: entryEntityPath('_unpackaged', 'entry.localized') },
      { type: 'macro' as const, relative: macroEntityPath('Logic', 'FOL.implies') },
    ];
    for (const item of cases) {
      const root = await fixtureCopy();
      await mutateJson(path.join(root, '.SNL_Doc', item.relative), (value) => {
        delete value.schema_version;
      });
      await assert.rejects(() => listManagedEntities(root, item.type), /schema_version|current Package manifest/i);
    }
    const legacy = await fixtureCopy();
    await mutateJson(path.join(legacy, '.SNL_Doc', 'config.json'), (config) => { config.version = '0.0.11'; });
    for (const relative of [
      entryEntityPath('_unpackaged', 'entry.localized'),
      macroEntityPath('Logic', 'FOL.implies'),
    ]) {
      await mutateJson(path.join(legacy, '.SNL_Doc', relative), (value) => { delete value.schema_version; });
    }
    assert.equal((await listManagedEntities(legacy, 'entry')).length, 1);
    assert.equal((await listManagedEntities(legacy, 'macro')).length, 1);
  });

  it('creates and reads schema-1 Entries with the blank title allowed by the Entry linter', async () => {
    const root = await fixtureCopy();
    const result = await createManagedEntity(root, 'entry', {
      id: 'entry.blank',
      package: 'Logic',
      kind: 'definition',
      title: '',
      content: { snl: 'FOL.implies' },
      contribution_info: null,
      pointer: null,
    });
    assert.equal(result.status, 'ok');
    const readBack = await getManagedEntity(root, 'entry', 'entry.blank');
    assert.equal(readBack?.value.title, '');
  });

  it('deletes an unreferenced Entry when another canonical Entry uses Unicode identifiers', async () => {
    const root = await fixtureCopy();
    await mutateJson(
      path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized')),
      (envelope) => {
        const entry = envelope.entry as Record<string, unknown>;
        entry.content = { snl: 'Topology.τ(Théorie.groupe(élément), emoji.猫🐈(鱼))' };
      },
    );
    const created = await createManagedEntity(root, 'entry', {
      id: 'entry.delete-me',
      package: 'Logic',
      kind: 'definition',
      title: 'Delete me',
      content: {},
      contribution_info: null,
      pointer: null,
    });
    assert.equal(created.status, 'ok');
    if (created.status !== 'ok') return;

    const deleted = await deleteManagedEntity(
      root, 'entry', 'entry.delete-me', created.entity.revision,
    );
    assert.equal(deleted.status, 'ok');
    assert.equal(await getManagedEntity(root, 'entry', 'entry.delete-me'), undefined);
  });

  it('rejects every missing required Entry schema-1 payload field', async () => {
    for (const field of ['kind', 'title', 'content', 'contribution_info', 'pointer']) {
      const root = await fixtureCopy();
      await mutateJson(path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized')), (envelope) => {
        delete (envelope.entry as Record<string, unknown>)[field];
      });
      await assert.rejects(() => listManagedEntities(root, 'entry'), /Entry payload|valid SNL Entry/i, field);
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


  it('never pairs stale Entry or Macro values with revisions from a later envelope', async () => {
    const entryRoot = await fixtureCopy();
    await assert.rejects(
      () => listManagedEntities(entryRoot, 'entry', {
        afterAuthoritativeRead: async () => mutateJson(
          path.join(entryRoot, '.SNL_Doc', 'entries', '_unpackaged-dce4a52e97d0e7f1530a.json'),
          (envelope) => { ((envelope.entry as Record<string, unknown>).content as Record<string, unknown>).snl = 'changed'; },
        ),
      }),
      /changed concurrently while listing/,
    );
    const macroRoot = await fixtureCopy();
    await assert.rejects(
      () => listManagedEntities(macroRoot, 'macro', {
        afterAuthoritativeRead: async () => mutateJson(
          path.join(macroRoot, '.SNL_Doc', 'macros', 'Logic-5aabaa394067f99556fe.json'),
          (envelope) => { (envelope.macro as Record<string, unknown>).description = 'changed'; },
        ),
      }),
      /changed concurrently while listing/,
    );
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

  it('rejects a stale Entry revision when the file changes after the first revision check', async () => {
    const root = await fixtureCopy();
    const entry = await getManagedEntity(root, 'entry', 'entry.localized');
    assert.ok(entry);
    const file = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', entry.id));
    const result = await updateManagedEntity(root, 'entry', entry.id, {
      ...entry.value,
      title: 'mine',
    }, entry.revision, {
      afterRevisionCheck: async () => mutateJson(file, envelope => {
        (envelope.entry as Record<string, unknown>).title = 'external';
      }),
    });
    assert.equal(result.status, 'conflict');
    const persisted = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(persisted.entry.title, 'external');
  });

  it('validates Kind writes authoritatively and protects referenced Kinds', async () => {
    const root = await fixtureCopy();
    const kind = await getManagedEntity(root, 'entry-kind', 'definition');
    assert.ok(kind);
    const localized = {
      ...kind.value,
      name: { type: 'i18n', default_language: 'en', values: { en: 'Definition', zh: '定义' } },
    };
    const updated = await updateManagedEntity(root, 'entry-kind', kind.id, localized, kind.revision);
    assert.equal(updated.status, 'ok');
    if (updated.status !== 'ok') return;
    const invalid = {
      ...updated.entity.value,
      coloring: { stroke: '#000', background: '#fff' },
    };
    const rejected = await updateManagedEntity(root, 'entry-kind', kind.id, invalid, updated.entity.revision);
    assert.equal(rejected.status, 'invalid');
    const unchanged = await getManagedEntity(root, 'entry-kind', kind.id);
    assert.equal(unchanged?.revision, updated.entity.revision);
    const deletion = await deleteManagedEntity(root, 'entry-kind', kind.id, updated.entity.revision);
    assert.equal(deletion.status, 'conflict');
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


  it('does not overwrite a concurrently replaced Package manifest during update', async () => {
    const root = await fixtureCopy();
    const pkg = await getManagedEntity(root, 'entry-package', 'Logic');
    assert.ok(pkg);
    pkg.value.description = 'mine';
    const file = path.join(root, '.SNL_Doc', packageManifestPath('Logic'));
    const concurrent = JSON.parse(await readFile(file, 'utf8'));
    concurrent.description = 'external';
    concurrent.concurrent_extension = { keep: true };
    await assert.rejects(
      () => updateManagedEntity(root, 'entry-package', pkg.id, pkg.value, pkg.revision, {
        beforeEntityInstall: async () => writeFile(file, `${JSON.stringify(concurrent, null, 2)}\n`),
      }),
      /changed.*refusing/i,
    );
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), concurrent);
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


  it('never deletes a replacement libraries parent after initial durability failure', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const parked = path.join(root, '.SNL_Doc', 'parked-libraries-parent');
    await rm(libraries, { recursive: true, force: true });
    await assert.rejects(
      () => createManagedEntity(root, 'library', {
        slug: 'first', meta: {}, graph: { nodes: [], relationships: [] }, counters: { counters: [] },
      }, {
        beforeLibraryCreateParentSync: async () => {
          await rename(libraries, parked);
          await mkdir(libraries);
          assert.equal((await stat(libraries)).isDirectory(), true);
          throw new Error('force parent durability failure');
        },
      }),
      /force parent durability failure/,
    );
    await stat(parked);
    await stat(libraries);
  });

  it('never deletes a concurrent replacement while cleaning up failed Library creation', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const dir = path.join(libraries, 'new-library');
    const parkedOwned = path.join(libraries, 'parked-owned-create');
    await assert.rejects(
      () => createManagedEntity(root, 'library', {
        slug: 'new-library', meta: {}, graph: { nodes: [], relationships: [] }, counters: { counters: [] },
      }, {
        beforeLibraryCreateResource: name => { if (name === 'counters.json') throw new Error('force create cleanup'); },
        beforeLibraryCreateCleanupCapture: async () => {
          await rename(dir, parkedOwned);
          await mkdir(dir);
        },
      }),
      /replacement is preserved|force create cleanup/,
    );
    await stat(parkedOwned);
    const recovery = (await readdir(libraries)).find(name => name.startsWith('.new-library.snl-entity-') && name.endsWith('.create-failed'));
    assert.ok(recovery);
    await stat(path.join(libraries, recovery));
  });

  it('creates the first Library durably when the optional libraries directory is absent', async () => {
    const root = await fixtureCopy();
    await rm(path.join(root, '.SNL_Doc', 'libraries'), { recursive: true, force: true });
    const result = await createManagedEntity(root, 'library', {
      slug: 'first', meta: {}, graph: { nodes: [], relationships: [] }, counters: { counters: [] },
    });
    assert.equal(result.status, 'ok');
    assert.ok(await getManagedEntity(root, 'library', 'first'));
  });

  it('rejects dangling Relationship endpoints and invalid Library graphs on mutation', async () => {
    const root = await fixtureCopy();
    const relationship = await createManagedEntity(root, 'relationship', {
      id: 'dangling', from: 'missing.from', to: 'missing.to', label: 'uses_context',
    });
    assert.equal(relationship.status, 'invalid');
    assert.match(relationship.message, /must resolve to existing Entries/i);
    const library = await createManagedEntity(root, 'library', {
      slug: 'broken', meta: {},
      graph: {
        nodes: [{ id: 'n', label: 'Entry', props: { entryId: 'missing.entry' } }],
        relationships: [{ from: 'ghost', to: 'n', label: 'branch' }],
      },
      counters: { counters: [] },
    });
    assert.equal(library.status, 'invalid');
    assert.match(library.message, /entry|node|branch/i);
  });

  it('reports cross-family and Library graph issues during workspace validation', async () => {
    const root = await fixtureCopy();
    await writeFile(path.join(root, '.SNL_Doc', 'relationships.json'), `${JSON.stringify({
      version: 1,
      relationships: [{ id: 'dangling', from: 'missing.from', to: 'missing.to', label: 'uses_context' }],
    }, null, 2)}\n`);
    const dir = path.join(root, '.SNL_Doc', 'libraries', 'broken');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{}\n');
    await writeFile(path.join(dir, 'graph.json'), `${JSON.stringify({
      nodes: [{ id: 'n', label: 'Entry', props: { entryId: 'missing.entry' } }],
      relationships: [{ from: 'ghost', to: 'n', label: 'branch' }],
    }, null, 2)}\n`);
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    const report = await validateManagedWorkspace(root);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some(issue => issue.code === 'relationship.dangling-from'));
    assert.ok(report.issues.some(issue => issue.path?.startsWith('library:broken/graph.json')));
  });

  it('rejects Entries whose Kind is absent and reports the workspace invalid', async () => {
    const root = await fixtureCopy();
    const file = path.join(root, '.SNL_Doc', 'entries', '_unpackaged-dce4a52e97d0e7f1530a.json');
    await mutateJson(file, value => { (value.entry as Record<string, unknown>).kind = 'missing-kind'; });
    await assert.rejects(() => listManagedEntities(root, 'entry'), /missing Entry Kind "missing-kind"/);
    const report = await validateManagedWorkspace(root);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some(issue => issue.code === 'entry.read-failed' && issue.message.includes('missing-kind')));
  });

  it('reports malformed Relationship fields during workspace validation', async () => {
    const root = await fixtureCopy();
    await writeFile(path.join(root, '.SNL_Doc', 'relationships.json'), '{"version":1,"relationships":[{"id":"malformed"}]}\n');
    await assert.rejects(
      () => listManagedEntities(root, 'relationship'),
      /requires non-empty from\/to\/label strings/i,
    );
    const report = await validateManagedWorkspace(root);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some(issue =>
      issue.code === 'relationship.read-failed' && issue.message.includes('requires non-empty from/to/label strings'),
    ));
  });

  it('rejects derived Macro Package contents instead of silently discarding them', async () => {
    const root = await fixtureCopy();
    const pkg = await getManagedEntity(root, 'macro-package', 'Logic');
    assert.ok(pkg);
    const result = await updateManagedEntity(root, 'macro-package', 'Logic', {
      ...pkg.value,
      macros: { injected: {} },
    }, pkg.revision);
    assert.equal(result.status, 'invalid');
    assert.match(result.message, /macros.*derived/i);
    assert.deepEqual((await getManagedEntity(root, 'macro-package', 'Logic'))?.value.macros, pkg.value.macros);
  });

  it('preflights Package creation before publishing into a corrupt topology', async () => {
    const root = await fixtureCopy();
    const configFile = path.join(root, '.SNL_Doc', 'config.json');
    const configBefore = await readFile(configFile, 'utf8');
    const manifest = path.join(root, '.SNL_Doc', 'packages', '_unpackaged-60979c6e210d0e2a20cb.json');
    await mutateJson(manifest, value => { value.entry_ids = []; });
    await assert.rejects(
      () => createManagedEntity(root, 'entry-package', { id: 'NewPkg', name: 'New', description: '' }),
      /entry_ids does not exactly match/i,
    );
    assert.equal(await readFile(configFile, 'utf8'), configBefore);
    assert.equal((await readdir(path.join(root, '.SNL_Doc', 'packages'))).some(name => name.startsWith('NewPkg-')), false);
  });

  it('targets one Library for get and update while list remains fail-closed on malformed siblings', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const targetDir = path.join(libraries, 'target');
    const malformedDir = path.join(libraries, 'malformed');
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, 'meta.json'), '{"title":"before"}\n');
    await writeFile(path.join(targetDir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(targetDir, 'counters.json'), '{"counters":[]}\n');
    assert.equal(await getManagedEntity(root, 'library', ''), undefined);
    await mkdir(malformedDir);
    await writeFile(path.join(malformedDir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');

    await assert.rejects(() => listManagedEntities(root, 'library'), /meta\.json|ENOENT/i);
    await assert.rejects(() => getManagedEntity(root, 'library', 'malformed'), /meta\.json|ENOENT/i);
    const target = await getManagedEntity(root, 'library', 'target');
    assert.ok(target);
    assert.equal((target.value.meta as Record<string, unknown>).title, 'before');

    const result = await updateManagedEntity(root, 'library', 'target', {
      ...target.value,
      meta: { title: 'after' },
    }, target.revision);
    assert.equal(result.status, 'ok');
    assert.equal((result.entity.value.meta as Record<string, unknown>).title, 'after');
    assert.equal(JSON.parse(await readFile(path.join(targetDir, 'meta.json'), 'utf8')).title, 'after');
  });

  it('rejects symlinked Relationship and Library payload files', async () => {
    const relationshipRoot = await fixtureCopy();
    const externalRelationship = path.join(relationshipRoot, 'outside-relationships.json');
    await writeFile(externalRelationship, '{"version":1,"relationships":[]}\n');
    await symlink(externalRelationship, path.join(relationshipRoot, '.SNL_Doc', 'relationships.json'));
    await assert.rejects(() => listManagedEntities(relationshipRoot, 'relationship'), /symlink|ELOOP|regular/i);

    const libraryRoot = await fixtureCopy();
    const libraryDir = path.join(libraryRoot, '.SNL_Doc', 'libraries', 'sample');
    await mkdir(libraryDir, { recursive: true });
    const externalMeta = path.join(libraryRoot, 'outside-meta.json');
    await writeFile(externalMeta, '{"title":"outside"}\n');
    await symlink(externalMeta, path.join(libraryDir, 'meta.json'));
    await writeFile(path.join(libraryDir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(libraryDir, 'counters.json'), '{"counters":[]}\n');
    await assert.rejects(() => listManagedEntities(libraryRoot, 'library'), /symlink|ELOOP|regular/i);
    await assert.rejects(() => getManagedEntity(libraryRoot, 'library', 'sample'), /symlink|ELOOP|regular/i);
  });

  it('rolls back earlier Library files without overwriting a concurrent replacement', async () => {
    const root = await fixtureCopy();
    const dir = path.join(root, '.SNL_Doc', 'libraries', 'sample');
    await mkdir(dir, { recursive: true });
    const originalMeta = { title: 'original' };
    const originalGraph = { nodes: [], relationships: [] };
    const originalCounters = { counters: [] };
    await writeFile(path.join(dir, 'meta.json'), `${JSON.stringify(originalMeta, null, 2)}\n`);
    await writeFile(path.join(dir, 'graph.json'), `${JSON.stringify(originalGraph, null, 2)}\n`);
    await writeFile(path.join(dir, 'counters.json'), `${JSON.stringify(originalCounters, null, 2)}\n`);
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    const next = {
      ...library.value,
      meta: { title: 'mine' },
      graph: { nodes: [], relationships: [] },
      counters: { counters: [{ name: 'mine' }] },
    };
    const concurrentGraph = { nodes: [], relationships: [], external: true };
    await assert.rejects(
      () => updateManagedEntity(root, 'library', 'sample', next, library.revision, {
        beforeEntityInstall: async () => writeFile(
          path.join(dir, 'graph.json'),
          `${JSON.stringify(concurrentGraph, null, 2)}\n`,
        ),
      }),
      /changed.*refusing/i,
    );
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8')), originalMeta);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'graph.json'), 'utf8')), concurrentGraph);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'counters.json'), 'utf8')), originalCounters);
  });

  it('refuses a Library update when its directory is replaced by a symlink', async () => {
    const root = await fixtureCopy();
    const dir = path.join(root, '.SNL_Doc', 'libraries', 'sample');
    const parked = path.join(root, 'parked-library');
    const external = path.join(root, 'external-library');
    await mkdir(dir, { recursive: true });
    await mkdir(external);
    for (const [name, value] of [
      ['meta.json', { title: 'original' }],
      ['graph.json', { nodes: [], relationships: [] }],
      ['counters.json', { counters: [] }],
    ] as const) {
      await writeFile(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
      await writeFile(path.join(external, name), `${JSON.stringify(value, null, 2)}\n`);
    }
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    const externalBefore = await Promise.all(['meta.json', 'graph.json', 'counters.json'].map(name => readFile(path.join(external, name), 'utf8')));
    await assert.rejects(
      () => updateManagedEntity(root, 'library', 'sample', {
        ...library.value,
        meta: { title: 'mine' },
      }, library.revision, {
        beforeEntityInstall: async () => {
          await rename(dir, parked);
          await symlink(external, dir, 'dir');
        },
      }),
      /changed concurrently|replacement directory/i,
    );
    assert.deepEqual(
      await Promise.all(['meta.json', 'graph.json', 'counters.json'].map(name => readFile(path.join(external, name), 'utf8'))),
      externalBefore,
    );
  });

  it('preserves an identical replacement Library directory at the final delete seam', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const dir = path.join(libraries, 'sample');
    const parked = path.join(root, 'parked-original-library');
    await mkdir(dir, { recursive: true });
    for (const [name, text] of [
      ['meta.json', '{"title":"same"}\n'],
      ['graph.json', '{"nodes":[],"relationships":[]}\n'],
      ['counters.json', '{"counters":[]}\n'],
    ] as const) await writeFile(path.join(dir, name), text);
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeEntityDelete: async () => {
          await rename(dir, parked);
          await mkdir(dir);
          for (const name of ['meta.json', 'graph.json', 'counters.json'])
            await cp(path.join(parked, name), path.join(dir, name));
        },
      }),
      /was replaced while deletion was in flight/i,
    );
    assert.equal(await readFile(path.join(dir, 'meta.json'), 'utf8'), '{"title":"same"}\n');
    assert.equal(await readFile(path.join(parked, 'meta.json'), 'utf8'), '{"title":"same"}\n');
    assert.equal((await readdir(libraries)).some(name => name.startsWith('.sample.snl-entity-')), true);
  });

  it('restores a Library when documents appear at the final delete seam', async () => {
    const root = await fixtureCopy();
    const dir = path.join(root, '.SNL_Doc', 'libraries', 'sample');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeEntityDelete: async () => {
          await mkdir(path.join(dir, 'documents'));
          await writeFile(path.join(dir, 'documents', 'arrived.txt'), 'external');
        },
      }),
      /changed while deletion was in flight.*restored/i,
    );
    assert.equal(await readFile(path.join(dir, 'documents', 'arrived.txt'), 'utf8'), 'external');
  });

  it('restores a Library when unmanaged data arrives after the final extras check', async () => {
    const root = await fixtureCopy();
    const dir = path.join(root, '.SNL_Doc', 'libraries', 'sample');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDirectoryRemove: async captured => {
          await mkdir(path.join(captured, 'documents'));
          await writeFile(path.join(captured, 'documents', 'late.txt'), 'late');
        },
      }),
      /changed while deletion was in flight.*restored/i,
    );
    assert.equal(await readFile(path.join(dir, 'documents', 'late.txt'), 'utf8'), 'late');
    assert.equal(await readFile(path.join(dir, 'meta.json'), 'utf8'), '{}\n');
  });

  it('rolls back a Library delete when the durable parent commit fails', async () => {
    const root = await fixtureCopy();
    const dir = path.join(root, '.SNL_Doc', 'libraries', 'sample');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDeleteCommitSync: () => { throw new Error('injected Library directory fsync failure'); },
      }),
      /changed while deletion was in flight.*restored/i,
    );
    assert.equal(await readFile(path.join(dir, 'meta.json'), 'utf8'), '{}\n');
    assert.equal((await getManagedEntity(root, 'library', 'sample'))?.revision, library.revision);
  });

  it('never overwrites a concurrent empty directory during Library restore', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const dir = path.join(libraries, 'sample');
    const displacedReservation = path.join(libraries, 'displaced-reservation');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDeleteCommitSync: () => { throw new Error('force restoration'); },
        beforeLibraryRestoreInstall: async () => {
          await rename(dir, displacedReservation);
          await mkdir(dir);
        },
      }),
      /replacement directory|captured directory remains/i,
    );
    assert.deepEqual(await readdir(dir), []);
    const recovery = (await readdir(libraries)).find(name => name.startsWith('.sample.snl-entity-'));
    assert.ok(recovery);
    assert.equal(await readFile(path.join(libraries, recovery, 'meta.json'), 'utf8'), '{}\n');
  });

  it('pins the restore reservation across the final check-to-copy seam', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const dir = path.join(libraries, 'sample');
    const displacedReservation = path.join(libraries, 'displaced-final-reservation');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDeleteCommitSync: () => { throw new Error('force restoration'); },
        afterLibraryRestoreReservationCheck: async () => {
          await rename(dir, displacedReservation);
          await mkdir(dir);
        },
      }),
      /replacement directory|captured directory remains|recovery failed/i,
    );
    assert.deepEqual(await readdir(dir), []);
    assert.equal(await readFile(path.join(displacedReservation, 'meta.json'), 'utf8'), '{}\n');
  });

  it('pins the captured Library across the final restore copy seam', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const dir = path.join(libraries, 'sample');
    const parkedCapture = path.join(libraries, 'parked-captured-library');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{"owner":"original"}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    let replacementCapture = '';
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDeleteCommitSync: () => { throw new Error('force restoration'); },
        afterLibraryRestoreReservationCheck: async () => {
          const name = (await readdir(libraries)).find(candidate => candidate.startsWith('.sample.snl-entity-') && candidate.endsWith('.deleted'));
          assert.ok(name);
          replacementCapture = path.join(libraries, name);
          await rename(replacementCapture, parkedCapture);
          await mkdir(replacementCapture);
          await writeFile(path.join(replacementCapture, 'meta.json'), '{"owner":"external"}\n');
        },
      }),
      /changed while deletion was in flight|force restoration/,
    );
    assert.equal(await readFile(path.join(dir, 'meta.json'), 'utf8'), '{"owner":"original"}\n');
    assert.equal(await readFile(path.join(parkedCapture, 'meta.json'), 'utf8'), '{"owner":"original"}\n');
    assert.equal(await readFile(path.join(replacementCapture, 'meta.json'), 'utf8'), '{"owner":"external"}\n');
  });

  it('restores the captured Library bytes when a captured child changes after snapshot', async () => {
    const root = await fixtureCopy();
    const libraries = path.join(root, '.SNL_Doc', 'libraries');
    const dir = path.join(libraries, 'sample');
    const outside = path.join(root, 'outside-meta.json');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{"owner":"original"}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    await writeFile(outside, '{"owner":"replacement"}\n');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    await assert.rejects(
      () => deleteManagedEntity(root, 'library', 'sample', library.revision, {
        beforeLibraryDeleteCommitSync: () => { throw new Error('force restoration'); },
        afterLibraryRestoreReservationCheck: async () => {
          const name = (await readdir(libraries)).find(candidate => candidate.startsWith('.sample.snl-entity-') && candidate.endsWith('.deleted'));
          assert.ok(name);
          const capturedMeta = path.join(libraries, name, 'meta.json');
          await rm(capturedMeta);
          await symlink(outside, capturedMeta);
        },
      }),
      /changed while deletion was in flight.*restored/i,
    );
    const restoredMeta = path.join(dir, 'meta.json');
    assert.equal((await lstat(restoredMeta)).isFile(), true);
    assert.equal(await readFile(restoredMeta, 'utf8'), '{"owner":"original"}\n');
    assert.equal(await readFile(outside, 'utf8'), '{"owner":"replacement"}\n');
  });

  it('refuses to delete a Library that still contains documents or exports', async () => {
    const root = await fixtureCopy();
    const dir = path.join(root, '.SNL_Doc', 'libraries', 'sample');
    await mkdir(path.join(dir, 'documents'), { recursive: true });
    await writeFile(path.join(dir, 'meta.json'), '{}\n');
    await writeFile(path.join(dir, 'graph.json'), '{"nodes":[],"relationships":[]}\n');
    await writeFile(path.join(dir, 'counters.json'), '{"counters":[]}\n');
    await writeFile(path.join(dir, 'documents', 'keep.txt'), 'keep');
    const library = await getManagedEntity(root, 'library', 'sample');
    assert.ok(library);
    const result = await deleteManagedEntity(root, 'library', 'sample', library.revision);
    assert.equal(result.status, 'conflict');
    assert.equal(await readFile(path.join(dir, 'documents', 'keep.txt'), 'utf8'), 'keep');
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
