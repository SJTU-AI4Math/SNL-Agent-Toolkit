#!/usr/bin/env -S npx tsx
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { jsonText, readRegularText, replaceJsonIfUnchanged } from '../lib/guarded-json-file.ts';
import { withWorkspaceDataLock } from '../lib/workspace-data-lock.ts';

type RepairHooks = {
  /** Deterministic concurrency seam for regression tests. */
  beforeWrites?: () => void | Promise<void>;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

async function canonicalWorkspaceRoot(input: string): Promise<string> {
  const resolved = path.resolve(input);
  const observed = await lstat(resolved);
  if (!observed.isDirectory() || observed.isSymbolicLink() || await realpath(resolved) !== resolved) {
    throw new Error(`${resolved} must be a canonical, non-symlink workspace directory.`);
  }
  const docRoot = path.join(resolved, '.SNL_Doc');
  let docStatus;
  try {
    docStatus = await lstat(docRoot);
  } catch {
    throw new Error(`Workspace must contain an existing .SNL_Doc directory: ${docRoot}.`);
  }
  if (!docStatus.isDirectory() || docStatus.isSymbolicLink() || await realpath(docRoot) !== docRoot) {
    throw new Error(`${docRoot} must be a canonical, non-symlink directory.`);
  }
  return resolved;
}

export async function repairV010EntrySchemaMarkers(
  inputRoot: string,
  hooks: RepairHooks = {},
): Promise<{ status: 'ok'; scanned: number; repaired: number }> {
  const workspaceRoot = await canonicalWorkspaceRoot(inputRoot);
  return withWorkspaceDataLock(workspaceRoot, 'repair v0.1.0 Entry schema markers', async () => {
    const docRoot = path.join(workspaceRoot, '.SNL_Doc');
    const config = record(JSON.parse((await readRegularText(path.join(docRoot, 'config.json'))).text), 'config.json');
    const storage = record(config.entity_storage, 'config.json#entity_storage');
    if (config.version !== '0.1.0' || storage.version !== 1) {
      throw new Error('This repair only accepts a 0.1.0 entity-storage v1 workspace.');
    }

    const entriesRoot = path.join(docRoot, 'entries');
    const names = (await readdir(entriesRoot)).filter((name) => name.endsWith('.json')).sort();
    const repairs: Array<{ file: string; expected: string; value: Record<string, unknown> }> = [];
    for (const name of names) {
      const file = path.join(entriesRoot, name);
      const status = await lstat(file);
      if (!status.isFile() || status.isSymbolicLink()) {
        throw new Error(`${name} must be a regular, non-symlink Entry envelope.`);
      }
      const expected = (await readRegularText(file)).text;
      const envelope = record(JSON.parse(expected), name);
      if (jsonText(envelope) !== expected) {
        throw new Error(`${name} must use canonical Toolkit JSON serialization for a marker-only repair.`);
      }
      const entry = record(envelope.entry, `${name}#entry`);
      if (envelope.format !== 'snl-entry' || envelope.version !== 1 || typeof entry.id !== 'string') {
        throw new Error(`${name} is not a version-1 snl-entry envelope.`);
      }
      if (Object.hasOwn(envelope, 'schema_version')) {
        if (envelope.schema_version !== 1) {
          throw new Error(`${name} carries unsupported schema_version ${String(envelope.schema_version)}.`);
        }
        continue;
      }
      const { format, version, ...rest } = envelope;
      repairs.push({
        file,
        expected,
        value: { format, version, schema_version: 1, ...rest },
      });
    }

    await hooks.beforeWrites?.();
    for (const repair of repairs) {
      await replaceJsonIfUnchanged(repair.file, repair.expected, repair.value);
    }
    return { status: 'ok', scanned: names.length, repaired: repairs.length };
  });
}

async function main(): Promise<void> {
  const result = await repairV010EntrySchemaMarkers(process.argv[2] ?? '.');
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
