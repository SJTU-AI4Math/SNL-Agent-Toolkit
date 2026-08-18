import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  applyEntityRename,
  applyStyleRename,
  findEntityReferences,
  planEntityRename,
  planStyleRename,
  renameEntityId,
  scanSnlReferences,
} from '../lib/entity-references.ts';
import {
  entryEntityPath,
  macroEntityPath,
  makeEntityStorageReceipt,
  packageManifestPath,
} from '../lib/entity-storage.ts';
import { migrateMacroPackageV6toV8 } from '../lib/migrate-macro-package.ts';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snl-refs-'));
  roots.push(root);
  const doc = path.join(root, '.SNL_Doc');
  await fs.mkdir(path.join(doc, 'term_macros'), { recursive: true });
  await fs.mkdir(path.join(doc, 'libraries', 'demo'), { recursive: true });
  const entriesRaw = JSON.stringify([
    {
      id: 'entry.old', kind: 'definition', title: 'Old',
      content: { snl: 'Macro.old(x@entry.old, @Macro.old, y, Macro.old[entry.old], %Macro.old%, $Macro.old$)' },
      contribution_info: { text: 'entry.old must stay opaque' }, pointer: { huge: '__HUGE__' },
    },
    {
      id: 'entry.user', kind: 'theorem', title: 'User',
      content: { snl: 'Macro.old(z@entry.old)' }, contribution_info: null, pointer: null,
    },
  ], null, 2).replace('"__HUGE__"', '9007199254740993') + '\n';
  await fs.writeFile(path.join(doc, 'entries.json'), entriesRaw, { encoding: 'utf8', mode: 0o640 });
  await fs.writeFile(path.join(doc, 'term_macros', 'demo.json'), JSON.stringify({
    version: '0.0.3', name: 'Demo', macros: {
      'Macro.old': {
        description: 'old', source: { entries: ['entry.old'], urls: [] },
        dynamic_arity: false,
        styles: [{ tag: 'default', mode: 'formula_inline', template: '#0' }],
      },
      '中文名': {
        description: 'JSON-only Unicode identity', source: { entries: [], urls: [] },
        dynamic_arity: false,
        styles: [{ tag: 'default', mode: 'text', template: '中文' }],
      },
    },
  }, null, 2) + '\n');
  const graphRaw = JSON.stringify({
    nodes: [{ id: 'local', label: 'Entry', props: { entryId: 'entry.old', keep: 'entry.old' } }],
    relationships: [],
  }, null, 2).replace(/\n/g, '\r\n') + '\r\n';
  await fs.writeFile(path.join(doc, 'libraries', 'demo', 'graph.json'), graphRaw);
  // Reference tooling owns graph.json, not arbitrary adjacent JSON artifacts.
  await fs.writeFile(path.join(doc, 'libraries', 'demo', 'draft.json'), '{not-json\n');
  await fs.writeFile(path.join(doc, 'relationships.json'), JSON.stringify({
    version: 1,
    relationships: [{ id: 'r', from: 'entry.old', to: 'entry.user', label: 'uses', metadata: { keep: 'entry.old' } }],
  }, null, 2) + '\n');
  return root;
}

async function entityFixture(): Promise<string> {
  const root = await fixture();
  const doc = path.join(root, '.SNL_Doc');
  const entries = JSON.parse(await fs.readFile(path.join(doc, 'entries.json'), 'utf8'));
  const legacyEntries = structuredClone(entries);
  const legacyPackage = JSON.parse(
    await fs.readFile(path.join(doc, 'term_macros/demo.json'), 'utf8'),
  );
  const pkg = migrateMacroPackageV6toV8(legacyPackage);
  await fs.mkdir(path.join(doc, 'entries'));
  await fs.mkdir(path.join(doc, 'macros'));
  await fs.mkdir(path.join(doc, 'packages'));
  for (const entry of entries) {
    entry.package = '_unpackaged';
    await fs.writeFile(
      path.join(doc, entryEntityPath('_unpackaged', entry.id)),
      JSON.stringify({ format: 'snl-entry', version: 1, package: '_unpackaged', entry }, null, 2) + '\n',
    );
  }
  await fs.writeFile(
    path.join(doc, packageManifestPath('demo')),
    JSON.stringify({ format: 'snl-package', version: 1, id: 'demo', name: 'Demo', description: '' }, null, 2) + '\n',
  );
  await fs.writeFile(
    path.join(doc, packageManifestPath('_unpackaged')),
    JSON.stringify({ format: 'snl-package', version: 1, id: '_unpackaged', name: 'Unpackaged', description: '' }, null, 2) + '\n',
  );
  for (const [name, value] of Object.entries(pkg.macros)) {
    await fs.writeFile(
      path.join(doc, macroEntityPath('demo', name)),
      JSON.stringify({ format: 'snl-macro', version: 1, package: 'demo', macro: { name, ...(value as object) } }, null, 2) + '\n',
    );
  }
  await fs.writeFile(
    path.join(doc, 'config.json'),
    JSON.stringify({
      version: '0.0.6',
      active_macro_packages: ['demo'],
      entity_storage: {
        version: 1,
        legacy_backup_version: '0.0.5',
        entry_default_package: '_unpackaged',
        receipt: makeEntityStorageReceipt(legacyEntries, new Map([['demo.json', legacyPackage]]), true),
      },
    }, null, 2) + '\n',
  );
  return root;
}

async function styleFixture(): Promise<{ root: string; targetPath: string }> {
  const root = await entityFixture();
  const targetPath = path.join(root, '.SNL_Doc', macroEntityPath('demo', 'Macro.old'));
  const envelope = JSON.parse(await fs.readFile(targetPath, 'utf8'));
  envelope.macro.default_style = { en: 'shared', zh: 'shared' };
  envelope.macro.styles.push({
    style_name: 'shared', mode: 'formula_inline', template: '#0', tags: [],
  });
  await fs.writeFile(targetPath, JSON.stringify(envelope, null, 2) + '\n');
  return { root, targetPath };
}

describe('SNL structured reference scanner', () => {
  it('separates macro tokens, src-postfix Entry refs, style tags, and literal environments', () => {
    const refs = scanSnlReferences(
      'Macro.old(x@entry.old, @Macro.old, y, Macro.old[entry.old], %Macro.old%, $Macro.old$)',
    );
    assert.deepEqual(
      refs.map((r) => [r.entityType, r.id]),
      [
        ['macro', 'Macro.old'], ['entry', 'entry.old'],
        ['macro', 'y'], ['macro', 'Macro.old'],
      ],
    );
  });

  it('distinguishes Tree3 local-source postfixes from Entry postfixes', () => {
    const refs = scanSnlReferences('root(@x, x@#x, x@#0.0, x@entry.old, $raw$, `fmt`)');
    assert.deepEqual(refs.map((r) => [r.entityType, r.id]), [
      ['macro', 'root'], ['entry', 'entry.old'],
    ]);
    const resolved = scanSnlReferences('root(@x, x@#x, x@#0.0, x@entry.old)', {
      postfixedMacroNames: new Set(['x']),
    });
    assert.deepEqual(resolved.map((r) => [r.entityType, r.id]), [
      ['macro', 'root'], ['macro', 'x'], ['macro', 'x'], ['macro', 'x'], ['entry', 'entry.old'],
    ]);
  });
});

describe('findEntityReferences', () => {
  it('finds every structured Entry definition/reference without opaque-string false positives', async () => {
    const root = await fixture();
    const refs = await findEntityReferences(root, 'entry', 'entry.old');
    assert.equal(refs.filter((r) => r.role === 'definition').length, 1);
    assert.deepEqual(
      refs.filter((r) => r.role === 'reference').map((r) => `${r.file}:${r.path}`).sort(),
      [
        'entries.json:[0].content.snl',
        'entries.json:[1].content.snl',
        'libraries/demo/graph.json:nodes[0].props.entryId',
        'relationships.json:relationships[0].from',
        'term_macros/demo.json:macros["Macro.old"].source.entries[0]',
      ],
    );
    assert.ok(refs.some((r) => r.offset !== undefined && r.snlLine === 1));
  });

  it('finds Macro definitions and all real SNL macro tokens', async () => {
    const root = await fixture();
    const refs = await findEntityReferences(root, 'macro', 'Macro.old');
    assert.equal(refs.filter((r) => r.role === 'definition').length, 1);
    assert.equal(refs.filter((r) => r.role === 'reference').length, 3);
  });

  it('finds JSON-only Unicode Macro identities', async () => {
    const root = await fixture();
    const refs = await findEntityReferences(root, 'macro', '中文名');
    assert.equal(refs.length, 1);
    assert.equal(refs[0].role, 'definition');
  });
});

describe('renameEntityId', () => {
  it('binds every reviewed Entity identity and planned output to the plan fingerprint', async () => {
    const root = await fixture();
    const plan = await planEntityRename(root, 'entry', 'entry.old', 'entry.new');
    assert.match((plan as any).fingerprint, /^[a-f0-9]{64}$/);
    assert.ok((plan as any).plannedOutputs.length > 0);

    const mutations: Array<(candidate: any) => void> = [
      (candidate) => { candidate.entityType = 'macro'; },
      (candidate) => { candidate.oldId = 'entry.user'; },
      (candidate) => { candidate.newId = 'entry.unreviewed'; },
      (candidate) => { candidate.plannedOutputs[0].sourceFile = 'unreviewed-source.json'; },
      (candidate) => { candidate.plannedOutputs[0].targetFile = 'unreviewed-target.json'; },
      (candidate) => { candidate.plannedOutputs[0].sha256 = '0'.repeat(64); },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(plan) as any;
      mutate(candidate);
      await assert.rejects(applyEntityRename(root, candidate), /plan integrity check failed/i);
    }
    assert.equal((await findEntityReferences(root, 'entry', 'entry.new')).length, 0);
    assert.equal((await findEntityReferences(root, 'entry', 'entry.old')).filter((item) => item.role === 'definition').length, 1);
  });

  it('rejects stateful Entity plan accessors before they can swap the reviewed operation', async () => {
    const root = await fixture();
    const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
    const before = await fs.readFile(entriesPath, 'utf8');
    const reviewed = await planEntityRename(root, 'entry', 'entry.old', 'entry.new');
    const unreviewed = await planEntityRename(root, 'entry', 'entry.old', 'entry.unreviewed');
    let fingerprintReads = 0;
    const attacker: Record<string, unknown> = {};
    for (const key of Object.keys(reviewed) as Array<keyof typeof reviewed>) {
      Object.defineProperty(attacker, key, {
        enumerable: true,
        get: () => {
          if (key === 'fingerprint') fingerprintReads += 1;
          return (fingerprintReads > 4 ? unreviewed : reviewed)[key];
        },
      });
    }

    await assert.rejects(
      applyEntityRename(root, attacker as any),
      /must be inert plain JSON data|inert enumerable data property|plan integrity check failed/i,
    );
    assert.equal(await fs.readFile(entriesPath, 'utf8'), before);
    assert.equal((await findEntityReferences(root, 'entry', 'entry.unreviewed')).length, 0);
  });

  it('rejects Proxy and nested accessor Entity plans without writing', async () => {
    for (const attack of ['proxy', 'nested-accessor'] as const) {
      const root = await fixture();
      const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
      const before = await fs.readFile(entriesPath, 'utf8');
      const plan = await planEntityRename(root, 'entry', 'entry.old', 'entry.new');
      const attacker = attack === 'proxy' ? new Proxy(plan, {}) : structuredClone(plan);
      if (attack === 'nested-accessor') {
        const value = attacker.plannedOutputs[0].targetFile;
        Object.defineProperty(attacker.plannedOutputs[0], 'targetFile', {
          enumerable: true,
          get: () => value,
        });
      }

      await assert.rejects(
        applyEntityRename(root, attacker),
        /must be inert plain JSON data|inert enumerable data property|plan integrity check failed/i,
      );
      assert.equal(await fs.readFile(entriesPath, 'utf8'), before);
    }
  });

  it('rejects numeric-looking extra own keys on plan Arrays before writing', async () => {
    for (const arrayField of ['changedFiles', 'plannedOutputs'] as const) {
      const root = await fixture();
      const plan = structuredClone(await planEntityRename(root, 'entry', 'entry.old', 'entry.new'));
      const before = new Map(
        await Promise.all(plan.changedFiles.map(async (file) => [
          file,
          await fs.readFile(path.join(root, '.SNL_Doc', file), 'utf8'),
        ] as const)),
      );
      let getterReads = 0;
      Object.defineProperty(plan[arrayField], '4294967295', {
        enumerable: true,
        get: () => {
          getterReads += 1;
          return 'unreviewed';
        },
      });

      await assert.rejects(
        applyEntityRename(root, plan),
        /non-JSON Array properties|inert data property/i,
      );
      assert.equal(getterReads, 0);
      for (const [file, contents] of before) {
        assert.equal(await fs.readFile(path.join(root, '.SNL_Doc', file), 'utf8'), contents);
      }
      assert.equal((await findEntityReferences(root, 'entry', 'entry.new')).length, 0);
    }
  });

  it('requires exact canonical own keys and inert descriptors on plan Arrays', async () => {
    const extraSymbol = Symbol('unreviewed');
    const attacks: Array<[string, (array: any[]) => void]> = [
      ['sparse hole', (array) => { delete array[0]; }],
      ['canonical maximum Array index', (array) => {
        Object.defineProperty(array, '4294967294', { value: 'unreviewed', enumerable: true });
      }],
      ...['01', '-0', '1e0'].map((key) => [
        `non-canonical key ${key}`,
        (array: any[]) => { Object.defineProperty(array, key, { value: 'unreviewed', enumerable: true }); },
      ] as [string, (array: any[]) => void]),
      ['symbol key', (array) => {
        Object.defineProperty(array, extraSymbol, { value: 'unreviewed', enumerable: true });
      }],
      ['non-enumerable extra', (array) => {
        Object.defineProperty(array, 'metadata', { value: 'unreviewed', enumerable: false });
      }],
      ['non-enumerable index', (array) => {
        Object.defineProperty(array, '0', { value: array[0], enumerable: false });
      }],
      ['index accessor', (array) => {
        const value = array[0];
        Object.defineProperty(array, '0', { get: () => value, enumerable: true });
      }],
    ];

    for (const [name, attack] of attacks) {
      const root = await fixture();
      const plan = structuredClone(await planEntityRename(root, 'entry', 'entry.old', 'entry.new'));
      const before = new Map(
        await Promise.all(plan.changedFiles.map(async (file) => [
          file,
          await fs.readFile(path.join(root, '.SNL_Doc', file), 'utf8'),
        ] as const)),
      );
      attack(plan.changedFiles);

      await assert.rejects(
        applyEntityRename(root, plan),
        /non-JSON Array properties|inert data property/i,
        name,
      );
      for (const [file, contents] of before) {
        assert.equal(await fs.readFile(path.join(root, '.SNL_Doc', file), 'utf8'), contents, name);
      }
    }
  });

  it('accepts canonical frozen plan Arrays', async () => {
    const root = await fixture();
    const plan = structuredClone(await planEntityRename(root, 'entry', 'entry.old', 'entry.new'));
    Object.freeze(plan.changedFiles);

    await applyEntityRename(root, plan);

    assert.equal((await findEntityReferences(root, 'entry', 'entry.old')).length, 0);
    assert.ok((await findEntityReferences(root, 'entry', 'entry.new')).length > 0);
  });

  it('exposes a categorized two-phase plan and rejects a stale plan before writing', async () => {
    const root = await fixture();
    const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
    const plan = await planEntityRename(root, 'entry', 'entry.old', 'entry.new');
    assert.ok(plan.occurrences.every((occurrence) => typeof occurrence.category === 'string'));
    assert.ok(plan.sourceRevisions.length >= plan.changedFiles.length);
    assert.ok(plan.sourceRevisions.every((revision) => /^[a-f0-9]{64}$/.test(revision.sha256)));
    await fs.appendFile(entriesPath, ' ');
    await assert.rejects(applyEntityRename(root, plan), /rename plan is stale/i);
    assert.equal((await findEntityReferences(root, 'entry', 'entry.new')).length, 0);
    assert.match(await fs.readFile(entriesPath, 'utf8'), /entry\.old/);
  });

  it('dry-run reports files but performs no writes', async () => {
    const root = await fixture();
    const entries = path.join(root, '.SNL_Doc', 'entries.json');
    const before = await fs.readFile(entries, 'utf8');
    const plan = await renameEntityId(root, 'entry', 'entry.old', 'entry.new', { dryRun: true });
    assert.equal(plan.changedFiles.length, 4);
    assert.equal(await fs.readFile(entries, 'utf8'), before);
  });

  it('renames an Entry definition and every structured reference only', async () => {
    const root = await fixture();
    const plan = await renameEntityId(root, 'entry', 'entry.old', 'entry.new');
    assert.equal(plan.changedFiles.length, 4);
    assert.equal((await findEntityReferences(root, 'entry', 'entry.old')).length, 0);
    assert.equal((await findEntityReferences(root, 'entry', 'entry.new')).length, 6);

    const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
    const entriesText = await fs.readFile(entriesPath, 'utf8');
    const entries = JSON.parse(entriesText);
    assert.equal(entries[0].contribution_info.text, 'entry.old must stay opaque');
    assert.match(entriesText, /"huge": 9007199254740993/);
    assert.equal((await fs.stat(entriesPath)).mode & 0o777, 0o640);
    const graphPath = path.join(root, '.SNL_Doc/libraries/demo/graph.json');
    const graphText = await fs.readFile(graphPath, 'utf8');
    const graph = JSON.parse(graphText);
    assert.equal(graph.nodes[0].props.keep, 'entry.old');
    assert.equal(graphText.replace(/\r\n/g, '').includes('\n'), false, 'CRLF must be preserved');
    const relationships = JSON.parse(await fs.readFile(path.join(root, '.SNL_Doc/relationships.json'), 'utf8'));
    assert.equal(relationships.relationships[0].metadata.keep, 'entry.old');
  });

  it('renames a Macro map key and true SNL macro tokens but not style/literal text', async () => {
    const root = await fixture();
    await renameEntityId(root, 'macro', 'Macro.old', 'Macro.new');
    assert.equal((await findEntityReferences(root, 'macro', 'Macro.old')).length, 0);
    assert.equal((await findEntityReferences(root, 'macro', 'Macro.new')).length, 4);
    const entries = JSON.parse(await fs.readFile(path.join(root, '.SNL_Doc', 'entries.json'), 'utf8'));
    assert.match(entries[0].content.snl, /Macro\.new\[entry\.old\]/);
    assert.match(entries[0].content.snl, /@Macro\.old/);
    assert.match(entries[0].content.snl, /%Macro\.old%/);
    assert.match(entries[0].content.snl, /\$Macro\.old\$/);
  });

  it('renames a registered Macro with a Tree3 postfix without changing binder identities', async () => {
    const root = await fixture();
    const packagePath = path.join(root, '.SNL_Doc/term_macros/demo.json');
    const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    pkg.macros.x = { description: '', source: { entries: [], urls: [] }, dynamic_arity: false, styles: [{ tag: 'default', mode: 'formula_inline', template: 'x' }] };
    await fs.writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    const entriesPath = path.join(root, '.SNL_Doc/entries.json');
    const entries = JSON.parse(await fs.readFile(entriesPath, 'utf8'));
    entries.push({ id: 'entry.postfix', kind: 'theorem', title: '', content: { snl: 'root(@x, x@#x)' }, contribution_info: null, pointer: null });
    await fs.writeFile(entriesPath, JSON.stringify(entries, null, 2) + '\n');

    await renameEntityId(root, 'macro', 'x', 'renamed');
    const after = JSON.parse(await fs.readFile(entriesPath, 'utf8'));
    assert.equal(after.at(-1).content.snl, 'root(@x, renamed@#x)');
  });

  it('renames an inactive macro definition without rewriting same-spelled fvars', async () => {
    const root = await fixture();
    await fs.writeFile(
      path.join(root, '.SNL_Doc', 'config.json'),
      JSON.stringify({ version: '0.0.3', active_macro_packages: [] }, null, 2) + '\n',
    );
    const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
    const before = await fs.readFile(entriesPath, 'utf8');
    const refs = await findEntityReferences(root, 'macro', 'Macro.old');
    assert.deepEqual(refs.map((ref) => ref.role), ['definition']);
    await renameEntityId(root, 'macro', 'Macro.old', 'Macro.inactive');
    assert.equal(await fs.readFile(entriesPath, 'utf8'), before);
    assert.equal((await findEntityReferences(root, 'macro', 'Macro.inactive')).length, 1);
  });

  it('renames generated relationship witness metadata but preserves user metadata', async () => {
    const root = await fixture();
    const relPath = path.join(root, '.SNL_Doc', 'relationships.json');
    const rels = JSON.parse(await fs.readFile(relPath, 'utf8'));
    rels.relationships.push(
      {
        id: 'dep', from: 'entry.user', to: 'entry.old', label: 'depends',
        metadata: { generator: 'macro-source-scan', macros: ['Macro.old'], isAtomic: true },
      },
      {
        id: 'ctx', from: 'entry.user', to: 'entry.old', label: 'uses_context',
        metadata: { generator: 'macro-source-scan', postfixes: ['entry.old'], isAtomic: true },
      },
    );
    await fs.writeFile(relPath, JSON.stringify(rels, null, 2) + '\n');

    assert.ok(
      (await findEntityReferences(root, 'macro', 'Macro.old'))
        .some((ref) => ref.path.endsWith('.metadata.macros[0]')),
    );
    assert.ok(
      (await findEntityReferences(root, 'entry', 'entry.old'))
        .some((ref) => ref.path.endsWith('.metadata.postfixes[0]')),
    );

    await renameEntityId(root, 'macro', 'Macro.old', 'Macro.new');
    await renameEntityId(root, 'entry', 'entry.old', 'entry.new');
    const updated = JSON.parse(await fs.readFile(relPath, 'utf8'));
    assert.deepEqual(updated.relationships[1].metadata.macros, ['Macro.new']);
    assert.deepEqual(updated.relationships[2].metadata.postfixes, ['entry.new']);
    assert.equal(updated.relationships[0].metadata.keep, 'entry.old');
  });

  it('renames a JSON-only Unicode Macro identity', async () => {
    const root = await fixture();
    await renameEntityId(root, 'macro', '中文名', '新名字');
    assert.equal((await findEntityReferences(root, 'macro', '中文名')).length, 0);
    assert.equal((await findEntityReferences(root, 'macro', '新名字')).length, 1);
  });

  it('renames a macro safely to the special property key __proto__', async () => {
    const root = await fixture();
    await renameEntityId(root, 'macro', '中文名', '__proto__');
    const pkg = JSON.parse(
      await fs.readFile(path.join(root, '.SNL_Doc', 'term_macros', 'demo.json'), 'utf8'),
    );
    assert.ok(Object.prototype.hasOwnProperty.call(pkg.macros, '__proto__'));
    assert.equal(pkg.macros.__proto__.description, 'JSON-only Unicode identity');
    assert.equal((await findEntityReferences(root, 'macro', '__proto__')).length, 1);
  });

  it('rejects a new id outside the SNL grammar when the old id has SNL references', async () => {
    const root = await fixture();
    await assert.rejects(
      renameEntityId(root, 'macro', 'Macro.old', '新名字'),
      /not representable as an SNL identifier/,
    );
    await assert.rejects(
      renameEntityId(root, 'macro', 'Macro.old', '1.2'),
      /not representable as an SNL identifier/,
    );
  });

  it('rejects syntactically invalid SNL before any write', async () => {
    const root = await fixture();
    const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
    const entries = JSON.parse(await fs.readFile(entriesPath, 'utf8'));
    entries[1].content.snl = 'Macro.old broken';
    await fs.writeFile(entriesPath, JSON.stringify(entries, null, 2) + '\n');
    const before = await fs.readFile(entriesPath, 'utf8');
    await assert.rejects(
      renameEntityId(root, 'macro', 'Macro.old', 'Macro.new'),
      /Expected EOF/,
    );
    assert.equal(await fs.readFile(entriesPath, 'utf8'), before);
  });

  it('rejects malformed schema-owned reference fields instead of skipping them', async () => {
    const root = await fixture();
    const graphPath = path.join(root, '.SNL_Doc', 'libraries', 'demo', 'graph.json');
    const graph = JSON.parse(await fs.readFile(graphPath, 'utf8'));
    graph.nodes[0].props.entryId = 42;
    await fs.writeFile(graphPath, JSON.stringify(graph, null, 2) + '\n');
    await assert.rejects(
      renameEntityId(root, 'entry', 'entry.old', 'entry.new'),
      /props\.entryId must be a string/,
    );
  });

  it('rejects duplicate JSON properties before migration', async () => {
    const root = await fixture();
    const relPath = path.join(root, '.SNL_Doc', 'relationships.json');
    await fs.writeFile(
      relPath,
      '{"version":1,"version":2,"relationships":[]}\n',
    );
    await assert.rejects(
      findEntityReferences(root, 'entry', 'entry.old'),
      /duplicate JSON property "version"/,
    );
  });

  it('refuses to overwrite a concurrent edit made after planning', async () => {
    const root = await fixture();
    const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
    await assert.rejects(
      renameEntityId(root, 'entry', 'entry.old', 'entry.new', {
        beforeInstall: async () => {
          await fs.appendFile(entriesPath, ' ');
        },
      }),
      /changed during rename planning/,
    );
    const entriesText = await fs.readFile(entriesPath, 'utf8');
    assert.match(entriesText, /entry\.old/);
    assert.ok(entriesText.endsWith(' '), 'concurrent edit must remain intact');
    assert.equal((await findEntityReferences(root, 'entry', 'entry.new')).length, 0);
  });

  it('rejects a symlinked .SNL_Doc workspace boundary', async () => {
    const root = await fixture();
    const doc = path.join(root, '.SNL_Doc');
    const realDoc = path.join(root, 'external-doc');
    await fs.rename(doc, realDoc);
    await fs.symlink(realDoc, doc);
    const before = await fs.readFile(path.join(realDoc, 'entries.json'), 'utf8');
    await assert.rejects(
      renameEntityId(root, 'entry', 'entry.old', 'entry.new'),
      /must be a real directory, not a symlink/,
    );
    assert.equal(await fs.readFile(path.join(realDoc, 'entries.json'), 'utf8'), before);
  });

  it('rejects symlinked macro package files instead of silently skipping them', async () => {
    const root = await fixture();
    const external = path.join(root, 'external-macro.json');
    await fs.writeFile(
      external,
      JSON.stringify({ version: '1', name: 'x', macros: {} }) + '\n',
    );
    await fs.symlink(
      external,
      path.join(root, '.SNL_Doc', 'term_macros', 'linked.json'),
    );
    await assert.rejects(
      findEntityReferences(root, 'entry', 'entry.old'),
      /linked\.json must not be a symlink/,
    );
  });

  it('rejects symlinked schema directories', async () => {
    const root = await fixture();
    const doc = path.join(root, '.SNL_Doc');
    const macros = path.join(doc, 'term_macros');
    const realMacros = path.join(doc, 'term-macros-real');
    await fs.rename(macros, realMacros);
    await fs.symlink(realMacros, macros);
    await assert.rejects(
      findEntityReferences(root, 'macro', 'Macro.old'),
      /term_macros must be a real directory, not a symlink/,
    );
  });

  it('rejects symlinked schema files', async () => {
    const root = await fixture();
    const doc = path.join(root, '.SNL_Doc');
    const entriesPath = path.join(doc, 'entries.json');
    const realPath = path.join(doc, 'entries.real.json');
    await fs.rename(entriesPath, realPath);
    await fs.symlink(realPath, entriesPath);
    await assert.rejects(
      findEntityReferences(root, 'entry', 'entry.old'),
      /regular, non-symlink file/,
    );
  });

  it('renames per-entity Entry and Macro identities together with their hash-derived files', async () => {
    const root = await entityFixture();
    const doc = path.join(root, '.SNL_Doc');
    const oldEntry = path.join(doc, entryEntityPath('_unpackaged', 'entry.old'));
    const newEntry = path.join(doc, entryEntityPath('_unpackaged', 'entry.new'));
    const oldMacro = path.join(doc, macroEntityPath('demo', 'Macro.old'));
    const newMacro = path.join(doc, macroEntityPath('demo', 'Macro.new'));

    assert.equal((await findEntityReferences(root, 'entry', 'entry.old')).filter((r) => r.role === 'definition').length, 1);
    await renameEntityId(root, 'entry', 'entry.old', 'entry.new');
    await assert.rejects(() => fs.stat(oldEntry), { code: 'ENOENT' });
    assert.equal(JSON.parse(await fs.readFile(newEntry, 'utf8')).entry.id, 'entry.new');

    await renameEntityId(root, 'macro', 'Macro.old', 'Macro.new');
    await assert.rejects(() => fs.stat(oldMacro), { code: 'ENOENT' });
    assert.equal(JSON.parse(await fs.readFile(newMacro, 'utf8')).macro.name, 'Macro.new');
    assert.equal((await findEntityReferences(root, 'entry', 'entry.new')).filter((r) => r.role === 'definition').length, 1);
    assert.equal((await findEntityReferences(root, 'macro', 'Macro.new')).filter((r) => r.role === 'definition').length, 1);

    const frozenEntries = await fs.readFile(path.join(doc, 'entries.json'), 'utf8');
    const frozenMacros = await fs.readFile(path.join(doc, 'term_macros/demo.json'), 'utf8');
    assert.match(frozenEntries, /entry\.old/);
    assert.match(frozenMacros, /Macro\.old/);
    await assert.rejects(() => fs.stat(path.join(doc, '.data-write.lock')), { code: 'ENOENT' });
  });

  it('preserves a non-cooperative write that lands between entity rename installs', async () => {
    const root = await entityFixture();
    const doc = path.join(root, '.SNL_Doc');
    const graph = path.join(doc, 'libraries/demo/graph.json');
    const oldEntry = path.join(doc, entryEntityPath('_unpackaged', 'entry.old'));
    const newEntry = path.join(doc, entryEntityPath('_unpackaged', 'entry.new'));
    await assert.rejects(
      renameEntityId(root, 'entry', 'entry.old', 'entry.new', {
        beforeInstallFile: async (relativePath) => {
          if (relativePath === 'libraries/demo/graph.json') {
            await fs.appendFile(graph, ' ');
          }
        },
      }),
      /changed during rename planning/,
    );
    assert.match(await fs.readFile(graph, 'utf8'), / $/);
    assert.equal(JSON.parse(await fs.readFile(oldEntry, 'utf8')).entry.id, 'entry.old');
    await assert.rejects(() => fs.stat(newEntry), { code: 'ENOENT' });
  });

  it('reports both the install failure and every rollback failure', async () => {
    const root = await entityFixture();
    const graph = path.join(root, '.SNL_Doc/libraries/demo/graph.json');
    await assert.rejects(
      renameEntityId(root, 'entry', 'entry.old', 'entry.new', {
        beforeInstallFile: async (relativePath) => {
          if (relativePath === 'libraries/demo/graph.json') await fs.appendFile(graph, ' ');
        },
        beforeRestoreFile: async () => {
          throw new Error('simulated rollback failure');
        },
      }),
      (error: Error) =>
        /changed during rename planning/.test(error.message) &&
        /rollback failed/i.test(error.message) &&
        /simulated rollback failure/.test(error.message),
    );
  });

  it('rejects destination collisions before writing', async () => {
    const root = await fixture();
    const entriesPath = path.join(root, '.SNL_Doc', 'entries.json');
    const entries = JSON.parse(await fs.readFile(entriesPath, 'utf8'));
    entries.push({ id: 'entry.new', kind: 'definition', title: '', content: {}, contribution_info: null, pointer: null });
    await fs.writeFile(entriesPath, JSON.stringify(entries, null, 2) + '\n');
    const before = await fs.readFile(entriesPath, 'utf8');
    await assert.rejects(
      renameEntityId(root, 'entry', 'entry.old', 'entry.new'),
      /already appears in .* structured location/,
    );
    assert.equal(await fs.readFile(entriesPath, 'utf8'), before);
  });
});

describe('scoped Style rename', () => {
  it('binds every reviewed Style scope identity and planned output to the plan fingerprint', async () => {
    const { root, targetPath } = await styleFixture();
    const before = await fs.readFile(targetPath, 'utf8');
    const plan = await planStyleRename(root, 'demo', 'Macro.old', 'shared', 'renamed');
    assert.match((plan as any).fingerprint, /^[a-f0-9]{64}$/);
    assert.ok((plan as any).plannedOutputs.length > 0);

    const mutations: Array<(candidate: any) => void> = [
      (candidate) => { candidate.packageId = 'unreviewed-package'; },
      (candidate) => { candidate.macroId = 'Other'; },
      (candidate) => { candidate.oldStyle = 'unreviewed-old'; },
      (candidate) => { candidate.newStyle = 'unreviewed-new'; },
      (candidate) => { candidate.plannedOutputs[0].sourceFile = 'unreviewed-source.json'; },
      (candidate) => { candidate.plannedOutputs[0].targetFile = 'unreviewed-target.json'; },
      (candidate) => { candidate.plannedOutputs[0].sha256 = 'f'.repeat(64); },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(plan) as any;
      mutate(candidate);
      await assert.rejects(applyStyleRename(root, candidate), /plan integrity check failed/i);
    }
    assert.equal(await fs.readFile(targetPath, 'utf8'), before);
  });

  it('rejects stateful Style plan accessors before they can swap the reviewed operation', async () => {
    const { root, targetPath } = await styleFixture();
    const before = await fs.readFile(targetPath, 'utf8');
    const reviewed = await planStyleRename(root, 'demo', 'Macro.old', 'shared', 'renamed');
    const unreviewed = await planStyleRename(root, 'demo', 'Macro.old', 'shared', 'unreviewed');
    let fingerprintReads = 0;
    const attacker: Record<string, unknown> = {};
    for (const key of Object.keys(reviewed) as Array<keyof typeof reviewed>) {
      Object.defineProperty(attacker, key, {
        enumerable: true,
        get: () => {
          if (key === 'fingerprint') fingerprintReads += 1;
          return (fingerprintReads > 4 ? unreviewed : reviewed)[key];
        },
      });
    }

    await assert.rejects(
      applyStyleRename(root, attacker as any),
      /must be inert plain JSON data|inert enumerable data property|plan integrity check failed/i,
    );
    assert.equal(await fs.readFile(targetPath, 'utf8'), before);
  });

  it('rejects a stale Style source snapshot before writing', async () => {
    const { root, targetPath } = await styleFixture();
    const plan = await planStyleRename(root, 'demo', 'Macro.old', 'shared', 'renamed');
    await fs.appendFile(targetPath, ' ');
    const staleSource = await fs.readFile(targetPath, 'utf8');
    await assert.rejects(applyStyleRename(root, plan), /style rename plan is stale/i);
    assert.equal(await fs.readFile(targetPath, 'utf8'), staleSource);
    assert.match(staleSource, /"style_name": "shared"/);
  });

  it('renames only the selected Macro definition, defaults, and explicit resolved SNL styles', async () => {
    const root = await entityFixture();
    const doc = path.join(root, '.SNL_Doc');
    const targetPath = path.join(doc, macroEntityPath('demo', 'Macro.old'));
    const targetEnvelope = JSON.parse(await fs.readFile(targetPath, 'utf8'));
    targetEnvelope.macro.default_style = { en: 'shared', zh: 'shared' };
    targetEnvelope.macro.styles.push({ style_name: 'shared', mode: 'formula_inline', template: '#0', tags: [], unknown: { keep: true } });
    await fs.writeFile(targetPath, JSON.stringify(targetEnvelope, null, 2) + '\n');
    const other = {
      name: 'Other', description: '', source: { entries: [], urls: [] }, dynamic_arity: false,
      default_style: { en: 'shared' }, tags: [],
      styles: [{ style_name: 'shared', mode: 'formula_inline', template: '#0', tags: [] }],
    };
    const otherPath = path.join(doc, macroEntityPath('demo', 'Other'));
    await fs.writeFile(otherPath, JSON.stringify({ format: 'snl-macro', version: 1, package: 'demo', macro: other }, null, 2) + '\n');
    const entryFiles = (await fs.readdir(path.join(doc, 'entries'))).sort();
    const firstPath = path.join(doc, 'entries', entryFiles[0]);
    const secondPath = path.join(doc, 'entries', entryFiles[1]);
    const first = JSON.parse(await fs.readFile(firstPath, 'utf8'));
    const second = JSON.parse(await fs.readFile(secondPath, 'utf8'));
    first.entry.content.snl = 'Macro.old[shared](x)';
    second.entry.content.snl = 'Other[shared](x)';
    await fs.writeFile(firstPath, JSON.stringify(first, null, 2) + '\n');
    await fs.writeFile(secondPath, JSON.stringify(second, null, 2) + '\n');

    const plan = await planStyleRename(root, 'demo', 'Macro.old', 'shared', 'renamed');
    assert.deepEqual(new Set(plan.occurrences.map((item) => item.category)), new Set(['style-definition', 'default-style', 'snl-style']));
    await applyStyleRename(root, plan);

    const updatedTarget = JSON.parse(await fs.readFile(targetPath, 'utf8'));
    assert.deepEqual(updatedTarget.macro.default_style, { en: 'renamed', zh: 'renamed' });
    assert.equal(updatedTarget.macro.styles.at(-1).style_name, 'renamed');
    assert.deepEqual(updatedTarget.macro.styles.at(-1).unknown, { keep: true });
    assert.equal(JSON.parse(await fs.readFile(otherPath, 'utf8')).macro.styles[0].style_name, 'shared');
    assert.equal(JSON.parse(await fs.readFile(firstPath, 'utf8')).entry.content.snl, 'Macro.old[renamed](x)');
    assert.equal(JSON.parse(await fs.readFile(secondPath, 'utf8')).entry.content.snl, 'Other[shared](x)');
  });

  it('fails closed on malformed Relationships before planning a rename', async () => {
    const root = await entityFixture();
    const file = path.join(root, '.SNL_Doc', 'relationships.json');
    await fs.writeFile(file, JSON.stringify({ version: 1, relationships: [{ from: 'entry.old', to: 'entry.old' }] }) + '\n');
    await assert.rejects(
      planEntityRename(root, 'entry', 'entry.old', 'entry.new'),
      /non-empty string id\/from\/to\/label/,
    );
  });

  it('fails closed on malformed SNL before writing a Style definition', async () => {
    const root = await entityFixture();
    const doc = path.join(root, '.SNL_Doc');
    const targetPath = path.join(doc, macroEntityPath('demo', 'Macro.old'));
    const envelope = JSON.parse(await fs.readFile(targetPath, 'utf8'));
    envelope.macro.default_style = { en: 'shared' };
    envelope.macro.styles.push({ style_name: 'shared', mode: 'formula_inline', template: '#0', tags: [] });
    await fs.writeFile(targetPath, JSON.stringify(envelope, null, 2) + '\n');
    const entryName = (await fs.readdir(path.join(doc, 'entries'))).sort()[0];
    const entryPath = path.join(doc, 'entries', entryName);
    const entry = JSON.parse(await fs.readFile(entryPath, 'utf8'));
    entry.entry.content.snl = 'Macro.old[shared';
    await fs.writeFile(entryPath, JSON.stringify(entry, null, 2) + '\n');
    const before = await fs.readFile(targetPath, 'utf8');
    await assert.rejects(planStyleRename(root, 'demo', 'Macro.old', 'shared', 'renamed'), /Expected RBRACKET|Expected EOF/);
    assert.equal(await fs.readFile(targetPath, 'utf8'), before);
  });
});
