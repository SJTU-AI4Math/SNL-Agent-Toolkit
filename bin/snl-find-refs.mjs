#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const child = spawn(join(here, '..', 'node_modules', '.bin', 'tsx'), [
  join(here, '..', 'src', 'cli', 'find-refs.ts'),
  ...process.argv.slice(2),
], { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
