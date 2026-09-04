import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  CURRENT_ENTRY_SCHEMA_VERSION,
  CURRENT_PACKAGE_SCHEMA_VERSION,
  ENTRY_STORAGE_VERSION,
  PACKAGE_STORAGE_VERSION,
  compareCanonicalIds,
  entryEntityPath,
  packageManifestPath,
} from './entity-storage.ts';
import { jsonText, readRegularText, replaceJsonIfUnchanged } from './guarded-json-file.ts';
import { readConfig, readEntries, snlDocRoot, usesCurrentEntitySchemas } from './snl-doc.ts';
import { withWorkspaceDataLock } from './workspace-data-lock.ts';

export interface PackageMembershipRepairResult {
  packageId: string;
  changed: boolean;
  entryIds: string[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

/**
 * Rebuild one Package membership index from canonical Entry envelopes.
 *
 * This deliberately bypasses ordinary Package reads because malformed legacy
 * ordering is the condition being repaired. The replacement and rollback are
 * guarded by exact-content compare-and-swap.
 */
export async function repairPackageEntryIds(
  workspaceRoot: string,
  packageId: string,
): Promise<PackageMembershipRepairResult> {
  if (!packageId) throw new Error('Package id must be non-empty.');
  return withWorkspaceDataLock(workspaceRoot, `repair Package entry_ids ${packageId}`, async () => {
    const config = await readConfig(workspaceRoot);
    if (!usesCurrentEntitySchemas(config)) {
      throw new Error('Package entry_ids repair requires the current per-entity workspace schema.');
    }

    const doc = snlDocRoot(workspaceRoot);
    const manifestFile = path.join(doc, packageManifestPath(packageId));
    const original = await readRegularText(manifestFile);
    const manifest = record(JSON.parse(original.text), 'Package manifest');
    if (
      manifest.format !== 'snl-package' ||
      manifest.version !== PACKAGE_STORAGE_VERSION ||
      manifest.schema_version !== CURRENT_PACKAGE_SCHEMA_VERSION ||
      manifest.id !== packageId ||
      typeof manifest.name !== 'string' ||
      typeof manifest.description !== 'string'
    ) {
      throw new Error(`Package ${JSON.stringify(packageId)} is not a current canonical Package manifest.`);
    }

    const entryIds: string[] = [];
    const seen = new Set<string>();
    const entriesDir = path.join(doc, 'entries');
    for (const name of (await fs.readdir(entriesDir)).filter((item) => item.endsWith('.json')).sort()) {
      const relative = `entries/${name}`;
      const envelope = record(JSON.parse((await readRegularText(path.join(entriesDir, name))).text), relative);
      const entry = record(envelope.entry, `${relative}#entry`);
      if (
        envelope.format !== 'snl-entry' ||
        envelope.version !== ENTRY_STORAGE_VERSION ||
        envelope.schema_version !== CURRENT_ENTRY_SCHEMA_VERSION ||
        typeof envelope.package !== 'string' ||
        entry.package !== envelope.package ||
        typeof entry.id !== 'string' ||
        !entry.id
      ) {
        throw new Error(`${relative} is not a current canonical Entry envelope.`);
      }
      if (relative !== entryEntityPath(envelope.package, entry.id)) {
        throw new Error(`${relative} does not match Entry identity ${JSON.stringify(entry.id)}.`);
      }
      if (seen.has(entry.id)) throw new Error(`Duplicate Entry identity ${JSON.stringify(entry.id)}.`);
      seen.add(entry.id);
      if (envelope.package === packageId) entryIds.push(entry.id);
    }
    entryIds.sort(compareCanonicalIds);

    const next = { ...manifest, entry_ids: entryIds };
    if (JSON.stringify(manifest.entry_ids) === JSON.stringify(entryIds)) {
      await readEntries(workspaceRoot);
      return { packageId, changed: false, entryIds };
    }

    await replaceJsonIfUnchanged(manifestFile, original.text, next);
    try {
      await readEntries(workspaceRoot);
    } catch (error) {
      await replaceJsonIfUnchanged(manifestFile, jsonText(next), manifest);
      throw error;
    }
    return { packageId, changed: true, entryIds };
  });
}
