import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  findEntityReferences,
  renameEntityId,
  scanSnlReferences,
} from '../lib/entity-references.ts';

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
      content: { snl: 'Macro.old(x@entry.old, @Macro.old(y), Macro.old[entry.old], %Macro.old%, $Macro.old$)' },
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

describe('SNL structured reference scanner', () => {
  it('separates macro tokens, src-postfix Entry refs, style tags, and literal environments', () => {
    const refs = scanSnlReferences(
      'Macro.old(x@entry.old, @Macro.old(y), Macro.old[entry.old], %Macro.old%, $Macro.old$)',
    );
    assert.deepEqual(
      refs.map((r) => [r.entityType, r.id]),
      [
        ['macro', 'Macro.old'], ['macro', 'x'], ['entry', 'entry.old'],
        ['macro', 'Macro.old'], ['macro', 'y'], ['macro', 'Macro.old'],
      ],
    );
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
    assert.equal(refs.filter((r) => r.role === 'reference').length, 4);
  });

  it('finds JSON-only Unicode Macro identities', async () => {
    const root = await fixture();
    const refs = await findEntityReferences(root, 'macro', '中文名');
    assert.equal(refs.length, 1);
    assert.equal(refs[0].role, 'definition');
  });
});

describe('renameEntityId', () => {
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
    assert.equal((await findEntityReferences(root, 'macro', 'Macro.new')).length, 5);
    const entries = JSON.parse(await fs.readFile(path.join(root, '.SNL_Doc', 'entries.json'), 'utf8'));
    assert.match(entries[0].content.snl, /Macro\.new\[entry\.old\]/);
    assert.match(entries[0].content.snl, /%Macro\.old%/);
    assert.match(entries[0].content.snl, /\$Macro\.old\$/);
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
