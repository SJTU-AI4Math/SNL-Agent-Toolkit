import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readEntries, readActiveMacros } from './snl-doc.ts';
import { validateManagedWorkspace } from './entity-crud.ts';
import { readRegularText, replaceJsonIfUnchanged } from './guarded-json-file.ts';
import { withWorkspaceDataLock } from './workspace-data-lock.ts';
import { captureWorkspaceRevision, BatchError } from './batch.ts';
import { planDependencyRelationships, type RelationshipData } from './relationship-generation.ts';

type Scope = { entryIds?: string[] };
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function parseScope(raw: unknown): Scope {
  if (!object(raw) || Object.keys(raw).some(k => k !== 'entryIds')) throw new TypeError('scope must be an object with only optional entryIds.');
  if (Object.hasOwn(raw, 'entryIds') && (!Array.isArray(raw.entryIds) || !raw.entryIds.every(x => typeof x === 'string' && x.length > 0))) throw new TypeError('scope.entryIds must be an array of non-empty strings.');
  return raw as Scope;
}
async function validate(root: string) {
  const result = await validateManagedWorkspace(root);
  if (!result.valid) throw new BatchError('workspace.invalid', 'Relationship generation requires a valid workspace.', 1, result);
  return result;
}

/** Extension-compatible derivation, one shared-lock/whole-authority CAS per invocation.
 * The existing guarded file writer retains original bytes until post-write validation
 * and fsync succeed. No handwritten storage path or per-edge mutation loop is used.
 */
export async function generateRelationships(root: string, args: { scope?: unknown; expectedWorkspaceRevision?: string; dryRun?: boolean }) {
  const scope = parseScope(args.scope ?? {});
  const dryRun = args.dryRun ?? false;
  if (typeof dryRun !== 'boolean') throw new TypeError('dryRun must be a boolean.');
  if (!dryRun && (typeof args.expectedWorkspaceRevision !== 'string' || !args.expectedWorkspaceRevision)) throw new TypeError('Apply requires expectedWorkspaceRevision from a dry-run.');
  if (args.expectedWorkspaceRevision !== undefined && (typeof args.expectedWorkspaceRevision !== 'string' || !args.expectedWorkspaceRevision)) throw new TypeError('expectedWorkspaceRevision must be a non-empty string.');
  const derive = async () => {
    const beforeRevision = await captureWorkspaceRevision(root, !dryRun);
    if (args.expectedWorkspaceRevision !== undefined && args.expectedWorkspaceRevision !== beforeRevision) throw new BatchError('relationship.workspace-conflict', 'Workspace changed; rerun relationship generation dry-run.');
    await validate(root);
    const file = path.join(root, '.SNL_Doc', 'relationships.json');
    const original = await readRegularText(file);
    const envelope: unknown = JSON.parse(original.text);
    if (!object(envelope) || !Array.isArray(envelope.relationships)) throw new BatchError('workspace.invalid', 'relationships.json must contain a relationships array.');
    const [entries, macros] = await Promise.all([readEntries(root), readActiveMacros(root)]);
    if (scope.entryIds) {
      const allIds = new Set(entries.map(e => e.id));
      for (const id of scope.entryIds) if (!allIds.has(id)) throw new BatchError('entry.not-found', `Unknown scope Entry ${JSON.stringify(id)}.`);
    }
    const plan = planDependencyRelationships(entries, macros, envelope.relationships as RelationshipData[], { entryIds: scope.entryIds ? new Set(scope.entryIds) : null });
    if (await captureWorkspaceRevision(root, !dryRun) !== beforeRevision) throw new BatchError('relationship.workspace-conflict', 'Workspace changed during derivation; no write performed.');
    return { plan, beforeRevision, original, envelope, file };
  };
  if (dryRun) {
    const { plan, beforeRevision } = await derive();
    return { ...plan, dryRun: true, expectedWorkspaceRevision: beforeRevision };
  }
  // Validate root confinement before acquiring a lock (which writes a file).
  await captureWorkspaceRevision(root);
  return withWorkspaceDataLock(root, 'relationship-generation', async () => {
    const { plan, beforeRevision, original, envelope, file } = await derive();
    const unchanged = isDeepStrictEqual(envelope.relationships, plan.relationships);
    if (!unchanged) {
      await replaceJsonIfUnchanged(file, original.text, { ...envelope, relationships: plan.relationships }, {
        beforeDirectorySync: async () => {
          await validate(root);
          const readback = JSON.parse((await readRegularText(file)).text);
          if (!isDeepStrictEqual(readback, { ...envelope, relationships: plan.relationships })) throw new BatchError('relationship.readback-failed', 'Relationship readback differs from derived snapshot.');
        },
      });
    }
    return { ...plan, dryRun: false, changed: !unchanged, previousWorkspaceRevision: beforeRevision,
      resultingWorkspaceRevision: await captureWorkspaceRevision(root, true) };
  });
}
