#!/usr/bin/env node
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await mkdir(resolve(root, 'dist/cli'), { recursive: true });
await mkdir(resolve(root, 'dist/mcp'), { recursive: true });
await mkdir(resolve(root, 'dist/dsh'), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: {
    'snl-add-entry': 'bin/impl/add-entry.ts',
    'snl-add-macro': 'bin/impl/add-macro.ts',
    'snl-add-package': 'bin/impl/add-package.ts',
    'snl-entity': 'bin/impl/entity.ts',
    'snl-entry-latex': 'bin/impl/entry-latex.ts',
    'snl-entry-ssi': 'bin/impl/entry-ssi.ts',
    'snl-find-refs': 'bin/impl/find-refs.ts',
    'snl-lint-entry': 'bin/impl/lint-entry.ts',
    'snl-lint-graph': 'bin/impl/lint-graph.ts',
    'snl-lint-package': 'bin/impl/lint-package.ts',
    'snl-rename-id': 'bin/impl/rename-id.ts',
    'snl-rename-style': 'bin/impl/rename-style.ts',
    snoogle: 'bin/impl/snoogle.ts',
  },
  outdir: 'dist/cli',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  alias: { 'jsonc-parser': resolve(root, 'node_modules/jsonc-parser/lib/esm/main.js') },
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
});

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

await rm(resolve(root, 'agent-plugin/dist'), { recursive: true, force: true });
await rm(resolve(root, 'agent-plugin/skills'), { recursive: true, force: true });
await mkdir(resolve(root, 'agent-plugin/dist/mcp'), { recursive: true });
await cp(resolve(root, 'dist/mcp/server.cjs'), resolve(root, 'agent-plugin/dist/mcp/server.cjs'));
await cp(resolve(root, 'skills'), resolve(root, 'agent-plugin/skills'), { recursive: true });
