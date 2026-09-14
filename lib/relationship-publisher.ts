import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { readRegularText } from './guarded-json-file.ts';
import { readConfig, usesEntityStorage, readEntries, readActiveMacros } from './snl-doc.ts';
import { listManagedEntities, validateManagedWorkspace } from './entity-crud.ts';
import { captureWorkspaceRevision } from './batch.ts';
import { withWorkspaceDataLock } from './workspace-data-lock.ts';
import { planComposedDependencyRelationships, isAutomaticDependency, type RelationshipData } from './relationship-generation.ts';
import { dependencyCacheDescriptor } from './dependency-cache-descriptor.ts';
import { cacheFingerprint, cachePath, readCache, writeCache } from './dependency-cache-storage.ts';

export class RelationshipPublishError extends Error {
  constructor(public code: string, message: string, public exitCode: 1 | 2 = 1, public details?: unknown) { super(message); }
}
export interface RelationshipPublishHooks {
  /** Test scheduling only: never available in the public operation schema. */
  beforePublish?: () => Promise<void>;
  afterPublish?: () => Promise<void>;
}
async function inputs(root: string) {
  const [entries, macros, rows] = await Promise.all([readEntries(root), readActiveMacros(root), listManagedEntities(root, 'relationship')]);
  return { entries, macros, relationships: rows.map(row => row.value as unknown as RelationshipData) };
}
async function validate(root: string) {
  const result = await validateManagedWorkspace(root);
  if (result.issues.some(issue => /unsupported (?:future )?(?:workspace|schema|entity_storage)|newer than this Toolkit supports|no registered migration|must carry current Package manifest schema_version/i.test(issue.message)))
    throw new RelationshipPublishError('workspace.unsupported-schema', 'Workspace or entity schema is not supported by this Toolkit.', 2, result);
  if (!result.valid) throw new RelationshipPublishError('workspace.invalid', 'Workspace validation reported errors.', 1, result);
  return result;
}
/** Caller validates arguments before filesystem/config access. Authoring CAS is
 * separate from cache identity; no batch physical transaction helper is changed.
 */
export async function generateRelationships(root: string, dryRun: boolean, expectedWorkspaceRevision?: string, hooks: RelationshipPublishHooks = {}) {
  // Preserve unsupported config / actual read failures before generic validation.
  await readRegularText(path.join(root, '.SNL_Doc/config.json'));
  if (!usesEntityStorage(await readConfig(root))) throw new RelationshipPublishError('workspace.unsupported-schema', 'Generation requires current entity storage.', 2);
  const run = async () => {
    const revision = await captureWorkspaceRevision(root, !dryRun);
    if (expectedWorkspaceRevision !== undefined && expectedWorkspaceRevision !== revision)
      throw new RelationshipPublishError('relationship.workspace-conflict', 'Authoring revision changed; run a new global dry-run and review it.');
    // Strict source readers preserve I/O/schema failures before validation can
    // aggregate them into domain diagnostics. No empty-pool fallback is admitted.
    const snapshot = await inputs(root);
    await validate(root);
    const descriptor = dependencyCacheDescriptor(snapshot);
    const inputHash = cacheFingerprint(descriptor.input);
    const plan = planComposedDependencyRelationships(snapshot.entries, snapshot.macros, snapshot.relationships);
    const recheck = async () => {
      const current = dependencyCacheDescriptor(await inputs(root));
      if (cacheFingerprint(current.input) !== inputHash || await captureWorkspaceRevision(root, !dryRun) !== revision)
        throw new RelationshipPublishError('relationship.workspace-conflict', 'Complete Authoring input changed during generation; review a fresh dry-run.');
    };
    const result = { relationships: plan.relationships, generated: plan.generated, report: plan.report, changes: plan.changes,
      provenance: plan.provenance, effectiveScope: 'global' as const, inputHash, expectedWorkspaceRevision: revision,
      destination: '.SNL_Doc/.cache/dependencies/result.json', published: false, dryRun };
    if (dryRun) { await recheck(); return result; }
    await hooks.beforePublish?.();
    await recheck();
    try { await writeCache(root, descriptor, plan.generated, recheck); }
    catch (error) {
      if (error instanceof RelationshipPublishError) throw error;
      throw new RelationshipPublishError('relationship.publication-failed', error instanceof Error ? error.message : String(error), 2);
    }
    await hooks.afterPublish?.();
    await recheck();
    const saved = await readCache(root, descriptor);
    const composed = saved && [...snapshot.relationships.filter(row => !isAutomaticDependency(row)), ...saved].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (!isDeepStrictEqual(saved, plan.generated) || !isDeepStrictEqual(composed, plan.relationships))
      throw new RelationshipPublishError('relationship.readback-failed', 'Published cache was cleared, replaced, or failed same-input readback; no Authoring was written.', 2);
    const validation = await validate(root);
    await recheck();
    return { ...result, published: true, resultingWorkspaceRevision: revision, readback: { valid: true, path: cachePath(root, 'dependencies') }, validation };
  };
  return dryRun ? run() : withWorkspaceDataLock(root, 'relationship-generate', run);
}
