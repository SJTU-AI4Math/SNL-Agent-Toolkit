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
  const portable = await json('plugin.json');
  assert.equal(portable.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  const hermesMcp = await json('mcp.json');
  assert.deepEqual(Object.keys(hermesMcp), ['$schema', 'mcpServers']);
  assert.equal(
    ((hermesMcp.mcpServers as Record<string, { args: string[] }>)['snl-agent-toolkit']).args[0],
    '${PLUGIN_ROOT}/dist/mcp/server.mjs',
  );

  for (const path of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const manifest = await json(path);
    assert.equal(manifest.name, 'snl-agent-toolkit');
    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.skills, './skills/');
    assert.equal(manifest.mcpServers, './.mcp.json');
  }
});

test('package manifest declares a DSH profile bundle and distributable payload', async () => {
  const packageJson = await json('package.json');
  assert.equal(packageJson.private, undefined);
  assert.equal(packageJson.version, '0.1.0');
  assert.deepEqual(packageJson.publishConfig, { access: 'public' });
  assert.deepEqual(packageJson.dsh, { bundle: { patch: './cordis.patch.yml' } });
  const files = packageJson.files as string[];
  for (const required of ['dist', 'skills', 'plugin.json', 'mcp.json', '.claude-plugin', '.codex-plugin', '.mcp.json', 'cordis.patch.yml']) {
    assert.ok(files.includes(required), `${required} is omitted from npm files`);
  }
});


test('shared Agent Skill and DSH layer point at packaged components', async () => {
  const skill = await readFile(resolve(root, 'skills/snl-agent-toolkit/SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: snl-agent-toolkit\ndescription: /);
  assert.match(skill, /references\/entity-adapter-contract\.md/);
  const patch = await readFile(resolve(root, 'cordis.patch.yml'), 'utf8');
  assert.match(patch, /name: '@snl-doc\/agent-toolkit\/dsh'/);
});

test('prebuilt MCP artifact speaks stdio JSON-RPC without tsx or source files', async () => {
  const child = spawn(process.execPath, [resolve(root, 'dist/mcp/server.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
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
