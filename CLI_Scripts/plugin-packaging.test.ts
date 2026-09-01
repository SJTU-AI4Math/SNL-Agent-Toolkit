import assert from 'node:assert/strict';
import { access, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { generatedMetadata } from '../scripts/generate-plugin-metadata.mjs';

const root = resolve(import.meta.dirname, '..');
const json = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as Record<string, unknown>;

test('all host manifests are generated from one canonical metadata source', async () => {
  const source = await json('plugin/metadata.json');
  assert.doesNotMatch(source.description as string, /\bSkills\b/);
  const expected = await generatedMetadata(root);
  for (const [path, value] of Object.entries(expected)) {
    assert.deepEqual(await json(path), value, `${path} drifted; run npm run generate:plugin`);
  }
});

test('portable Hermes and host-native manifests select the bundled stdio runtime', async () => {
  const portable = await json('agent-plugin/plugin.json');
  assert.equal(portable.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  const hermesMcp = await json('agent-plugin/mcp.json');
  assert.deepEqual(Object.keys(hermesMcp), ['$schema', 'mcpServers']);
  assert.equal(
    ((hermesMcp.mcpServers as Record<string, { args: string[] }>)['snl-agent-toolkit']).args[0],
    '${PLUGIN_ROOT}/dist/mcp/server.cjs',
  );

  const nativeMcp = await json('agent-plugin/.mcp.json');
  const nativeServer = (nativeMcp.mcpServers as Record<string, { args: string[]; cwd: string }>)['snl-agent-toolkit'];
  assert.equal(nativeServer.args[0], './dist/mcp/server.cjs');
  assert.equal(nativeServer.cwd, '.');

  for (const path of ['agent-plugin/.claude-plugin/plugin.json', 'agent-plugin/.codex-plugin/plugin.json']) {
    const manifest = await json(path);
    assert.equal(manifest.name, 'snl-agent-toolkit');
    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.skills, undefined);
    assert.equal(manifest.mcpServers, './.mcp.json');
  }
});

test('Claude and Codex marketplace catalogs expose the root plugin', async () => {
  for (const path of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    const marketplace = await json(path);
    assert.equal(marketplace.name, 'snl-agent-toolkit');
    assert.deepEqual(marketplace.plugins, [{ name: 'snl-agent-toolkit', source: './agent-plugin' }]);
  }
});

test('package manifest declares a DSH profile bundle and distributable payload', async () => {
  const packageJson = await json('package.json');
  assert.equal(packageJson.private, undefined);
  assert.equal(packageJson.version, '0.1.0');
  assert.deepEqual(packageJson.publishConfig, { access: 'public' });
  assert.deepEqual(packageJson.dsh, { bundle: { patch: './cordis.patch.yml' } });
  const dependencies = (packageJson.dependencies ?? {}) as Record<string, string>;
  const devDependencies = packageJson.devDependencies as Record<string, string>;
  assert.equal(dependencies.tsx, undefined, 'published runtime must not install tsx/esbuild');
  assert.equal(dependencies['@deepseek-ai/dsh-tools'], undefined, 'prebuilt DSH adapter must not install a second Harness runtime');
  assert.deepEqual(dependencies, {}, 'all public entry points are self-contained prebuilt artifacts');
  assert.ok(devDependencies.tsx, 'tsx remains a development-only test runner');
  assert.ok(devDependencies['@deepseek-ai/dsh-tools'], 'defineTool remains a build-time dependency');
  for (const [name, target] of Object.entries(packageJson.bin as Record<string, string>)) {
    assert.match(target, /^\.\/dist\/(?:cli|mcp)\//, `${name} must use a prebuilt runtime`);
  }

  const files = packageJson.files as string[];
  for (const required of ['dist', 'agent-plugin', '.agents', '.claude-plugin', 'cordis.patch.yml']) {
    assert.ok(files.includes(required), `${required} is omitted from npm files`);
  }
  for (const forbidden of ['bin', 'src', 'skills']) assert.equal(files.includes(forbidden), false, `${forbidden} must not ship`);
  assert.ok(files.includes('!Skills/__deprecated__/**'), 'deprecated Skills must not ship');
  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /agent-plugin\/skills\/snl-agent-toolkit|six MCP tools/);
  assert.notEqual((await stat(resolve(root, 'dist/mcp/server.cjs'))).mode & 0o111, 0, 'MCP bin must be executable');
  const build = await readFile(resolve(root, 'scripts/build-plugin.mjs'), 'utf8');
  assert.match(build, /chmod\(resolve\(root, 'dist\/mcp\/server\.cjs'\), 0o755\)/);
});

test('published agent routing targets current packaged Skill documents', async () => {
  for (const document of ['AGENT.md', 'Skills/README.md']) {
    const text = await readFile(resolve(root, document), 'utf8');
    assert.doesNotMatch(text, /\]\([^)]*__deprecated__|Skills\/(?:Basics|HowToRead|HowToBuild|HowToMaintain)/);
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
      const target = match[1];
      if (/^[a-z]+:/i.test(target)) continue;
      await access(resolve(root, decodeURIComponent(document === 'AGENT.md' ? target : `Skills/${target}`)));
    }
  }
});

test('generated bundles do not embed machine-specific dependency paths', async () => {
  for (const artifact of ['dist/cli/snl.mjs', 'dist/mcp/server.cjs', 'dist/dsh/adapter.mjs']) {
    const text = await readFile(resolve(root, artifact), 'utf8');
    assert.doesNotMatch(text, /(?:\.\.\/)+\.hermes\/vendor|\/home\/[^/]+\/\.hermes\//, artifact);
  }
});


test('prebuilt DSH adapter bundles defineTool instead of importing a second Harness runtime', async () => {
  const adapterPath = resolve(root, 'dist/dsh/adapter.mjs');
  const adapter = await readFile(adapterPath, 'utf8');
  assert.doesNotMatch(adapter, /from ["']@deepseek-ai\/dsh-tools["']/);
  const loaded = await import(`${new URL(adapterPath, import.meta.url).href}?test=${Date.now()}`);
  assert.equal(typeof loaded.apply, 'function');
  const registered: Array<Record<string, any>> = [];
  const noopAdapter = {
    async list() { return {}; }, async get() { return {}; },
    async renderEntry() { return {}; }, async apply() { return {}; }, async validate() { return {}; },
  };
  await loaded.apply({ tools: { register(tool: Record<string, any>) { registered.push(tool); } } }, { adapter: noopAdapter });
  await assert.rejects(
    registered[5].execute({ root: 42 }, { signal: new AbortController().signal }),
    (error: unknown) => error instanceof Error
      && error.name === 'ToolArgsError'
      && (error as Error & { code?: string }).code === 'INVALID_ARGS',
  );
});


test('DSH layer points at the packaged runtime without a stale Agent Skill', async () => {
  const patch = await readFile(resolve(root, 'cordis.patch.yml'), 'utf8');
  assert.match(patch, /name: '@snl-doc\/agent-toolkit\/dsh'/);
  await assert.rejects(readFile(resolve(root, 'skills/snl-agent-toolkit/SKILL.md'), 'utf8'));
});

test('isolated Agent Plugin carries the exact canonical MCP artifact and no stale Skill copy', async () => {
  assert.deepEqual(
    await readFile(resolve(root, 'agent-plugin/dist/mcp/server.cjs')),
    await readFile(resolve(root, 'dist/mcp/server.cjs')),
  );
  await assert.rejects(readFile(resolve(root, 'agent-plugin/skills/snl-agent-toolkit/SKILL.md')));
});

test('prebuilt MCP artifact speaks stdio JSON-RPC without tsx or source files', async () => {
  const child = spawn(process.execPath, [resolve(root, 'dist/mcp/server.cjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const output = new Promise<string>((resolveOutput, reject) => {
    let text = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      text += chunk;
      if (text.includes('\n')) resolveOutput(text);
    });
    child.once('error', reject);
    child.once('exit', (code) => { if (!text.includes('\n')) reject(new Error(`MCP exited ${code}: no response`)); });
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`);
  const response = JSON.parse((await output).trim()) as { result: { tools: Array<{name:string}> } };
  assert.equal(response.result.tools.length, 7);
  assert.ok(response.result.tools.some(tool => tool.name === 'snl_execute'));
  child.kill();
});

test('prebuilt MCP snl_execute returns the same v1 result envelope as the CLI', async () => {
  const child = spawn(process.execPath, [resolve(root, 'dist/mcp/server.cjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const output = new Promise<string>((resolveOutput, reject) => {
    let text = ''; child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { text += chunk; if (text.includes('\n')) resolveOutput(text); });
    child.once('error', reject); child.once('exit', code => { if (!text.includes('\n')) reject(new Error(`MCP exited ${code}: no response`)); });
  });
  child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id:11,method:'tools/call',params:{name:'snl_execute',arguments:{root:resolve(root,'CLI_Scripts/fixtures/workspace-v0.1.0'),command:'entry/get',arguments:{id:'entry.localized'}}}})}\n`);
  try {
    const response=JSON.parse((await output).trim()) as {result:{structuredContent:{protocol:string;ok:boolean;command:string;data:{entity:{id:string}}}}};
    assert.deepEqual({protocol:response.result.structuredContent.protocol,ok:response.result.structuredContent.ok,command:response.result.structuredContent.command,id:response.result.structuredContent.data.entity.id},{protocol:'snl.result/v1',ok:true,command:'entry/get',id:'entry.localized'});
  } finally { child.kill(); }
});


test('prebuilt MCP artifact uses the bundled v0.1.0 entity adapter without host configuration', async () => {
  const child = spawn(process.execPath, [resolve(root, 'dist/mcp/server.cjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const output = new Promise<string>((resolveOutput, reject) => {
    let text = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { text += chunk; if (text.includes('\n')) resolveOutput(text); });
    child.once('error', reject);
    child.once('exit', (code) => { if (!text.includes('\n')) reject(new Error(`MCP exited ${code}: no response`)); });
  });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: {
      name: 'snl_entity_get',
      arguments: {
        root: resolve(root, 'CLI_Scripts/fixtures/workspace-v0.1.0'),
        entityType: 'macro',
        id: 'Logic::FOL.implies',
      },
    },
  })}\n`);
  const response = JSON.parse((await output).trim()) as { result: { structuredContent: { entity: { id: string }; revision: string } } };
  assert.equal(response.result.structuredContent.entity.id, 'Logic::FOL.implies');
  assert.match(response.result.structuredContent.revision, /^[0-9a-f]{64}$/);
  child.kill();
});


test('prebuilt MCP artifact executes the first-class Entry LaTeX tool', async () => {
  const child = spawn(process.execPath, [resolve(root, 'dist/mcp/server.cjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const output = new Promise<string>((resolveOutput, reject) => {
    let text = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { text += chunk; if (text.includes('\n')) resolveOutput(text); });
    child.once('error', reject);
    child.once('exit', (code) => { if (!text.includes('\n')) reject(new Error(`MCP exited ${code}: no response`)); });
  });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: {
      name: 'snl_entry_latex',
      arguments: {
        root: resolve(root, 'CLI_Scripts/fixtures/workspace-v0.1.0'),
        id: 'entry.localized',
      },
    },
  })}\n`);
  const response = JSON.parse((await output).trim()) as {
    result: { structuredContent: { entryId: string; latex: string; notes: string[] }; isError?: boolean };
  };
  assert.equal(response.result.isError, undefined);
  assert.deepEqual(response.result.structuredContent, {
    entryId: 'entry.localized', latex: '#0 \\to #1', notes: [],
  });
  child.kill();
});


test('prebuilt MCP artifact prints a real Library Entry tree', async () => {
  const child = spawn(process.execPath, [resolve(root, 'dist/mcp/server.cjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const output = new Promise<string>((resolveOutput, reject) => {
    let text = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { text += chunk; if (text.includes('\n')) resolveOutput(text); });
    child.once('error', reject);
    child.once('exit', (code) => { if (!text.includes('\n')) reject(new Error(`MCP exited ${code}: no response`)); });
  });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: {
      name: 'snl_library_entry_tree',
      arguments: {
        root,
        librarySlug: 'commands',
        language: 'en',
        includeCounterId: false,
      },
    },
  })}\n`);
  try {
    const response = JSON.parse((await output).trim()) as {
      result: { structuredContent: { librarySlug: string; tree: string; lineCount: number }; isError?: boolean };
    };
    assert.equal(response.result.isError, undefined);
    assert.equal(response.result.structuredContent.librarySlug, 'commands');
    assert.ok(response.result.structuredContent.lineCount > 0);
    assert.equal(
      response.result.structuredContent.tree.split('\n').length,
      response.result.structuredContent.lineCount,
    );
    assert.match(response.result.structuredContent.tree, /^[├└]── /);
  } finally {
    child.kill();
  }
});


test('prebuilt MCP rejects unresolved explicit and ambiguous named Counters', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'snl-prebuilt-counter-errors-'));
  const workspace = join(parent, 'workspace');
  const invoke = async (): Promise<Record<string, unknown>> => {
    const child = spawn(process.execPath, [resolve(root, 'dist/mcp/server.cjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
    const output = new Promise<string>((resolveOutput, reject) => {
      let text = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { text += chunk; if (text.includes('\n')) resolveOutput(text); });
      child.once('error', reject);
      child.once('exit', (code) => { if (!text.includes('\n')) reject(new Error(`MCP exited ${code}: no response`)); });
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: { name: 'snl_library_entry_tree', arguments: { root: workspace, librarySlug: 'demo' } },
    })}\n`);
    try {
      const response = JSON.parse((await output).trim()) as { result: { structuredContent: Record<string, unknown> } };
      return response.result.structuredContent;
    } finally {
      child.kill();
    }
  };
  try {
    await cp(resolve(root, 'CLI_Scripts/fixtures/workspace-v0.1.0'), workspace, { recursive: true });
    const library = join(workspace, '.SNL_Doc', 'libraries', 'demo');
    await mkdir(library, { recursive: true });
    await writeFile(join(library, 'meta.json'), '{"title":"Demo"}');
    await writeFile(join(library, 'graph.json'), JSON.stringify({
      nodes: [{ id: 'node-1', label: 'Entry', props: { entryId: 'entry.localized', counterId: 'missing-explicit' } }],
      relationships: [],
    }));
    await writeFile(join(library, 'counters.json'), JSON.stringify({
      counters: [{ id: 'definition-counter', name: 'Definition', numbering: '1', children: [] }],
    }));
    const missing = await invoke();
    assert.equal(missing.status, 'invalid');
    assert.equal(missing.code, 'library.invalid');
    assert.match(String(missing.message), /explicit counterId .*missing-explicit.* does not exist/);

    await writeFile(join(library, 'graph.json'), JSON.stringify({
      nodes: [{ id: 'node-1', label: 'Entry', props: { entryId: 'entry.localized' } }],
      relationships: [],
    }));
    await writeFile(join(library, 'counters.json'), JSON.stringify({ counters: [
      { id: 'first', name: 'Definition', numbering: '1', children: [] },
      { id: 'second', name: 'Definition', numbering: 'A', children: [] },
    ] }));
    const ambiguous = await invoke();
    assert.equal(ambiguous.status, 'invalid');
    assert.equal(ambiguous.code, 'library.invalid');
    assert.match(String(ambiguous.message), /Duplicate Counter name .*Definition.* ambiguous/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
