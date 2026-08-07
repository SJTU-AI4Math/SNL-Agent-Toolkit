import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  entryEntityPath,
  macroEntityPath,
  makeEntityStorageReceipt,
  packageManifestPath,
} from '../lib/entity-storage.ts';
import { readAllMacroPackages, readConfig, readEntries } from '../lib/snl-doc.ts';
import { addPackageEntity } from '../lib/entity-writes.ts';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function json(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function workspace(): Promise<{ root: string; doc: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-add-cli-'));
  roots.push(root);
  const doc = path.join(root, '.SNL_Doc');
  await Promise.all([
    mkdir(path.join(doc, 'entries'), { recursive: true }),
    mkdir(path.join(doc, 'macros'), { recursive: true }),
    mkdir(path.join(doc, 'packages'), { recursive: true }),
  ]);
  await json(path.join(doc, packageManifestPath('_unpackaged')), {
    format: 'snl-package', version: 1, id: '_unpackaged', name: 'Unpackaged', description: '',
  });
  await json(path.join(doc, 'config.json'), {
    version: '0.0.6',
    entry_kinds: [{
      id: 'definition', name: 'Definition',
      coloring: { stroke: '#000000', background: '#ffffff' },
      defaultCounterName: 'definition', style: '',
    }],
    macro_kinds: [],
    active_macro_packages: [],
    vendor_extension: { keep: true },
    entity_storage: {
      version: 1,
      legacy_backup_version: '0.0.5',
      entry_default_package: '_unpackaged',
      receipt: makeEntityStorageReceipt(null, new Map(), false),
    },
  });
  return { root, doc };
}

function run(root: string, cli: string, args: string[]) {
  return spawnSync(process.execPath, [`bin/${cli}.mjs`, '--root', root, '--json', ...args], {
    cwd: path.resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
}

describe('agent-facing entity write CLIs', () => {
  it('snl-add-entry accepts a minimal draft and owns package, envelope, hash path, and defaults', async () => {
    const { root, doc } = await workspace();
    const draft = path.join(root, 'entry-draft.json');
    await json(draft, { id: 'entry.demo', kind: 'definition', content: { snl: '' } });

    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), {
      status: 'created',
      entity: 'entry',
      id: 'entry.demo',
      package: '_unpackaged',
      path: entryEntityPath('_unpackaged', 'entry.demo'),
      issues: [],
    });
    assert.deepEqual(await readEntries(root), [{
      id: 'entry.demo',
      kind: 'definition',
      title: '',
      content: { snl: '' },
      contribution_info: null,
      pointer: null,
      package: '_unpackaged',
    }]);
    await assert.doesNotReject(() => writeFile(path.join(doc, '.probe'), ''));
  });

  it('snl-add-entry returns structured validation errors and writes nothing', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'bad-entry.json');
    await json(draft, { id: 'entry.bad' });

    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 1, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'invalid');
    assert(payload.issues.some((issue: { code: string }) => issue.code === 'entry.missing-kind'));
    assert.deepEqual(await readEntries(root), []);
  });

  it('snl-add-entry reports an identity conflict without replacing the existing Entry', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'entry.json');
    await json(draft, { id: 'entry.same', kind: 'definition', content: {} });
    assert.equal(run(root, 'snl-add-entry', [draft]).status, 0);
    const before = await readEntries(root);

    await json(draft, { id: 'entry.same', kind: 'definition', title: 'replacement', content: {} });
    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 1, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'conflict');
    assert.equal(payload.code, 'entry.duplicate-id');
    assert.deepEqual(await readEntries(root), before);
  });

  it('snl-add-macro accepts a minimal draft and owns Macro v8 defaults, envelope, and hash path', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    const draft = path.join(root, 'macro.json');
    await json(draft, {
      name: 'FOL.implies',
      styles: [{ style_name: 'default', mode: 'formula_inline', template: '#0 \\to #1' }],
    });

    const result = run(root, 'snl-add-macro', ['--package', 'Logic', draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), {
      status: 'created', entity: 'macro', name: 'FOL.implies', package: 'Logic',
      path: macroEntityPath('Logic', 'FOL.implies'),
      issues: [{
        severity: 'info',
        code: 'macro.package-inactive',
        message: 'Package "Logic" is not active; the Macro is stored but will not resolve until the Package is activated.',
        path: 'package',
      }],
    });
    assert.deepEqual((await readAllMacroPackages(root)).Logic.macros['FOL.implies'], {
      description: '',
      source: { entries: [], urls: [] },
      dynamic_arity: false,
      default_style: { en: 'default' },
      tags: [],
      styles: [{
        style_name: 'default', mode: 'formula_inline', template: '#0 \\to #1', tags: [],
      }],
    });
  });

  it('snl-add-package accepts a minimal draft, writes the hashed manifest, and activates it', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'package.json');
    await json(draft, { id: 'Logic' });

    const result = run(root, 'snl-add-package', [draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), {
      status: 'created', entity: 'package', id: 'Logic',
      path: packageManifestPath('Logic'), active: true,
    });
    assert.deepEqual((await readAllMacroPackages(root)).Logic, {
      version: '8', name: 'Logic', description: '', macros: {},
    });
    const config = await readConfig(root) as unknown as Record<string, unknown>;
    assert.deepEqual(config.active_macro_packages, ['Logic']);
    assert.deepEqual(config.vendor_extension, { keep: true });
  });

  it('write CLIs reject a structurally invalid current config before writing', async () => {
    const { root, doc } = await workspace();
    const config = JSON.parse(await readFile(path.join(doc, 'config.json'), 'utf8'));
    config.entry_kinds = {};
    await json(path.join(doc, 'config.json'), config);
    const draft = path.join(root, 'package.json');
    await json(draft, { id: 'Logic' });

    const result = run(root, 'snl-add-package', [draft]);
    assert.equal(result.status, 2, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'error');
    assert.match(payload.message, /entry_kinds.*array/);
    await assert.rejects(() => stat(path.join(doc, packageManifestPath('Logic'))), { code: 'ENOENT' });
  });

  it('Package creation preserves a concurrent config edit and rolls back its new manifest', async () => {
    const { root, doc } = await workspace();
    const configFile = path.join(doc, 'config.json');
    const concurrentConfig = JSON.parse(await readFile(configFile, 'utf8'));
    concurrentConfig.vendor_extension = { keep: 'concurrent' };

    await assert.rejects(() => addPackageEntity(root, { id: 'Logic' }, {
      beforeConfigInstall: async () => json(configFile, concurrentConfig),
    }), /changed during Package creation/);
    assert.deepEqual(JSON.parse(await readFile(configFile, 'utf8')).vendor_extension, { keep: 'concurrent' });
    await assert.rejects(() => stat(path.join(doc, packageManifestPath('Logic'))), { code: 'ENOENT' });
  });

  it('Package creation reports rollback residue instead of deleting a concurrent manifest edit', async () => {
    const { root, doc } = await workspace();
    const configFile = path.join(doc, 'config.json');
    const manifestFile = path.join(doc, packageManifestPath('Logic'));
    const concurrentConfig = JSON.parse(await readFile(configFile, 'utf8'));
    concurrentConfig.vendor_extension = { keep: 'concurrent' };
    const concurrentManifest = {
      format: 'snl-package', version: 1, id: 'Logic', name: 'External', description: '',
      vendor_extension: { keep: true },
    };

    await assert.rejects(() => addPackageEntity(root, { id: 'Logic' }, {
      beforeConfigInstall: async () => {
        await json(manifestFile, concurrentManifest);
        await json(configFile, concurrentConfig);
      },
    }), /rollback.*manifest.*preserved|workspace may contain/i);
    assert.deepEqual(JSON.parse(await readFile(manifestFile, 'utf8')), concurrentManifest);
    assert.deepEqual(JSON.parse(await readFile(configFile, 'utf8')).vendor_extension, { keep: 'concurrent' });
  });

  it('agent JSON mode reports invocation errors as JSON on stdout', async () => {
    const { root } = await workspace();
    const result = run(root, 'snl-add-entry', []);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      status: 'error', code: 'usage',
      message: 'snl-add-entry requires exactly one draft JSON file.',
    });
  });

  it('JSON mode classifies invalid draft JSON without touching storage', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'broken.json');
    await writeFile(draft, '{', 'utf8');
    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, '');
    assert.equal(JSON.parse(result.stdout).code, 'input.invalid-json');
    assert.deepEqual(await readEntries(root), []);
  });

  it('snl-add-macro rejects a missing Package without creating an entity', async () => {
    const { root, doc } = await workspace();
    const draft = path.join(root, 'macro.json');
    await json(draft, {
      name: 'Missing.term',
      styles: [{ style_name: 'default', mode: 'text', template: 'term' }],
    });
    const result = run(root, 'snl-add-macro', ['--package', 'Missing', draft]);
    assert.equal(result.status, 1, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'invalid');
    assert.ok(payload.issues.some((issue: { code: string }) => issue.code === 'macro.package-not-found'));
    await assert.rejects(() => stat(path.join(doc, macroEntityPath('Missing', 'Missing.term'))), { code: 'ENOENT' });
  });

  it('write CLIs honor an existing writer lock', async () => {
    const { root, doc } = await workspace();
    await writeFile(path.join(doc, '.data-write.lock'), 'not removable by this writer\n', 'utf8');
    const draft = path.join(root, 'entry.json');
    await json(draft, { id: 'entry.locked', kind: 'definition', content: {} });
    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 2);
    assert.match(JSON.parse(result.stdout).message, /locked/);
    assert.deepEqual(await readEntries(root), []);
  });

  it('write CLIs reject a symlinked workspace root instead of writing through it', async () => {
    const source = await workspace();
    const parent = await mkdtemp(path.join(tmpdir(), 'snl-add-alias-'));
    roots.push(parent);
    const alias = path.join(parent, 'workspace-link');
    await symlink(source.root, alias, 'dir');
    const draft = path.join(parent, 'entry.json');
    await json(draft, { id: 'entry.alias', kind: 'definition', content: {} });

    const result = run(alias, 'snl-add-entry', [draft]);
    assert.equal(result.status, 2, result.stderr);
    assert.match(JSON.parse(result.stdout).message, /symlink|canonical workspace/i);
    assert.deepEqual(await readEntries(source.root), []);
  });
});
