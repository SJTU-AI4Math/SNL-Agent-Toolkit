import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { defaultRenderers } from '@sjtu-ai4math/snl-basics';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
import { DEFAULT_MACRO_KINDS } from '../lib/init-presets.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

async function target(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-init-'));
  roots.push(root);
  await writeFile(path.join(root, 'README.md'), '# Existing repository\n');
  return root;
}

function run(root: string, args: string[]) {
  return spawnSync(
    path.resolve('node_modules/.bin/tsx'),
    ['src/cli/snl.ts', '--root', root, '--json', ...args],
    { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' },
  );
}

function result(call: ReturnType<typeof spawnSync>) {
  assert.equal(call.stderr, '');
  assert.equal(typeof call.stdout, 'string');
  return JSON.parse(call.stdout as string);
}

async function readJson(file: string): Promise<Record<string, any>> {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function snapshot(directory: string, current = directory): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const item of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, item.name);
    if (item.isDirectory()) Object.assign(out, await snapshot(directory, absolute));
    else out[path.relative(directory, absolute)] = await readFile(absolute, 'utf8');
  }
  return out;
}

describe('snl init', () => {
  it('advertises init and all built-in Preset Packages through machine help', async () => {
    const root = await target();
    const call = run(root, ['--help']);
    assert.equal(call.status, 0, call.stderr || call.stdout);
    const body = result(call);
    assert.ok(body.data.commands.includes('init'));
    assert.deepEqual(body.data.initPresets, [
      { id: 'fulcrum-math-notes', label: "Fulcrum's Math Notes" },
      { id: 'lean4-document', label: 'Lean 4 documentation' },
      { id: 'react', label: 'React' },
    ]);
  });

  it('initializes the exact default workspace in a non-empty repository', async () => {
    const root = await target();
    const call = run(root, ['init']);
    assert.equal(call.status, 0, call.stderr || call.stdout);
    const body = result(call);
    assert.equal(body.protocol, 'snl.result/v1');
    assert.equal(body.command, 'init');
    assert.equal(body.ok, true);
    assert.equal(body.data.root, root);
    assert.equal(body.data.preset, null);
    assert.equal(body.data.valid, true);

    const doc = path.join(root, '.SNL_Doc');
    assert.deepEqual((await readdir(doc)).sort(), [
      'config.json', 'entries', 'libraries', 'macros', 'packages', 'relationships.json',
    ]);
    const config = await readJson(path.join(doc, 'config.json'));
    assert.equal(config.version, '0.1.0');
    assert.deepEqual(config.entry_kinds.map((kind: { id: string }) => kind.id), ['section', 'subsection', 'entry']);
    assert.deepEqual(config.macro_kinds.map((kind: { id: string }) => kind.id), ['fvar', 'binder', 'const', 'bvar', 'sub']);
    const binder = config.macro_kinds.find((kind: { id: string }) => kind.id === 'binder');
    assert.equal(binder.name, 'Binder');
    assert.equal(binder.coloring.light.stroke, '#0E7490');
    assert.equal(binder.coloring.light.background, '#CFFAFE');
    assert.equal(binder.coloring.dark.stroke, '#67E8F9');
    const sub = config.macro_kinds.find((kind: { id: string }) => kind.id === 'sub');
    assert.equal(sub.name, 'Sub');
    assert.deepEqual(sub.coloring, {
      light: { stroke: 'inherit', background: 'transparent' },
      dark: { stroke: 'inherit', background: 'transparent' },
    });
    assert.deepEqual(config.active_macro_packages, ['BasicMacros']);

    const macroFiles = (await readdir(path.join(doc, 'macros'))).filter(file => file.endsWith('.json'));
    assert.equal(macroFiles.length, 7);
    const macros = await Promise.all(macroFiles.map(async file => (await readJson(path.join(doc, 'macros', file))).macro));
    assert.deepEqual(macros.map(macro => macro.name).sort(), [
      '__center__', '__display__', '__enum__', '__list__', '__right__', '__row__', '__table__',
    ]);
    assert.ok(macros.every(macro => macro.kind === 'sub'));
    const enumeration = macros.find(macro => macro.name === '__enum__');
    assert.equal(enumeration.dynamic_arity, true);
    assert.equal(enumeration.styles.find((style: any) => style.style_name === 'num').template.block_template_name, 'enumerate');
    assert.equal(enumeration.styles.find((style: any) => style.style_name === 'dot').template.block_template_name, 'list');
    const right = macros.find(macro => macro.name === '__right__');
    assert.equal(right.styles[0].template.block_template_name, 'right');
    assert.equal(typeof defaultRenderers.right, 'function');
    const display = macros.find(macro => macro.name === '__display__');
    assert.equal(display.styles[0].template.mode, 'formula_display');
    assert.equal(display.styles[0].template.markdown, '$$#0$$');

    assert.deepEqual(await readdir(path.join(doc, 'entries')), ['.gitkeep']);
    assert.deepEqual(await readdir(path.join(doc, 'libraries')), ['.gitkeep']);
    const manifests = await Promise.all((await readdir(path.join(doc, 'packages')))
      .map(file => readJson(path.join(doc, 'packages', file))));
    assert.deepEqual(manifests.map(item => item.id).sort(), ['BasicMacros', '_unpackaged']);
    assert.ok(manifests.every(item => item.schema_version === 2 && Array.isArray(item.entry_ids)));

    const validate = run(root, ['validate']);
    assert.equal(validate.status, 0, validate.stderr || validate.stdout);
    const validation = result(validate);
    assert.equal(validation.data.valid, true);
    assert.deepEqual(validation.data.counts, {
      'entry-kind': 3,
      'macro-kind': 5,
      'entry-package': 2,
      'macro-package': 2,
      entry: 0,
      macro: 7,
      relationship: 0,
      library: 0,
    });
    assert.equal(await readFile(path.join(root, 'README.md'), 'utf8'), '# Existing repository\n');
  });

  it('fails validation when an empty schema directory would disappear from Git', async () => {
    const root = await target();
    assert.equal(run(root, ['init']).status, 0);
    await rm(path.join(root, '.SNL_Doc', 'entries', '.gitkeep'), { force: true });
    const call = run(root, ['validate']);
    assert.equal(call.status, 1, call.stderr || call.stdout);
    const body = result(call);
    assert.equal(body.error.code, 'workspace.invalid');
    assert.ok(body.error.details.issues.some((issue: any) =>
      issue.code === 'workspace.git-empty-directory' && issue.path === '.SNL_Doc/entries'));
  });

  it('does not misreport a populated directory when a sibling directory is missing', async () => {
    const root = await target();
    assert.equal(run(root, ['init']).status, 0);
    await Promise.all([
      rm(path.join(root, '.SNL_Doc', 'entries'), { recursive: true }),
      rm(path.join(root, '.SNL_Doc', 'libraries'), { recursive: true }),
      rm(path.join(root, '.SNL_Doc', 'macros', '.gitkeep')),
    ]);
    const call = run(root, ['validate']);
    assert.equal(call.status, 1, call.stderr || call.stdout);
    const issues = result(call).error.details.issues as Array<{ code: string; path: string }>;
    assert.ok(issues.some(issue => issue.path === '.SNL_Doc/entries'));
    assert.equal(issues.some(issue =>
      issue.code === 'workspace.git-empty-directory' && issue.path === '.SNL_Doc/macros'), false);
  });

  it('parses and installs Entries that exercise every initial Markdown Macro', async () => {
    const root = await target();
    assert.equal(run(root, ['init']).status, 0);
    const cases = new Map([
      ['enum', '__enum__(%A%,%B%)'],
      ['enum-dot', '__enum__[dot](%A%,%B%)'],
      ['list', '__list__(%A%,%B%)'],
      ['table', '__table__(__row__(%A%,%B%))'],
      ['center', '__center__(%A%)'],
      ['right', '__right__(%A%)'],
      ['display', '__display__($x$)'],
    ]);
    for (const [slug, snl] of cases) {
      const input = path.join(root, `${slug}.json`);
      await writeFile(input, `${JSON.stringify({
        id: `entry.${slug}`, package: '_unpackaged', kind: 'entry', title: slug,
        content: { snl }, contribution_info: null, pointer: null,
      })}\n`);
      const call = run(root, ['entry', 'create', '--input', input]);
      assert.equal(call.status, 0, `${slug}: ${call.stderr || call.stdout}`);
      const latex = run(root, ['entry', 'latex', `entry.${slug}`]);
      assert.equal(latex.status, 0, `${slug}: ${latex.stderr || latex.stdout}`);
    }
  });

  it('loads each built-in Preset Package over the default bootstrap', async () => {
    const cases = [
      ['fulcrum-math-notes', ['definition', 'theorem', 'proof']],
      ['lean4-document', ['module', 'namespace', 'inductive']],
      ['react', ['component', 'hook', 'context']],
    ] as const;
    for (const [preset, expectedKinds] of cases) {
      const root = await target();
      const call = run(root, ['init', '--preset', preset]);
      assert.equal(call.status, 0, `${preset}: ${call.stderr || call.stdout}`);
      const body = result(call);
      assert.equal(body.data.preset, preset);
      const config = await readJson(path.join(root, '.SNL_Doc', 'config.json'));
      const ids = new Set(config.entry_kinds.map((kind: { id: string }) => kind.id));
      for (const id of expectedKinds) assert.ok(ids.has(id), `${preset} missing ${id}`);
      assert.deepEqual(config.macro_kinds.map((kind: { id: string }) => kind.id), ['fvar', 'binder', 'const', 'bvar', 'sub']);
      assert.equal(config.macro_kinds.find((kind: { id: string }) => kind.id === 'binder').coloring.light.stroke, '#0E7490');
      assert.equal(config.macro_kinds.find((kind: { id: string }) => kind.id === 'sub').name, 'Sub');
      assert.ok(config.entry_kinds.every((kind: any) => kind.coloring.light && kind.coloring.dark));
      assert.equal(result(run(root, ['validate'])).data.valid, true);
    }
  });

  it('loads a validated JSON Preset Package through --input', async () => {
    const root = await target();
    const presetFile = path.join(root, 'preset.json');
    await writeFile(presetFile, `${JSON.stringify({
      schema: 'snl.init-preset', version: 1, id: 'notes',
      entryKinds: [{
        id: 'note',
        name: { type: 'i18n', default_language: 'en', values: { en: 'Note', 'zh-CN': '笔记' } },
        description: { type: 'i18n', default_language: 'en', values: { en: 'A note.', 'zh-CN': '一则笔记。' } },
        coloring: {
          light: { stroke: '#166534', background: '#DCFCE7' },
          dark: { stroke: '#4ADE80', background: '#313131' },
        },
        defaultCounterName: 'note', style: '',
      }],
      packages: [{ id: 'Notes', name: 'Notes', description: 'Imported notes.', entry_ids: ['Notes.welcome'] }],
      entries: [{
        id: 'Notes.welcome', package: 'Notes', kind: 'note', title: 'Welcome',
        content: { markdown: 'Hello.' }, contribution_info: null, pointer: null,
      }],
    }, null, 2)}\n`);

    const call = run(root, ['init', '--input', presetFile]);
    assert.equal(call.status, 0, call.stderr || call.stdout);
    const body = result(call);
    assert.equal(body.data.preset, 'notes');
    const validation = result(run(root, ['validate']));
    assert.equal(validation.data.valid, true);
    assert.equal(validation.data.counts.entry, 1);
    assert.equal(validation.data.counts['entry-package'], 3);
    const entry = result(run(root, ['entry', 'get', 'Notes.welcome']));
    assert.equal(entry.data.entity.value.kind, 'note');
    assert.equal(entry.data.entity.value.package, 'Notes');
  });

  it('accepts a semantically identical reserved Macro Kind regardless of JSON key order', async () => {
    const root = await target();
    const input = path.join(root, 'same-binder.json');
    await writeFile(input, `${JSON.stringify({
      schema: 'snl.init-preset', version: 1, id: 'canonical-binder',
      macroKinds: [(() => {
        const binder = DEFAULT_MACRO_KINDS.find(kind => kind.id === 'binder')!;
        return {
          coloring: {
            dark: { background: binder.coloring.dark.background, stroke: binder.coloring.dark.stroke },
            light: { background: binder.coloring.light.background, stroke: binder.coloring.light.stroke },
          },
          description: binder.description, name: binder.name, id: binder.id,
        };
      })()],
    })}\n`);
    const call = run(root, ['init', '--input', input]);
    assert.equal(call.status, 0, call.stderr || call.stdout);
    assert.equal(result(call).data.valid, true);
  });

  it('rejects unknown, null, and obsolete presets before writing any workspace data', async () => {
    const nullRoot = await target();
    const nullPreset = await executeOperation({
      protocol: OPERATION_PROTOCOL, command: 'init', root: nullRoot, arguments: { preset: null },
    });
    assert.equal(nullPreset.exitCode, 2);
    assert.equal(nullPreset.response.ok, false);
    if (!nullPreset.response.ok) assert.equal(nullPreset.response.error.code, 'operation.invalid-arguments');
    assert.deepEqual((await readdir(nullRoot)).sort(), ['README.md']);

    const unknownRoot = await target();
    let call = run(unknownRoot, ['init', '--preset', 'wat']);
    assert.equal(call.status, 1, call.stderr || call.stdout);
    assert.equal(result(call).error.code, 'init.preset-not-found');
    assert.deepEqual((await readdir(unknownRoot)).sort(), ['README.md']);

    const invalidPresets = [
      {
        schema: 'snl.init-preset', version: 1, id: 'old-partial',
        macroKinds: [{
          id: 'partial', name: 'Partial', description: 'obsolete',
          coloring: { light: { stroke: 'inherit', background: 'transparent' }, dark: { stroke: 'inherit', background: 'transparent' } },
        }],
      },
      {
        schema: 'snl.init-preset', version: 1, id: 'orange-binder',
        macroKinds: [{
          id: 'binder', name: 'Binder', description: 'wrong historical color',
          coloring: { light: { stroke: '#9A4D00', background: '#FFEBD2' }, dark: { stroke: '#FB923C', background: '#313131' } },
        }],
      },
      { schema: 'snl.init-preset', version: 1, id: 'Bad Preset ID!' },
      {
        schema: 'snl.init-preset', version: 1, id: 'bad-kind',
        entryKinds: [{
          id: 'bad kind/id', name: 'Bad', description: 'Bad',
          coloring: { light: { stroke: '#000', background: '#fff' }, dark: { stroke: '#fff', background: '#000' } },
          defaultCounterName: 'bad', style: '',
        }],
      },
      {
        schema: 'snl.init-preset', version: 1, id: 'bad-i18n',
        entryKinds: [{
          id: 'note',
          name: { type: 'i18n', default_language: 'en', values: { 'zh-CN': '笔记' } },
          description: { type: 'i18n', default_language: 'en', values: { 'zh-CN': '说明' } },
          coloring: { light: { stroke: '#000', background: '#fff' }, dark: { stroke: '#fff', background: '#000' } },
          defaultCounterName: 'note', style: '',
        }],
      },
      {
        schema: 'snl.init-preset', version: 1, id: 'membership-mismatch',
        packages: [{ id: 'Notes', name: 'Notes', description: '', entry_ids: ['ghost.entry'] }],
      },
    ];
    for (const [index, preset] of invalidPresets.entries()) {
      const root = await target();
      const input = path.join(root, `invalid-${index}.json`);
      await writeFile(input, `${JSON.stringify(preset)}\n`);
      call = run(root, ['init', '--input', input]);
      assert.equal(call.status, 1, call.stderr || call.stdout);
      assert.equal(result(call).error.code, 'init.invalid-preset');
      assert.equal((await readdir(root)).some(name => name === '.SNL_Doc' || name.includes('snl-init')), false);
    }
  });

  it('allows exactly one concurrent initializer to publish', async () => {
    const root = await target();
    const request = { protocol: OPERATION_PROTOCOL, command: 'init', root, arguments: {} } as const;
    const results = await Promise.all([executeOperation(request), executeOperation(request)]);
    assert.deepEqual(results.map(item => item.exitCode).sort(), [0, 2]);
    const loser = results.find(item => item.exitCode !== 0)!;
    assert.equal(loser.response.ok, false);
    if (!loser.response.ok) assert.equal(loser.response.error.code, 'workspace.locked');
    assert.equal(result(run(root, ['validate'])).data.valid, true);
    assert.equal((await readdir(root)).some(name => name.includes('snl-init')), false);
  });

  it('reports an occupied initialization lock as retryable operational failure', async () => {
    const root = await target();
    await writeFile(path.join(root, '.SNL_Doc.init.lock'), 'foreign\n');
    const call = run(root, ['init']);
    assert.equal(call.status, 2, call.stderr || call.stdout);
    const body = result(call);
    assert.equal(body.error.code, 'workspace.locked');
    assert.equal(body.error.retryable, true);
    assert.deepEqual((await readdir(root)).sort(), ['.SNL_Doc.init.lock', 'README.md']);
  });

  it('does not resolve inherited Object prototype names as CLI flags or commands', async () => {
    const root = await target();
    const call = run(root, ['constructor', 'create']);
    assert.equal(call.status, 2, call.stderr || call.stdout);
    const body = result(call);
    assert.equal(body.command, 'constructor/create');
    assert.equal(body.error.code, 'command.unknown');
  });

  it('rejects repeated initialization without changing one workspace byte', async () => {
    const root = await target();
    const first = run(root, ['init']);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const doc = path.join(root, '.SNL_Doc');
    const before = await snapshot(doc);

    const second = run(root, ['init']);
    assert.equal(second.status, 1, second.stderr || second.stdout);
    const body = result(second);
    assert.equal(body.ok, false);
    assert.equal(body.command, 'init');
    assert.equal(body.error.code, 'workspace.already-initialized');
    assert.deepEqual(await snapshot(doc), before);
    assert.deepEqual((await readdir(root)).filter(name => name.includes('snl-init')), []);
  });
});
