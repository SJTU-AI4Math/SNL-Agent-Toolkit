import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { lintEntry } from '../lib/lint-entry.ts';
import { lintPackage } from '../lib/lint-package.ts';
import { tryParseSnlSyntaxTree } from '../lib/snl-parser.ts';
import { renderTreeAsLatex } from '../lib/snl-render.ts';
import { renameEntityId, renameStyle } from '../lib/entity-references.ts';
import {
  entryEntityPath,
  macroEntityPath,
  packageManifestPath,
} from '../lib/entity-storage.ts';
import { addEntryEntity, addMacroEntity, addPackageEntity } from '../lib/entity-writes.ts';
import {
  readActiveMacros,
  readAllMacroPackages,
  readEntries,
  readEntryKinds,
} from '../lib/snl-doc.ts';

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'workspace-v0.1.0');
const execFile = promisify(execFileCallback);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixtureCopy(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-v010-'));
  roots.push(root);
  await cp(path.join(FIXTURE, '.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  return root;
}

async function mutateJson(file: string, mutate: (value: Record<string, unknown>) => void): Promise<void> {
  const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  mutate(value);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

describe('SNL workspace v0.1.0 compatibility', () => {
  it('reads the real v0.1.0 fixture with exact Package schema v2 membership', async () => {
    const entries = await readEntries(FIXTURE);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'entry.localized');
  });

  it('rejects missing, extra, duplicate, and unsorted Package entry_ids', async () => {
    for (const entryIds of [
      [],
      ['entry.localized', 'entry.missing'],
      ['entry.localized', 'entry.localized'],
      ['entry.z', 'entry.localized'],
    ]) {
      const root = await fixtureCopy();
      await mutateJson(
        path.join(root, '.SNL_Doc', packageManifestPath('_unpackaged')),
        (manifest) => { manifest.entry_ids = entryIds; },
      );
      await assert.rejects(() => readEntries(root), /entry_ids/i);
    }
  });

  it('reads schema-v1 Macro envelopes as canonical Macro v11', async () => {
    const packages = await readAllMacroPackages(FIXTURE);
    assert.equal(packages.Logic.version, '11');
    assert.deepEqual(packages.Logic.macros['FOL.implies'].styles[0].template, {
      mode: 'formula_inline',
      body: '#0 \\to #1',
      latex: {
        built_in: '',
        synthesis: { mode: 'formula', macro: '#0 \\to #1' },
      },
    });
  });

  it('accepts localized Entry titles and localized themed Entry Kind labels', async () => {
    const entries = await readEntries(FIXTURE);
    const report = lintEntry(entries[0], {
      entryKinds: await readEntryKinds(FIXTURE),
      macros: await readActiveMacros(FIXTURE),
      siblingEntries: [],
    });
    assert.deepEqual(report.issues, []);
  });

  it('fails closed on future Entry envelope schema versions', async () => {
    const root = await fixtureCopy();
    const file = path.join(
      root,
      '.SNL_Doc/entries/_unpackaged-dce4a52e97d0e7f1530a.json',
    );
    await mutateJson(file, (value) => { value.schema_version = 2; });
    await assert.rejects(() => readEntries(root), /schema version 2 is newer/i);
  });

  it('fails closed on future Macro envelope schema versions', async () => {
    const root = await fixtureCopy();
    await mutateJson(
      path.join(root, '.SNL_Doc', macroEntityPath('Logic', 'FOL.implies')),
      (envelope) => { envelope.schema_version = 2; },
    );
    await assert.rejects(() => readActiveMacros(root), /schema version 2 is newer/i);
  });

  it('writes current Entry schema and atomically updates sorted Package membership', async () => {
    const root = await fixtureCopy();
    const result = await addEntryEntity(root, {
      id: 'entry.alpha',
      kind: 'definition',
      title: 'Alpha',
      content: {},
    });
    assert.equal(result.status, 'created');

    const entity = JSON.parse(await readFile(path.join(
      root,
      '.SNL_Doc',
      entryEntityPath('_unpackaged', 'entry.alpha'),
    ), 'utf8'));
    assert.equal(entity.schema_version, 1);
    const manifest = JSON.parse(await readFile(path.join(
      root,
      '.SNL_Doc',
      packageManifestPath('_unpackaged'),
    ), 'utf8'));
    assert.deepEqual(manifest.entry_ids, ['entry.alpha', 'entry.localized']);
    assert.deepEqual(manifest.vendor_extension, { keep: 'package' });
  });

  it('removes a newly installed Entry when its Package membership update loses a race', async () => {
    const root = await fixtureCopy();
    const manifestPath = path.join(root, '.SNL_Doc', packageManifestPath('_unpackaged'));
    await assert.rejects(
      addEntryEntity(root, {
        id: 'entry.raced',
        kind: 'definition',
        title: 'Raced',
        content: {},
      }, {
        beforePackageManifestInstall: async () => {
          await mutateJson(manifestPath, (manifest) => {
            manifest.concurrent_extension = true;
          });
        },
      }),
      /changed .*refusing/i,
    );
    await assert.rejects(
      readFile(path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.raced'))),
      /ENOENT/,
    );
    assert.equal((JSON.parse(await readFile(manifestPath, 'utf8'))).concurrent_extension, true);
  });

  it('writes minimal current Macro drafts as schema-v1 Macro v11', async () => {
    const root = await fixtureCopy();
    const result = await addMacroEntity(root, 'Logic', {
      name: 'FOL.and',
      styles: [{
        style_name: 'default',
        template: { mode: 'formula_inline', body: '#0 \\land #1' },
      }],
    });
    assert.equal(result.status, 'created');

    const envelope = JSON.parse(await readFile(path.join(
      root,
      '.SNL_Doc',
      macroEntityPath('Logic', 'FOL.and'),
    ), 'utf8'));
    assert.equal(envelope.schema_version, 1);
    assert.equal(envelope.macro.kind, 'const');
    assert.equal(Object.hasOwn(envelope.macro, 'default_style'), false);
    assert.deepEqual(envelope.macro.styles[0], {
      style_name: 'default',
      tags: [],
      template: { mode: 'formula_inline', body: '#0 \\land #1' },
    });
  });

  it('creates Package schema v2 manifests with an exact empty membership index', async () => {
    const root = await fixtureCopy();
    const result = await addPackageEntity(root, {
      id: 'Algebra',
      vendor_extension: { keep: 'new-package' },
    });
    assert.equal(result.status, 'created');

    const manifest = JSON.parse(await readFile(path.join(
      root,
      '.SNL_Doc',
      packageManifestPath('Algebra'),
    ), 'utf8'));
    assert.equal(manifest.schema_version, 2);
    assert.deepEqual(manifest.entry_ids, []);
    assert.deepEqual(manifest.vendor_extension, { keep: 'new-package' });
  });

  it('rejects legacy flat Kind colors in a current workspace', async () => {
    const root = await fixtureCopy();
    await mutateJson(path.join(root, '.SNL_Doc/config.json'), (config) => {
      const kinds = config.entry_kinds as Array<Record<string, unknown>>;
      kinds[0].coloring = { stroke: '#000', background: '#fff' };
    });
    await assert.rejects(
      () => readEntryKinds(root),
      /coloring.*light.*dark|light.*stroke/i,
    );
  });

  it('renders Macro v11 atomic template projections', async () => {
    const parsed = tryParseSnlSyntaxTree('FOL.implies(a,b)');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const rendered = renderTreeAsLatex(parsed.tree, await readActiveMacros(FIXTURE));
    assert.equal(rendered.output, 'a \\to b');
  });

  it('rewrites markerless Entries as schema v1 and keeps Package membership exact on rename', async () => {
    const root = await fixtureCopy();
    const oldPath = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized'));
    await mutateJson(oldPath, (envelope) => {
      delete envelope.schema_version;
    });

    await renameEntityId(root, 'entry', 'entry.localized', 'entry.renamed');

    const renamed = JSON.parse(await readFile(
      path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.renamed')),
      'utf8',
    ));
    assert.equal(renamed.schema_version, 1);
    assert.deepEqual(renamed.vendor_extension, { keep: 'envelope' });
    const manifest = JSON.parse(await readFile(
      path.join(root, '.SNL_Doc', packageManifestPath('_unpackaged')),
      'utf8',
    ));
    assert.deepEqual(manifest.entry_ids, ['entry.renamed']);
  });

  it('rewrites markerless Macros as schema v1 on rename without losing extensions', async () => {
    const root = await fixtureCopy();
    const oldPath = path.join(root, '.SNL_Doc', macroEntityPath('Logic', 'FOL.implies'));
    await mutateJson(oldPath, (envelope) => {
      delete envelope.schema_version;
    });

    await renameEntityId(root, 'macro', 'FOL.implies', 'FOL.entails');

    const renamed = JSON.parse(await readFile(
      path.join(root, '.SNL_Doc', macroEntityPath('Logic', 'FOL.entails')),
      'utf8',
    ));
    assert.equal(renamed.schema_version, 1);
    assert.deepEqual(renamed.macro.vendor_extension, { keep: 'macro' });
    assert.equal((await readEntries(root))[0].content.snl, 'FOL.entails');
  });

  it('renames Macro v11 styles and stamps markerless rewritten envelopes', async () => {
    const root = await fixtureCopy();
    const macroPath = path.join(root, '.SNL_Doc', macroEntityPath('Logic', 'FOL.implies'));
    const entryPath = path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'entry.localized'));
    await mutateJson(macroPath, (envelope) => {
      delete envelope.schema_version;
    });
    await mutateJson(entryPath, (envelope) => {
      (envelope.entry as { content: { snl: string } }).content.snl = 'FOL.implies[default]';
    });

    await renameStyle(root, 'Logic', 'FOL.implies', 'default', 'compact');

    const macro = JSON.parse(await readFile(macroPath, 'utf8'));
    assert.equal(macro.schema_version, 1);
    assert.equal(macro.macro.styles[0].style_name, 'compact');
    assert.equal((await readEntries(root))[0].content.snl, 'FOL.implies[compact]');
  });

  it('keeps rename CLI failures machine-readable under --json', async () => {
    for (const args of [
      ['bin/snl-rename-id.mjs', '--json', '--type', 'entry', 'only-one-id'],
      ['bin/snl-rename-style.mjs', '--json', '--package', 'Logic', '--macro', 'FOL.implies', 'only-one-style'],
    ]) {
      await assert.rejects(
        execFile(process.execPath, args, { cwd: path.join(import.meta.dirname, '..') }),
        (error: unknown) => {
          const failure = error as { stdout: string; stderr: string };
          assert.equal(failure.stderr, '');
          assert.equal(JSON.parse(failure.stdout).status, 'error');
          return true;
        },
      );
    }
  });

  it('rejects malformed Macro v11 lexical fields and KaTeX templates', () => {
    const report = lintPackage({
      version: '11',
      name: 'Invalid',
      macros: {
        bad: {
          description: '',
          source: { entries: [], urls: [] },
          kind: 'const',
          dynamic_arity: false,
          styles: [{
            style_name: 'bad-name!',
            tags: ['bad\\tag'],
            template: { mode: 'formula_inline', body: '\\frac{#foo' },
          }],
          tags: ['bad\\tag'],
        },
      },
    });
    assert.ok(report.issues.some((issue) => issue.code === 'package.macro-v11'));
    assert.ok(report.issues.some((issue) => issue.code === 'style.katex-compile'));
  });
});
