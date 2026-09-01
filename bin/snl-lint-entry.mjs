#!/usr/bin/env node
/**
 * snl-lint-entry — CLI shim that hands off to tsx so the actual CLI code
 * can be TypeScript (bin/impl/lint-entry.ts). Kept minimal so the shebang
 * line + argv passthrough is all that lives here.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'cli', 'lint-entry.ts');
const tsx = join(here, '..', 'node_modules', '.bin', 'tsx');

const child = spawn(tsx, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
