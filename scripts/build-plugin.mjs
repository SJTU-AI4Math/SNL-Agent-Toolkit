#!/usr/bin/env node
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
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
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'none',
});
