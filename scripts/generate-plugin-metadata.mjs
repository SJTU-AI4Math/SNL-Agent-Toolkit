#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ownRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function generatedMetadata(root = ownRoot) {
  const source = JSON.parse(await readFile(resolve(root, 'plugin/metadata.json'), 'utf8'));
  const common = {
    name: source.name,
    version: source.version,
    description: source.description,
    author: source.author,
    homepage: source.homepage,
    repository: source.repository,
    license: source.license,
    keywords: source.keywords,
  };
  const hostManifest = {
    ...common,
    skills: './skills/',
    mcpServers: './.mcp.json',
  };
  const nativeMcp = {
    mcpServers: {
      [source.name]: {
        command: 'node',
        args: ['./dist/mcp/server.mjs'],
        cwd: '.',
      },
    },
  };
  return {
    'plugin.json': {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      ...common,
    },
    'mcp.json': {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
      mcpServers: {
        [source.name]: {
          type: 'stdio',
          command: 'node',
          args: ['${PLUGIN_ROOT}/dist/mcp/server.mjs'],
          cwd: '${PLUGIN_ROOT}',
        },
      },
    },
    '.claude-plugin/plugin.json': hostManifest,
    '.codex-plugin/plugin.json': hostManifest,
    '.mcp.json': nativeMcp,
  };
}

export async function writeGeneratedMetadata(root = ownRoot) {
  for (const [path, value] of Object.entries(await generatedMetadata(root))) {
    const output = resolve(root, path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(value, null, 2)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeGeneratedMetadata();
}
