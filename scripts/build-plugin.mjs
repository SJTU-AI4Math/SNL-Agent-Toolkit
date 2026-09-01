#!/usr/bin/env node
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildCli } from './build-cli.mjs';

const root = resolve(import.meta.dirname, '..');
await buildCli();
await mkdir(resolve(root, 'dist/mcp'), { recursive: true });
await mkdir(resolve(root, 'dist/dsh'), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: ['plugin-src/mcp-bin.ts'],
  outfile: 'dist/mcp/server.cjs',
  bundle: true,
  alias: { 'jsonc-parser': resolve(root, 'node_modules/jsonc-parser/lib/esm/main.js') },
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
});

await build({
  absWorkingDir: root,
  entryPoints: ['plugin-src/dsh-adapter.ts'],
  outfile: 'dist/dsh/adapter.mjs',
  bundle: true,
  alias: {
    'jsonc-parser': resolve(root, 'node_modules/jsonc-parser/lib/esm/main.js'),
    '@deepseek-ai/dsh-tools': resolve(root, 'node_modules/@deepseek-ai/dsh-tools/lib/types/schema.js'),
    '@deepseek-ai/dsh-llm': resolve(root, 'plugin-src/dsh-llm-build-shim.ts'),
    '@deepseek-ai/dsh-session': resolve(root, 'plugin-src/dsh-session-build-shim.ts'),
  },
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'none',
});

await rm(resolve(root, 'agent-plugin/dist'), { recursive: true, force: true });
await rm(resolve(root, 'agent-plugin/skills'), { recursive: true, force: true });
await mkdir(resolve(root, 'agent-plugin/dist/mcp'), { recursive: true });
await cp(resolve(root, 'dist/mcp/server.cjs'), resolve(root, 'agent-plugin/dist/mcp/server.cjs'));
