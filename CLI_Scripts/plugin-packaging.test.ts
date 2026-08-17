import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

import { generatedMetadata } from '../scripts/generate-plugin-metadata.mjs';

const root = resolve(import.meta.dirname, '..');
const json = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as Record<string, unknown>;

test('all host manifests are generated from one canonical metadata source', async () => {
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
    assert.equal(manifest.skills, './skills/');
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
  const dependencies = packageJson.dependencies as Record<string, string>;
  const devDependencies = packageJson.devDependencies as Record<string, string>;
  assert.equal(dependencies.tsx, undefined, 'published runtime must not install tsx/esbuild');
  assert.equal(dependencies['@deepseek-ai/dsh-tools'], undefined, 'prebuilt DSH adapter must not install a second Harness runtime');
  assert.ok(devDependencies.tsx, 'tsx remains a development-only test runner');
  assert.ok(devDependencies['@deepseek-ai/dsh-tools'], 'defineTool remains a build-time dependency');
  for (const [name, target] of Object.entries(packageJson.bin as Record<string, string>)) {
    assert.match(target, /^\.\/dist\/(?:cli|mcp)\//, `${name} must use a prebuilt runtime`);
  }

  const files = packageJson.files as string[];
  for (const required of ['dist', 'skills', 'agent-plugin', '.agents', '.claude-plugin', 'cordis.patch.yml']) {
    assert.ok(files.includes(required), `${required} is omitted from npm files`);
  }
});


test('prebuilt DSH adapter bundles defineTool instead of importing a second Harness runtime', async () => {
  const adapter = await readFile(resolve(root, 'dist/dsh/adapter.mjs'), 'utf8');
  assert.doesNotMatch(adapter, /from ["']@deepseek-ai\/dsh-tools["']/);
});


test('shared Agent Skill and DSH layer point at packaged components', async () => {
  const skill = await readFile(resolve(root, 'skills/snl-agent-toolkit/SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: snl-agent-toolkit\ndescription: /);
  assert.match(skill, /references\/entity-adapter-contract\.md/);
  const patch = await readFile(resolve(root, 'cordis.patch.yml'), 'utf8');
  assert.match(patch, /name: '@snl-doc\/agent-toolkit\/dsh'/);
});

test('isolated Agent Plugin carries the exact canonical MCP and Skill artifacts', async () => {
  assert.deepEqual(
    await readFile(resolve(root, 'agent-plugin/dist/mcp/server.cjs')),
    await readFile(resolve(root, 'dist/mcp/server.cjs')),
  );
  assert.deepEqual(
    await readFile(resolve(root, 'agent-plugin/skills/snl-agent-toolkit/SKILL.md')),
    await readFile(resolve(root, 'skills/snl-agent-toolkit/SKILL.md')),
  );
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
  const response = JSON.parse((await output).trim()) as { result: { tools: unknown[] } };
  assert.equal(response.result.tools.length, 4);
  child.kill();
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
