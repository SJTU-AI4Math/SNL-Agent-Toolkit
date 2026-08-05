import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, it } from 'node:test';
import { rm } from 'node:fs/promises';
import {
  entryEntityPath,
  macroEntityPath,
  makeEntityStorageReceipt,
  packageManifestPath,
} from '../lib/entity-storage.ts';
import {
  readActiveMacros,
  readAllMacroPackages,
  readEntries,
} from '../lib/snl-doc.ts';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(): Promise<{ root: string; doc: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-toolkit-entities-'));
  roots.push(root);
  const doc = path.join(root, '.SNL_Doc');
  await mkdir(doc);
  await Promise.all([
    mkdir(path.join(doc, 'entries')),
    mkdir(path.join(doc, 'macros')),
    mkdir(path.join(doc, 'packages')),
  ]);
  await json(path.join(doc, packageManifestPath('_unpackaged')), {
    format: 'snl-package', version: 1, id: '_unpackaged', name: 'Unpackaged', description: '',
  });
  return { root, doc };
}

function currentConfig(
  extra: Record<string, unknown> = {},
  legacyEntries: unknown = null,
  legacyPackages: Map<string, unknown> = new Map(),
): Record<string, unknown> {
  return {
    version: '0.0.6',
    ...extra,
    entity_storage: {
      version: 1,
      legacy_backup_version: '0.0.5',
      entry_default_package: '_unpackaged',
      receipt: makeEntityStorageReceipt(
        legacyEntries,
        legacyPackages,
        legacyEntries !== null || legacyPackages.size > 0,
      ),
    },
  };
}

async function json(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

describe('Extension 0.0.6 per-entity storage', () => {
  it('uses the Extension stable identity hash and path contract', () => {
    assert.equal(packageManifestPath('Logic'), 'packages/Logic-277a664e3d2332d369d7.json');
    assert.equal(entryEntityPath('_unpackaged', 'Set.sec.set'), 'entries/_unpackaged-55ca962950f87a9b9251.json');
    assert.equal(macroEntityPath('Logic', 'FOL.implies'), 'macros/Logic-5aabaa394067f99556fe.json');
  });

  it('reads only entity files at 0.0.6 and ignores frozen aggregate backups', async () => {
    const { root, doc } = await workspace();
    const staleEntries = [{ id: 'stale', content: {} }];
    const stalePackage = {
      version: '8', name: 'stale', macros: { stale: {} },
    };
    await json(path.join(doc, 'entries.json'), staleEntries);
    await json(path.join(doc, 'term_macros/Logic.json'), stalePackage);
    await json(path.join(doc, 'config.json'), currentConfig(
      { active_macro_packages: ['Logic'] },
      staleEntries,
      new Map([['Logic.json', stalePackage]]),
    ));

    const entry = {
      id: 'Set.sec.set', package: '_unpackaged', kind: 'definition', title: 'Set',
      content: { snl: 'Set' }, contribution_info: null, pointer: null,
    };
    await json(path.join(doc, entryEntityPath('_unpackaged', entry.id)), {
      format: 'snl-entry', version: 1, package: '_unpackaged', entry,
    });
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic package', description: 'Logic macros',
    });
    const macro = {
      name: 'FOL.implies', description: 'Implication', dynamic_arity: false,
      default_style: { en: 'default' },
      styles: [{ style_name: 'default', mode: 'formula_inline', template: '#0 \\to #1', tags: [] }],
      source: { entries: [], urls: [] }, tags: [],
    };
    await json(path.join(doc, macroEntityPath('Logic', macro.name)), {
      format: 'snl-macro', version: 1, package: 'Logic', macro,
    });

    assert.deepEqual(await readEntries(root), [entry]);
    assert.deepEqual(await readAllMacroPackages(root), {
      _unpackaged: {
        version: '8', name: 'Unpackaged', description: '', macros: {},
      },
      Logic: {
        version: '8',
        name: 'Logic package',
        description: 'Logic macros',
        macros: {
          'FOL.implies': {
            description: 'Implication', dynamic_arity: false,
            default_style: { en: 'default' },
            styles: [{ style_name: 'default', mode: 'formula_inline', template: '#0 \\to #1', tags: [] }],
            source: { entries: [], urls: [] }, tags: [],
          },
        },
      },
    });
  });

  it('lints a named per-entity Package through the public CLI', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig({ active_macro_packages: ['Logic'] }));
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    await json(path.join(doc, macroEntityPath('Logic', 'FOL.implies')), {
      format: 'snl-macro', version: 1, package: 'Logic',
      macro: {
        name: 'FOL.implies', description: 'Implication', dynamic_arity: false, default_style: { en: 'default' }, tags: [],
        source: { entries: [], urls: [] },
        styles: [{ style_name: 'default', mode: 'formula_inline', template: '#0 \\to #1', tags: [] }],
      },
    });
    const result = spawnSync(
      process.execPath,
      ['bin/snl-lint-package.mjs', '--root', root, '--name', 'Logic', '--json'],
      { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const reports = JSON.parse(result.stdout);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].file, 'package:Logic');
    assert.deepEqual(reports[0].issues, []);
  });

  it('lints a per-entity Entry envelope through the public CLI', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig({
      entry_kinds: [{ id: 'definition', name: 'Definition', coloring: { stroke: '#000', background: '#fff' }, defaultCounterName: 'Definition', style: '' }],
    }));
    const entry = {
      id: 'entry.demo', package: '_unpackaged', kind: 'definition', title: 'Demo',
      content: { snl: '' }, contribution_info: null, pointer: null,
    };
    const entityFile = path.join(doc, entryEntityPath('_unpackaged', entry.id));
    await json(entityFile, { format: 'snl-entry', version: 1, package: '_unpackaged', entry });
    const result = spawnSync(
      process.execPath,
      ['bin/snl-lint-entry.mjs', '--root', root, '--json', entityFile],
      { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.reports.length, 1);
    assert.deepEqual(payload.reports[0].issues, []);
  });

  it('returns structured JSON when entity Package discovery is corrupt', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig());
    await writeFile(path.join(doc, 'packages/bad.json'), '{broken');
    const result = spawnSync(
      process.execPath,
      ['bin/snl-lint-package.mjs', '--root', root, '--json'],
      { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' },
    );
    assert.equal(result.status, 1, result.stderr);
    const reports = JSON.parse(result.stdout);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].issues[0].code, 'file.read');
  });

  it('returns structured JSON when Entry workspace discovery is corrupt', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig());
    await writeFile(path.join(doc, 'packages/bad.json'), '{broken');
    const input = path.join(root, 'draft-entry.json');
    await json(input, { id: 'draft', kind: 'definition', title: '', content: {} });
    const result = spawnSync(
      process.execPath,
      ['bin/snl-lint-entry.mjs', '--root', root, '--json', input],
      { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' },
    );
    assert.equal(result.status, 1, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.reports.length, 1);
    assert.equal(payload.reports[0].issues[0].code, 'file.read');
  });

  it('resolves active Macro conflicts by canonical Package order, not config order', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig({
      active_macro_packages: ['core', 'core-extra'],
    }));
    for (const packageId of ['core', 'core-extra']) {
      await json(path.join(doc, packageManifestPath(packageId)), {
        format: 'snl-package', version: 1, id: packageId, name: packageId, description: '',
      });
      await json(path.join(doc, macroEntityPath(packageId, 'same')), {
        format: 'snl-macro', version: 1, package: packageId,
        macro: {
          name: 'same', description: packageId, dynamic_arity: false, default_style: { en: 'default' }, tags: [],
          source: { entries: [], urls: [] },
          styles: [{ style_name: 'default', mode: 'text', template: packageId, tags: [] }],
        },
      });
    }
    assert.equal((await readActiveMacros(root)).same.description, 'core');
  });

  it('uses workspace version so 0.0.5 migration residue stays legacy', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), { version: '0.0.5', entity_storage: { version: 1 } });
    await json(path.join(doc, 'entries.json'), [{ id: 'legacy', content: {} }]);
    assert.deepEqual((await readEntries(root)).map((entry) => entry.id), ['legacy']);
  });

  it('refuses current-version aggregate fallthrough when entity metadata is missing', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), { version: '0.0.6' });
    await json(path.join(doc, 'entries.json'), [{ id: 'stale', content: {} }]);
    await assert.rejects(() => readEntries(root), /0\.0\.6.*entity_storage\.version = 1/);
  });

  it('rejects malformed entity-storage metadata instead of serving backups', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), { version: '0.0.6', entity_storage: { version: 2 } });
    await json(path.join(doc, 'entries.json'), [{ id: 'stale', content: {} }]);
    await assert.rejects(() => readEntries(root), /unsupported entity_storage version/);
  });

  it('rejects a current workspace whose migration receipt no longer matches its backups', async () => {
    const { root, doc } = await workspace();
    const config = currentConfig() as {
      entity_storage: { receipt: { entry_count: number } };
    };
    config.entity_storage.receipt.entry_count = 1;
    await json(path.join(doc, 'config.json'), config);
    await assert.rejects(() => readEntries(root), /receipt does not match/);
  });

  it('requires the system Package manifest and every active Package', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig({ active_macro_packages: ['ghost'] }));
    await assert.rejects(() => readActiveMacros(root), /ghost.*Package manifest/i);
    await rm(path.join(doc, packageManifestPath('_unpackaged')));
    await assert.rejects(() => readEntries(root), /requires the _unpackaged Package manifest/);
  });

  it('requires all current topology directories and forbids activating the system Package', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig({
      active_macro_packages: ['_unpackaged'],
    }));
    await assert.rejects(() => readEntries(root), /cannot activate.*_unpackaged/i);
    await json(path.join(doc, 'config.json'), currentConfig());
    await rm(path.join(doc, 'macros'), { recursive: true });
    await assert.rejects(() => readEntries(root), /missing required entity directory.*macros/i);
  });

  it('rejects future workspace versions instead of guessing their layout', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), { version: '0.0.7', entity_storage: { version: 1 } });
    await assert.rejects(() => readEntries(root), /Unsupported future workspace data version 0\.0\.7/);
  });

  it('rejects Macro entities that are not valid Macro v8 data', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig());
    await json(path.join(doc, macroEntityPath('_unpackaged', 'bad')), {
      format: 'snl-macro', version: 1, package: '_unpackaged',
      macro: {
        name: 'bad', description: '', source: { entries: [], urls: [] },
        dynamic_arity: false, tags: [],
        styles: [{ style_name: 'default', mode: 'text', template: 'bad', tags: [] }],
      },
    });
    await assert.rejects(() => readAllMacroPackages(root), /not valid Macro v8 data/);
  });

  it('rejects an entity whose filename does not match its logical identity', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig());
    await json(path.join(doc, 'entries/not-the-right-path.json'), {
      format: 'snl-entry', version: 1, package: '_unpackaged',
      entry: { id: 'x', package: '_unpackaged', content: {} },
    });
    await assert.rejects(() => readEntries(root), /does not match its logical identity path/);
  });

  it('rejects symlinked live entity files', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, 'config.json'), currentConfig());
    const outside = path.join(root, 'outside.json');
    await json(outside, {
      format: 'snl-entry', version: 1, package: '_unpackaged',
      entry: { id: 'x', package: '_unpackaged', content: {} },
    });
    await symlink(outside, path.join(doc, 'entries/linked.json'));
    await assert.rejects(() => readEntries(root), /must be a regular, non-symlink file/);
  });

  it('rejects a dangling config symlink instead of falling back to legacy storage', async () => {
    const { root, doc } = await workspace();
    await rm(path.join(doc, 'config.json'), { force: true });
    await symlink(path.join(root, 'missing-config-target.json'), path.join(doc, 'config.json'));
    await assert.rejects(() => readEntries(root), /regular, non-symlink file|ELOOP/i);
  });

  it('rejects a symlinked .SNL_Doc boundary in the core reader', async () => {
    const source = await workspace();
    await json(path.join(source.doc, 'config.json'), currentConfig());
    const root = await mkdtemp(path.join(tmpdir(), 'snl-toolkit-boundary-'));
    roots.push(root);
    await symlink(source.doc, path.join(root, '.SNL_Doc'));
    await assert.rejects(() => readEntries(root), /\.SNL_Doc.*symlink|regular, non-symlink directory/i);
  });

  it('rejects a symlinked config instead of following it', async () => {
    const { root, doc } = await workspace();
    const outside = path.join(root, 'outside-config.json');
    await json(outside, currentConfig());
    await symlink(outside, path.join(doc, 'config.json'));
    await assert.rejects(() => readEntries(root), /symlink|regular file|ELOOP/i);
  });
});
