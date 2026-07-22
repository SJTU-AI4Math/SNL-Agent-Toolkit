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
  await fs.writeFile(path.join(doc, 'entries.json'), JSON.stringify([
    {
      id: 'entry.old', kind: 'definition', title: 'Old',
      content: { snl: 'Macro.old(x@entry.old, @Macro.old(y), Macro.old[entry.old], %Macro.old%, $Macro.old$)' },
      contribution_info: { text: 'entry.old must stay opaque' }, pointer: null,
    },
    {
      id: 'entry.user', kind: 'theorem', title: 'User',
      content: { snl: 'Macro.old(z@entry.old)' }, contribution_info: null, pointer: null,
    },
  ], null, 2) + '\n');
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
  await fs.writeFile(path.join(doc, 'libraries', 'demo', 'graph.json'), JSON.stringify({
    nodes: [{ id: 'local', label: 'Entry', props: { entryId: 'entry.old', keep: 'entry.old' } }],
    relationships: [],
  }, null, 2) + '\n');
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

    const entries = JSON.parse(await fs.readFile(path.join(root, '.SNL_Doc', 'entries.json'), 'utf8'));
    assert.equal(entries[0].contribution_info.text, 'entry.old must stay opaque');
    const graph = JSON.parse(await fs.readFile(path.join(root, '.SNL_Doc/libraries/demo/graph.json'), 'utf8'));
    assert.equal(graph.nodes[0].props.keep, 'entry.old');
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

  it('renames a JSON-only Unicode Macro identity', async () => {
    const root = await fixture();
    await renameEntityId(root, 'macro', '中文名', '新名字');
    assert.equal((await findEntityReferences(root, 'macro', '中文名')).length, 0);
    assert.equal((await findEntityReferences(root, 'macro', '新名字')).length, 1);
  });

  it('rejects a new id outside the SNL grammar when the old id has SNL references', async () => {
    const root = await fixture();
    await assert.rejects(
      renameEntityId(root, 'macro', 'Macro.old', '新名字'),
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
