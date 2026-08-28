#!/usr/bin/env node
import { open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

function fail(message) {
  throw new Error(message);
}

async function writeExclusiveAtomic(file, text, mode) {
  const temporary = `${file}.schema-marker-${process.pid}-${Date.now()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx', mode);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function main() {
  const workspaceRoot = path.resolve(process.argv[2] ?? '.');
  const docRoot = path.join(workspaceRoot, '.SNL_Doc');
  const config = JSON.parse(await readFile(path.join(docRoot, 'config.json'), 'utf8'));
  if (config?.version !== '0.1.0' || config?.entity_storage?.version !== 1) {
    fail('This repair only accepts a 0.1.0 entity-storage v1 workspace.');
  }

  const entriesRoot = path.join(docRoot, 'entries');
  const names = (await readdir(entriesRoot)).filter((name) => name.endsWith('.json')).sort();
  const repairs = [];
  for (const name of names) {
    const file = path.join(entriesRoot, name);
    const raw = await readFile(file, 'utf8');
    const envelope = JSON.parse(raw);
    if (envelope?.format !== 'snl-entry' || envelope?.version !== 1 || typeof envelope?.entry?.id !== 'string') {
      fail(`${name} is not a version-1 snl-entry envelope.`);
    }
    if (Object.hasOwn(envelope, 'schema_version')) {
      if (envelope.schema_version !== 1) fail(`${name} carries unsupported schema_version ${String(envelope.schema_version)}.`);
      continue;
    }
    const match = /^(\{\r?\n(?:[ \t]*"format"[^\n]*\r?\n)?[ \t]*"version"[ \t]*:[ \t]*1,[ \t]*\r?\n)/u.exec(raw);
    if (!match) fail(`${name} does not have the canonical envelope header required for a byte-local repair.`);
    const newline = match[1].includes('\r\n') ? '\r\n' : '\n';
    const indent = /^([ \t]*)"version"/mu.exec(match[1])?.[1] ?? '  ';
    const mode = (await stat(file)).mode & 0o777;
    repairs.push({ file, mode, text: `${match[1]}${indent}"schema_version": 1,${newline}${raw.slice(match[1].length)}` });
  }

  for (const repair of repairs) await writeExclusiveAtomic(repair.file, repair.text, repair.mode);
  process.stdout.write(`${JSON.stringify({ status: 'ok', scanned: names.length, repaired: repairs.length })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
