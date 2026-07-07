#!/usr/bin/env node
/**
 * snl-lint-graph — CLI shim (hands off to tsx + bin/impl/lint-graph.ts).
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, 'impl', 'lint-graph.ts');
const tsx = join(here, '..', 'node_modules', '.bin', 'tsx');

const child = spawn(tsx, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
