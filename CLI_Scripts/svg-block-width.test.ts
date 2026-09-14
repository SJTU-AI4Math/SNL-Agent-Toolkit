import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { apply as sourceDsh } from '../plugin-src/dsh-adapter.ts';
import { macroV11TemplateProjections } from '../lib/snl-doc-schema.ts';

const repo = path.resolve(import.meta.dirname, '..');
async function snapshot(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  async function visit(relative: string) {
    for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.join(relative, item.name);
      if (item.isDirectory()) { files.set(name, 'directory'); await visit(name); }
      else { assert.ok(item.isFile()); files.set(name, (await readFile(path.join(root, name))).toString('base64')); }
    }
  }
  await visit('.SNL_Doc');
  return files;
}

for (const mode of ['source', 'bundle'] as const) {
test(`public ${mode} Macro CAS writer accepts a valid SVG width but rejects zero without changing any workspace bytes`, async () => {
  const apply = mode === 'source' ? sourceDsh : (await import(pathToFileURL(path.join(repo, 'dist/dsh/adapter.mjs')).href)).apply;
  const root = await mkdtemp(path.join(tmpdir(), 'snl-svg-width-'));
  try {
    await cp(path.join(repo, 'CLI_Scripts/fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
    const tools: Array<Record<string, any>> = [];
    await apply({ tools: { register(tool: Record<string, any>) { tools.push(tool); } } });
    async function call(name: string, args: Record<string, unknown>) {
      const tool = tools.find(item => item.name === name);
      assert.ok(tool);
      return tool.execute({ root, ...args }, { signal: new AbortController().signal });
    }
    const id = 'Logic::FOL.implies';
    let entity = (await call('snl_entity_get', { entityType: 'macro', id })).entity;
    assert.ok(entity, 'real fixture Macro must be readable');
    const value = structuredClone(entity.value);
    value.styles[0].template = {
      mode: 'block', body: '#0 #1', block_template_name: 'svg_template',
      svg_template: {
        asset: { source: 'diagram.svg', base_identity: 'fixture', revision: 'r1', request_epoch: 0 },
        generation: 0, producer_revision: 'r1', accessibility: { label: 'Width probe' }, block_width_px: 340,
      },
    };
    let result = await call('snl_entity_apply', { entityType: 'macro', action: 'update', id, expectedRevision: entity.revision, value });
    assert.equal(result.status, 'ok');
    entity = (await call('snl_entity_get', { entityType: 'macro', id })).entity;
    assert.equal(entity.value.styles[0].template.svg_template.block_width_px, 340);
    const before = await snapshot(root);
    const invalid = structuredClone(entity.value);
    invalid.styles[0].template.svg_template.block_width_px = 0;
    result = await call('snl_entity_apply', { entityType: 'macro', action: 'update', id, expectedRevision: entity.revision, value: invalid });
    assert.equal(result.status, 'invalid');
    assert.deepEqual(await snapshot(root), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
}

test('SVG projection bounds reject malformed inputs while preserving opaque fields and omission', () => {
  const ordinary = { mode: 'block', body: '#0', vendor: { keep: true } };
  assert.equal(macroV11TemplateProjections(ordinary)?.[0], ordinary);
  for (const width of [undefined, 0.25, 340, 4096]) {
    const template = { ...ordinary, svg_template: { vendor: { keep: true }, ...(width === undefined ? {} : { block_width_px: width }) } };
    const before = structuredClone(template);
    assert.equal(macroV11TemplateProjections(template)?.[0], template);
    assert.deepEqual(template, before);
  }
  for (const width of [0, -1, 4096.01, NaN, Infinity, -Infinity, null, '340', {}, []]) {
    assert.equal(macroV11TemplateProjections({ ...ordinary, svg_template: { block_width_px: width } }), null);
  }
  for (const options of [null, [], 'svg']) {
    assert.equal(macroV11TemplateProjections({ ...ordinary, svg_template: options }), null);
  }
  for (const mode of ['text', 'formula_inline', 'formula_display']) {
    assert.equal(macroV11TemplateProjections({ ...ordinary, mode, svg_template: { block_width_px: 340 } }), null);
  }
});

test('every localized SVG projection is validated, including an unselected locale', () => {
  const leaf = { mode: 'block', body: '#0', svg_template: { block_width_px: 340 } };
  const localized = { type: 'i18n', default_language: 'en', values: { en: leaf, 'zh-CN': { ...leaf, svg_template: { block_width_px: 0 } } } };
  assert.equal(macroV11TemplateProjections(localized), null);
  localized.values['zh-CN'].svg_template.block_width_px = 510;
  assert.deepEqual(macroV11TemplateProjections(localized), Object.values(localized.values));
});
