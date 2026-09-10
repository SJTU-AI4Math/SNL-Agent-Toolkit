#!/usr/bin/env node
// Build-time reuse of the Extension's authoritative Reader, never a copied UI fork.
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const pin = JSON.parse(await readFile(join(root, 'reader-source.json'), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(pin.revision)) throw new Error('Reader source must be an immutable Git revision.');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--source')) throw new Error('Usage: npm run build:web -- [--source <clean pinned Extension checkout>]');
const run = (command, argv, cwd) => new Promise((resolvePromise, reject) => {
  const child = spawn(command, argv, { cwd, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' && command === 'npm' });
  let text = ''; child.stdout.on('data', data => { text += data; });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolvePromise(text) : reject(new Error(`${command} exited ${code}: ${text}`)));
});
const temporary = await mkdtemp(join(tmpdir(), 'snl-reader-build-'));
try {
  const source = args.length ? resolve(args[1]) : join(temporary, 'source');
  if (args.length) {
    const actual = (await run('git', ['rev-parse', 'HEAD'], source)).trim();
    if (actual !== pin.revision || (await run('git', ['status', '--porcelain', '--untracked-files=all'], source)).trim()) throw new Error('Reader checkout must be clean and match reader-source.json.');
  } else {
    await mkdir(source);
    const response = await fetch(`https://codeload.github.com/${pin.repository}/tar.gz/${pin.revision}`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Cannot download pinned Reader source: HTTP ${response.status}`);
    const archive = join(temporary, 'source.tar.gz');
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    await run('tar', ['-xzf', archive, '--strip-components=1', '-C', source], temporary);
    console.log(await run('npm', ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'], source));
  }
  const output = join(temporary, 'web');
  console.log(await run(process.execPath, ['scripts/build-local-reader.mjs', '--out', output], source));
  const files = ['index.html', 'reader.js', 'reader.css', 'model.mjs'];
  const digests = {};
  const built = new Map();
  for (const name of files) {
    const bytes = await readFile(join(output, name));
    if (!bytes.length) throw new Error(`Empty Reader artifact: ${name}`);
    built.set(name, bytes); digests[name] = createHash('sha256').update(bytes).digest('hex');
  }
  await mkdir(join(root, 'dist/web'), { recursive: true });
  for (const [name, bytes] of built) await writeFile(join(root, 'dist/web', name), bytes);
  await writeFile(join(root, 'dist/web/provenance.json'), JSON.stringify({ ...pin, files: digests }, null, 2) + '\n');
  console.log(`Shared Reader built from ${pin.repository}@${pin.revision}`);
} finally { await rm(temporary, { recursive: true, force: true }); }
