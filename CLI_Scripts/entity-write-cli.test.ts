import assert from 'node:assert/strict';
import { watch } from 'node:fs';
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
import { readActiveMacros, readAllMacroPackages, readConfig, readEntries } from '../lib/snl-doc.ts';
import { addMacroEntity, addPackageEntity } from '../lib/entity-writes.ts';

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
    maxBuffer: 16 * 1024 * 1024,
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
    await assert.rejects(() => stat(path.join(doc, '.data-write.lock')), { code: 'ENOENT' });
  });

  it('canonicalizes Entry identity fields exactly like Extension addEntry', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'entry-spaces.json');
    await json(draft, {
      id: '  entry.trimmed  ', kind: '  definition  ', title: '  Trimmed title  ', content: {},
    });
    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.id, 'entry.trimmed');
    assert.equal(payload.path, entryEntityPath('_unpackaged', 'entry.trimmed'));
    assert.deepEqual(await readEntries(root), [{
      id: 'entry.trimmed', kind: 'definition', title: 'Trimmed title', content: {},
      contribution_info: null, pointer: null, package: '_unpackaged',
    }]);
  });

  it('accepts authoritative localized Entry output dialects', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'entry-i18n.json');
    const localized = {
      type: 'i18n', default_language: 'en', values: { en: 'Hello', zh: '你好' },
    };
    await json(draft, {
      id: 'entry.i18n', kind: 'definition', content: { markdown: localized },
    });
    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual((await readEntries(root))[0].content.markdown, localized);
  });

  it('rejects empty Macro templates like Extension addMacro', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    const draft = path.join(root, 'macro-empty.json');
    await json(draft, {
      name: 'Empty.template',
      styles: [{ style_name: 'default', mode: 'text', template: '   ' }],
    });
    const result = run(root, 'snl-add-macro', ['--package', 'Logic', draft]);
    assert.equal(result.status, 1);
    assert.ok(JSON.parse(result.stdout).issues.some((issue: { code: string }) =>
      issue.code === 'style.missing-template'));
  });

  it('does not report an existing Package inactive when active_macro_packages is absent', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    const configFile = path.join(doc, 'config.json');
    const config = JSON.parse(await readFile(configFile, 'utf8'));
    delete config.active_macro_packages;
    await json(configFile, config);
    const draft = path.join(root, 'macro.json');
    await json(draft, {
      name: 'Logic.term',
      styles: [{ style_name: 'default', mode: 'text', template: 'term' }],
    });
    const result = run(root, 'snl-add-macro', ['--package', 'Logic', draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout).issues, []);
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

  it('round-trips prototype-like Macro identities through Package and active maps', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    const configFile = path.join(doc, 'config.json');
    const config = JSON.parse(await readFile(configFile, 'utf8'));
    config.active_macro_packages = ['Logic'];
    await json(configFile, config);
    const draft = path.join(root, 'macro-proto.json');
    await json(draft, {
      name: '__proto__',
      styles: [{ style_name: 'default', mode: 'text', template: 'prototype' }],
    });
    const result = run(root, 'snl-add-macro', ['--package', 'Logic', draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const packages = await readAllMacroPackages(root);
    assert.equal(Object.hasOwn(packages.Logic.macros, '__proto__'), true);
    assert.equal(Object.hasOwn(await readActiveMacros(root), '__proto__'), true);
  });

  it('flushes large JSON diagnostics before exiting', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    const draft = path.join(root, 'macro-many-errors.json');
    await json(draft, {
      name: 'Many.errors',
      styles: Array.from({ length: 3000 }, (_, index) => ({
        style_name: `bad style ${index}`, mode: 'invalid', template: null,
      })),
    });
    const result = run(root, 'snl-add-macro', ['--package', 'Logic', draft]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\n$/);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'invalid');
    assert.ok(payload.issues.length >= 3000);
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

  it('Package creation preserves legacy effective activation and canonicalizes author text', async () => {
    const { root, doc } = await workspace();
    await json(path.join(doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    const configFile = path.join(doc, 'config.json');
    const config = JSON.parse(await readFile(configFile, 'utf8'));
    delete config.active_macro_packages;
    await json(configFile, config);
    const draft = path.join(root, 'package.json');
    await json(draft, { id: 'New', name: '  New display  ', description: '  description  ' });

    const result = run(root, 'snl-add-package', [draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const written = await readAllMacroPackages(root);
    assert.equal(written.New.name, 'New display');
    assert.equal(written.New.description, 'description');
    assert.deepEqual((await readConfig(root)).active_macro_packages, ['Logic', 'New']);
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

  it('Package creation rolls back its manifest on config conflict and is retry-safe', async () => {
    const { root, doc } = await workspace();
    const configFile = path.join(doc, 'config.json');
    const manifestFile = path.join(doc, packageManifestPath('Logic'));
    const concurrentConfig = JSON.parse(await readFile(configFile, 'utf8'));
    concurrentConfig.vendor_extension = { keep: 'concurrent' };

    await assert.rejects(() => addPackageEntity(root, { id: 'Logic' }, {
      beforeConfigInstall: async () => json(configFile, concurrentConfig),
    }), /changed.*refusing/i);
    assert.deepEqual(JSON.parse(await readFile(configFile, 'utf8')).vendor_extension, { keep: 'concurrent' });
    await assert.rejects(() => stat(manifestFile), { code: 'ENOENT' });

    const retry = await addPackageEntity(root, { id: 'Logic' });
    assert.equal(retry.status, 'created');
    assert.equal((await stat(manifestFile)).isFile(), true);
  });

  it('Package creation never unlinks a concurrently replaced manifest on config failure', async () => {
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
    }), /rollback.*failed.*concurrent|rollback.*failed.*changed/is);
    assert.deepEqual(JSON.parse(await readFile(manifestFile, 'utf8')), concurrentManifest);
    assert.deepEqual(JSON.parse(await readFile(configFile, 'utf8')).vendor_extension, { keep: 'concurrent' });
  });

  it('rolls back its own manifest on config failure under effective-all semantics', async () => {
    const { root, doc } = await workspace();
    const configFile = path.join(doc, 'config.json');
    const manifestFile = path.join(doc, packageManifestPath('Logic'));
    const config = JSON.parse(await readFile(configFile, 'utf8'));
    delete config.active_macro_packages;
    await json(configFile, config);
    const concurrentConfig = { ...config, vendor_extension: { keep: 'concurrent' } };

    await assert.rejects(() => addPackageEntity(root, { id: 'Logic' }, {
      beforeConfigInstall: async () => json(configFile, concurrentConfig),
    }), /changed.*refusing/i);
    await assert.rejects(() => stat(manifestFile), { code: 'ENOENT' });
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

  it('agent JSON help is itself one parseable JSON document', async () => {
    const { root } = await workspace();
    for (const cli of ['snl-add-entry', 'snl-add-macro', 'snl-add-package']) {
      const result = run(root, cli, ['--help']);
      assert.equal(result.status, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.status, 'help');
      assert.match(payload.usage, new RegExp(cli));
    }
  });

  it('distinguishes corrupt workspace JSON from invalid draft JSON', async () => {
    const { root, doc } = await workspace();
    const draft = path.join(root, 'entry.json');
    await json(draft, { id: 'entry.config-corrupt', kind: 'definition', content: {} });
    await writeFile(path.join(doc, 'config.json'), '{', 'utf8');
    const result = run(root, 'snl-add-entry', [draft]);
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).code, 'workspace.write-failed');
  });

  it('distinguishes missing workspace paths from unreadable draft paths', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'entry.json');
    await json(draft, { id: 'entry.missing-root', kind: 'definition', content: {} });
    const detachedRoot = await mkdtemp(path.join(tmpdir(), 'snl-entry-draft-'));
    roots.push(detachedRoot);
    const detachedDraft = path.join(detachedRoot, 'entry.json');
    await json(detachedDraft, JSON.parse(await readFile(draft, 'utf8')));
    await rm(root, { recursive: true, force: true });
    const workspaceResult = run(root, 'snl-add-entry', [detachedDraft]);
    assert.equal(workspaceResult.status, 2);
    assert.equal(JSON.parse(workspaceResult.stdout).code, 'workspace.write-failed');
    const inputResult = run(root, 'snl-add-entry', [`${detachedDraft}.missing`]);
    assert.equal(inputResult.status, 2);
    assert.equal(JSON.parse(inputResult.stdout).code, 'input.read-failed');
    await rm(detachedDraft, { force: true });
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

  it('safe defaults apply only to omitted fields, not explicit invalid nulls', async () => {
    const entryWorkspace = await workspace();
    const entryDraft = path.join(entryWorkspace.root, 'entry-null.json');
    await json(entryDraft, { id: 'entry.null', kind: 'definition', content: null });
    const entryResult = run(entryWorkspace.root, 'snl-add-entry', [entryDraft]);
    assert.equal(entryResult.status, 1);
    assert.equal(JSON.parse(entryResult.stdout).status, 'invalid');

    const macroWorkspace = await workspace();
    await json(path.join(macroWorkspace.doc, packageManifestPath('Logic')), {
      format: 'snl-package', version: 1, id: 'Logic', name: 'Logic', description: '',
    });
    const macroDraft = path.join(macroWorkspace.root, 'macro-null.json');
    await json(macroDraft, {
      name: 'Term.null', source: null,
      styles: [{ style_name: 'default', mode: 'text', template: 'term' }],
    });
    const macroResult = run(macroWorkspace.root, 'snl-add-macro', ['--package', 'Logic', macroDraft]);
    assert.equal(macroResult.status, 1);
    assert.equal(JSON.parse(macroResult.stdout).status, 'invalid');

    const packageWorkspace = await workspace();
    const packageDraft = path.join(packageWorkspace.root, 'package-null.json');
    await json(packageDraft, { id: 'Logic', name: null });
    const packageResult = run(packageWorkspace.root, 'snl-add-package', [packageDraft]);
    assert.equal(packageResult.status, 1);
    assert.equal(JSON.parse(packageResult.stdout).status, 'invalid');
  });

  it('rejects a symlinked .SNL_Doc before creating a lock in its target', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'snl-add-cli-doc-link-'));
    const external = await mkdtemp(path.join(tmpdir(), 'snl-add-cli-external-doc-'));
    roots.push(root, external);
    await symlink(external, path.join(root, '.SNL_Doc'), 'dir');
    const packageDraft = path.join(root, 'package.json');
    const macroDraft = path.join(root, 'macro.json');
    const entryDraft = path.join(root, 'entry.json');
    await Promise.all([
      json(packageDraft, { id: 'Logic' }),
      json(macroDraft, { name: 'Logic.term', styles: [{ style_name: 'default', mode: 'text', template: 'term' }] }),
      json(entryDraft, { id: 'entry.doc-link', kind: 'definition', content: {} }),
    ]);
    const events: string[] = [];
    const watcher = watch(external, (_event, filename) => events.push(String(filename)));
    try {
      const invocations: Array<[string, string[]]> = [
        ['snl-add-package', [packageDraft]],
        ['snl-add-macro', ['--package', 'Logic', macroDraft]],
        ['snl-add-entry', [entryDraft]],
      ];
      for (const [cli, args] of invocations) {
        const result = run(root, cli, args);
        assert.equal(result.status, 2);
        assert.match(JSON.parse(result.stdout).message, /\.SNL_Doc.*real directory.*symlink/i);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      watcher.close();
    }
    assert.deepEqual(events, []);
    await assert.rejects(() => stat(path.join(external, '.data-write.lock')), { code: 'ENOENT' });
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
