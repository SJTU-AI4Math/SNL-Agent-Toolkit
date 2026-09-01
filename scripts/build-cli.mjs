#!/usr/bin/env node
import { build } from 'esbuild';
import { chmod, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');

export async function buildCli() {
  await mkdir(resolve(root, 'dist/cli'), { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: {
      snl: 'src/cli/snl.ts',
      'snl-add-entry': 'src/cli/add-entry.ts',
      'snl-add-macro': 'src/cli/add-macro.ts',
      'snl-add-package': 'src/cli/add-package.ts',
      'snl-entity': 'src/cli/entity.ts',
      'snl-entry-latex': 'src/cli/entry-latex.ts',
      'snl-entry-ssi': 'src/cli/entry-ssi.ts',
      'snl-find-refs': 'src/cli/find-refs.ts',
      'snl-lint-entry': 'src/cli/lint-entry.ts',
      'snl-lint-graph': 'src/cli/lint-graph.ts',
      'snl-lint-package': 'src/cli/lint-package.ts',
      'snl-rename-id': 'src/cli/rename-id.ts',
      'snl-rename-style': 'src/cli/rename-style.ts',
      snoogle: 'src/cli/snoogle.ts',
    },
    outdir: 'dist/cli',
    outExtension: { '.js': '.mjs' },
    bundle: true,
    preserveSymlinks: true,
    alias: { 'jsonc-parser': resolve(root, 'node_modules/jsonc-parser/lib/esm/main.js') },
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: { js: '#!/usr/bin/env node' },
    define: { __SNL_CLI_EXECUTABLE__: 'true' },
    legalComments: 'none',
  });
  const output = resolve(root, 'dist/cli');
  await Promise.all((await readdir(output)).filter(name => name.endsWith('.mjs')).map(name => chmod(resolve(output, name), 0o755)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildCli();
