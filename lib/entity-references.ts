import { constants } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import {
  findNodeAtLocation,
  applyEdits as applyJsonEdits,
  modify as modifyJson,
  parseTree,
  printParseErrorCode,
  type JSONPath,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser';
import {
  readActiveMacros,
  readEntries,
  snlDocRoot,
  usesCurrentEntitySchemas,
  usesEntityStorage,
} from './snl-doc.ts';
import {
  CURRENT_ENTRY_SCHEMA_VERSION,
  CURRENT_MACRO_SCHEMA_VERSION,
  entryEntityPath,
  macroEntityPath,
  packageManifestPath,
} from './entity-storage.ts';
import { parseSnlSyntaxTree } from './snl-parser.ts';
import { withWorkspaceDataLock } from './workspace-data-lock.ts';

export type EntityType = 'entry' | 'macro';
export type OccurrenceRole = 'definition' | 'reference';

export interface EntityOccurrence {
  entityType: EntityType;
  id: string;
  role: OccurrenceRole;
  category: 'definition' | 'snl' | 'library-index' | 'macro-source' | 'package-membership' | 'relationship' | 'generated-witness';
  file: string;
  path: string;
  offset?: number;
  snlLine?: number;
  snlColumn?: number;
}

export interface RenamePlan {
  entityType: EntityType;
  oldId: string;
  newId: string;
  occurrences: EntityOccurrence[];
  changedFiles: string[];
  sourceRevisions: Array<{ file: string; sha256: string }>;
  plannedOutputs: Array<{ sourceFile: string; targetFile: string; sha256: string }>;
  /** SHA-256 integrity digest of every other serializable plan field. */
  fingerprint: string;
}

export interface StyleOccurrence {
  category: 'style-definition' | 'default-style' | 'snl-style';
  file: string;
  path: string;
  offset?: number;
  snlLine?: number;
  snlColumn?: number;
}

export interface StyleRenamePlan {
  packageId: string;
  macroId: string;
  oldStyle: string;
  newStyle: string;
  occurrences: StyleOccurrence[];
  changedFiles: string[];
  sourceRevisions: Array<{ file: string; sha256: string }>;
  plannedOutputs: Array<{ sourceFile: string; targetFile: string; sha256: string }>;
  /** SHA-256 integrity digest of every other serializable plan field. */
  fingerprint: string;
}

interface LoadedJson {
  absPath: string;
  relPath: string;
  raw: string;
  data: unknown;
  tree: JsonNode;
  mode: number;
  device: number;
  inode: number;
  docRoot: string;
}

interface TextEdit {
  offset: number;
  length: number;
  content: string;
}

type PlannedOutput = { sourceFile: string; targetFile: string; sha256: string };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function comparePlannedOutput(left: PlannedOutput, right: PlannedOutput): number {
  return left.sourceFile.localeCompare(right.sourceFile) ||
    left.targetFile.localeCompare(right.targetFile) || left.sha256.localeCompare(right.sha256);
}

function canonicalJson(value: unknown): string | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item) ?? 'null').join(',')}]`;
  }
  const fields = Object.keys(value as Record<string, unknown>).sort().flatMap((key) => {
    const encoded = canonicalJson((value as Record<string, unknown>)[key]);
    return encoded === undefined ? [] : [`${JSON.stringify(key)}:${encoded}`];
  });
  return `{${fields.join(',')}}`;
}

function planFingerprint(plan: Record<string, unknown>): string {
  const payload = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== 'fingerprint'));
  return sha256(canonicalJson(payload) ?? '');
}

function fingerprintPlan<T extends { fingerprint: string }>(payload: Omit<T, 'fingerprint'>): T {
  const plan = payload as T;
  plan.fingerprint = planFingerprint(plan as unknown as Record<string, unknown>);
  return plan;
}

function assertPlanFingerprint(plan: RenamePlan | StyleRenamePlan): void {
  if (!/^[a-f0-9]{64}$/.test(plan.fingerprint) ||
      planFingerprint(plan as unknown as Record<string, unknown>) !== plan.fingerprint) {
    // SHA-256 detects DTO mutation; it is integrity, not authentication. A future
    // Extension host must retain the reviewed plan (or an opaque trusted token)
    // to preserve user-confirmation authority across an external caller boundary.
    throw new Error('Rename plan integrity check failed; rescan before applying.');
  }
}

type InertJson = null | boolean | number | string | readonly InertJson[] | { [key: string]: InertJson };

function snapshotInertJson(value: unknown, label: string, seen = new Set<object>()): InertJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    throw new Error(`${label} contains a non-JSON number.`);
  }
  if (typeof value !== 'object' || utilTypes.isProxy(value)) {
    throw new Error(`${label} must be inert plain JSON data.`);
  }
  if (seen.has(value)) throw new Error(`${label} must not contain cycles.`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new Error(`${label} must use plain Array values.`);
      }
      const keys = Reflect.ownKeys(value);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      const hasExactOwnKeys = keys.length === value.length + 1 && keys.every((key) => {
        if (key === 'length') return true;
        if (typeof key !== 'string') return false;
        const index = Number(key);
        return Number.isInteger(index) && index >= 0 && index < value.length &&
          index < 0xffff_ffff && String(index) === key;
      });
      if (!hasExactOwnKeys || !lengthDescriptor || !('value' in lengthDescriptor) ||
          lengthDescriptor.value !== value.length || lengthDescriptor.enumerable || lengthDescriptor.configurable) {
        throw new Error(`${label} contains non-JSON Array properties.`);
      }
      const snapshot: InertJson[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${label}[${index}] must be an inert data property.`);
        }
        snapshot.push(snapshotInertJson(descriptor.value, `${label}[${index}]`, seen));
      }
      return Object.freeze(snapshot);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${label} must contain only plain objects.`);
    }
    const snapshot: { [key: string]: InertJson } = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw new Error(`${label} must not contain symbol properties.`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new Error(`${label}.${key} must be an inert enumerable data property.`);
      }
      Object.defineProperty(snapshot, key, {
        value: snapshotInertJson(descriptor.value, `${label}.${key}`, seen),
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return Object.freeze(snapshot);
  } finally {
    seen.delete(value);
  }
}

function assertExactFields(value: Record<string, unknown>, fields: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new Error(`${label} has unexpected or missing fields.`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
}

function assertOptionalLocation(value: Record<string, unknown>, label: string): void {
  for (const field of ['offset', 'snlLine', 'snlColumn']) {
    if (field in value && (!Number.isSafeInteger(value[field]) || (value[field] as number) < 0)) {
      throw new Error(`${label}.${field} must be a non-negative safe integer.`);
    }
  }
}

function assertRevisionList(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} must be an Array.`);
  value.forEach((revision, index) => {
    if (!isRecord(revision)) throw new Error(`${label}[${index}] must be an object.`);
    assertExactFields(revision, ['file', 'sha256'], `${label}[${index}]`);
    assertString(revision.file, `${label}[${index}].file`);
    if (typeof revision.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(revision.sha256)) {
      throw new Error(`${label}[${index}].sha256 must be a SHA-256 digest.`);
    }
  });
}

function assertOutputList(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} must be an Array.`);
  value.forEach((output, index) => {
    if (!isRecord(output)) throw new Error(`${label}[${index}] must be an object.`);
    assertExactFields(output, ['sourceFile', 'targetFile', 'sha256'], `${label}[${index}]`);
    assertString(output.sourceFile, `${label}[${index}].sourceFile`);
    assertString(output.targetFile, `${label}[${index}].targetFile`);
    if (typeof output.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(output.sha256)) {
      throw new Error(`${label}[${index}].sha256 must be a SHA-256 digest.`);
    }
  });
}

function assertCommonPlanFields(plan: Record<string, unknown>, label: string): void {
  if (!Array.isArray(plan.changedFiles) || !plan.changedFiles.every((file) => typeof file === 'string')) {
    throw new Error(`${label}.changedFiles must be an Array of strings.`);
  }
  assertRevisionList(plan.sourceRevisions, `${label}.sourceRevisions`);
  assertOutputList(plan.plannedOutputs, `${label}.plannedOutputs`);
  if (typeof plan.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(plan.fingerprint)) {
    throw new Error(`${label}.fingerprint must be a SHA-256 digest.`);
  }
}

function materializeEntityPlan(submitted: unknown): RenamePlan {
  const plan = snapshotInertJson(submitted, 'Entity rename plan') as Record<string, unknown>;
  assertExactFields(plan, [
    'entityType', 'oldId', 'newId', 'occurrences', 'changedFiles',
    'sourceRevisions', 'plannedOutputs', 'fingerprint',
  ], 'Entity rename plan');
  if (plan.entityType !== 'entry' && plan.entityType !== 'macro') {
    throw new Error('Entity rename plan.entityType is invalid.');
  }
  assertString(plan.oldId, 'Entity rename plan.oldId');
  assertString(plan.newId, 'Entity rename plan.newId');
  if (!Array.isArray(plan.occurrences)) throw new Error('Entity rename plan.occurrences must be an Array.');
  plan.occurrences.forEach((occurrence, index) => {
    if (!isRecord(occurrence)) throw new Error(`Entity rename plan.occurrences[${index}] must be an object.`);
    const required = ['entityType', 'id', 'role', 'category', 'file', 'path'];
    const optional = ['offset', 'snlLine', 'snlColumn'].filter((field) => field in occurrence);
    assertExactFields(occurrence, [...required, ...optional], `Entity rename plan.occurrences[${index}]`);
    if (occurrence.entityType !== 'entry' && occurrence.entityType !== 'macro') throw new Error('Invalid occurrence entityType.');
    if (occurrence.role !== 'definition' && occurrence.role !== 'reference') throw new Error('Invalid occurrence role.');
    if (!['definition', 'snl', 'library-index', 'macro-source', 'relationship', 'generated-witness'].includes(occurrence.category as string)) {
      throw new Error('Invalid occurrence category.');
    }
    for (const field of ['id', 'file', 'path']) assertString(occurrence[field], `Entity occurrence.${field}`);
    assertOptionalLocation(occurrence, `Entity rename plan.occurrences[${index}]`);
  });
  assertCommonPlanFields(plan, 'Entity rename plan');
  assertPlanFingerprint(plan as unknown as RenamePlan);
  return plan as unknown as RenamePlan;
}

function materializeStylePlan(submitted: unknown): StyleRenamePlan {
  const plan = snapshotInertJson(submitted, 'Style rename plan') as Record<string, unknown>;
  assertExactFields(plan, [
    'packageId', 'macroId', 'oldStyle', 'newStyle', 'occurrences',
    'changedFiles', 'sourceRevisions', 'plannedOutputs', 'fingerprint',
  ], 'Style rename plan');
  for (const field of ['packageId', 'macroId', 'oldStyle', 'newStyle']) {
    assertString(plan[field], `Style rename plan.${field}`);
  }
  if (!Array.isArray(plan.occurrences)) throw new Error('Style rename plan.occurrences must be an Array.');
  plan.occurrences.forEach((occurrence, index) => {
    if (!isRecord(occurrence)) throw new Error(`Style rename plan.occurrences[${index}] must be an object.`);
    const required = ['category', 'file', 'path'];
    const optional = ['offset', 'snlLine', 'snlColumn'].filter((field) => field in occurrence);
    assertExactFields(occurrence, [...required, ...optional], `Style rename plan.occurrences[${index}]`);
    if (!['style-definition', 'default-style', 'snl-style'].includes(occurrence.category as string)) {
      throw new Error('Invalid Style occurrence category.');
    }
    assertString(occurrence.file, 'Style occurrence.file');
    assertString(occurrence.path, 'Style occurrence.path');
    assertOptionalLocation(occurrence, `Style rename plan.occurrences[${index}]`);
  });
  assertCommonPlanFields(plan, 'Style rename plan');
  assertPlanFingerprint(plan as unknown as StyleRenamePlan);
  return plan as unknown as StyleRenamePlan;
}

function sameCanonicalPlan(left: RenamePlan | StyleRenamePlan, right: RenamePlan | StyleRenamePlan): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

interface SnlToken {
  type: 'ident' | 'at' | 'hash' | 'lparen' | 'rparen' | 'lbracket' | 'rbracket' | 'comma' | 'eq' | 'delimited';
  value: string;
  start: number;
  end: number;
}

interface SnlReference {
  entityType: EntityType;
  id: string;
  start: number;
  end: number;
}

/** Find definitions and structured references to one Entry or Macro identity. */
export async function findEntityReferences(
  workspaceRoot: string,
  entityType: EntityType,
  id: string,
): Promise<EntityOccurrence[]> {
  const canonicalWorkspace = await validateWorkspaceBoundary(workspaceRoot);
  validateNonEmptyIdentity(id);
  const files = await loadWorkspaceJson(canonicalWorkspace);
  return collectOccurrences(files, entityType, id).sort(compareOccurrence);
}

/**
 * Rename one identity and every structured reference to it.
 *
 * All schema-owned files are parsed and source-range edits are planned before
 * any write. The function refuses a missing/ambiguous source identity, a
 * destination collision, malformed schema/SNL, symlinked files, or concurrent
 * source changes. Writes use same-directory temp files; if a replacement
 * fails, already-installed files are restored before the error is rethrown.
 * This rollback protocol is not crash-atomic across multiple files.
 */
interface RenameOptions {
  dryRun?: boolean;
  beforeInstall?: () => void | Promise<void>;
  /** Test hook for deterministic non-cooperative write interleavings. */
  beforeInstallFile?: (relativePath: string) => void | Promise<void>;
  /** Test hook for deterministic rollback failures. */
  beforeRestoreFile?: (relativePath: string) => void | Promise<void>;
}

export async function renameEntityId(
  workspaceRoot: string,
  entityType: EntityType,
  oldId: string,
  newId: string,
  options: RenameOptions = {},
): Promise<RenamePlan> {
  const canonicalWorkspace = await validateWorkspaceBoundary(workspaceRoot);
  if (options.dryRun) {
    return renameEntityIdUnlocked(canonicalWorkspace, entityType, oldId, newId, options);
  }
  return withWorkspaceDataLock(canonicalWorkspace, `rename ${entityType} identity`, () =>
    renameEntityIdUnlocked(canonicalWorkspace, entityType, oldId, newId, options));
}

/** Build a complete rename proposal without writing workspace data. */
export async function planEntityRename(
  workspaceRoot: string,
  entityType: EntityType,
  oldId: string,
  newId: string,
): Promise<RenamePlan> {
  const canonicalWorkspace = await validateWorkspaceBoundary(workspaceRoot);
  return renameEntityIdUnlocked(canonicalWorkspace, entityType, oldId, newId, { dryRun: true });
}

/** Apply an inspected proposal, requiring the exact source snapshot it was planned from. */
export async function applyEntityRename(
  workspaceRoot: string,
  plan: RenamePlan,
  options: Omit<RenameOptions, 'dryRun'> = {},
): Promise<RenamePlan> {
  const reviewedPlan = materializeEntityPlan(plan);
  const canonicalWorkspace = await validateWorkspaceBoundary(workspaceRoot);
  return withWorkspaceDataLock(canonicalWorkspace, 'apply reviewed entity rename', async () =>
    renameEntityIdUnlocked(
      canonicalWorkspace, reviewedPlan.entityType, reviewedPlan.oldId, reviewedPlan.newId,
      options, reviewedPlan,
    ));
}

export async function planStyleRename(
  workspaceRoot: string, packageId: string, macroId: string, oldStyle: string, newStyle: string,
): Promise<StyleRenamePlan> {
  return styleRenameUnlocked(await validateWorkspaceBoundary(workspaceRoot), packageId, macroId, oldStyle, newStyle, true);
}

export async function applyStyleRename(workspaceRoot: string, plan: StyleRenamePlan): Promise<StyleRenamePlan> {
  const reviewedPlan = materializeStylePlan(plan);
  const root = await validateWorkspaceBoundary(workspaceRoot);
  return withWorkspaceDataLock(root, 'apply reviewed Style rename', async () =>
    styleRenameUnlocked(
      root, reviewedPlan.packageId, reviewedPlan.macroId,
      reviewedPlan.oldStyle, reviewedPlan.newStyle, false, reviewedPlan,
    ));
}

export async function renameStyle(
  workspaceRoot: string, packageId: string, macroId: string, oldStyle: string, newStyle: string,
  options: { dryRun?: boolean } = {},
): Promise<StyleRenamePlan> {
  const plan = await planStyleRename(workspaceRoot, packageId, macroId, oldStyle, newStyle);
  return options.dryRun ? plan : applyStyleRename(workspaceRoot, plan);
}

async function styleRenameUnlocked(
  root: string, packageId: string, macroId: string, oldStyle: string, newStyle: string, dryRun: boolean,
  expectedPlan?: StyleRenamePlan,
): Promise<StyleRenamePlan> {
  for (const [label, value] of [['Package', packageId], ['Macro', macroId], ['old Style', oldStyle], ['new Style', newStyle]]) {
    if (!value.trim()) throw new Error(`${label} identity must be non-empty.`);
  }
  if (oldStyle === newStyle) throw new Error('Old and new Style names are identical.');
  if (!isTraceableSnlIdentity('macro', newStyle)) throw new Error(`Style name '${newStyle}' is not representable as an SNL identifier.`);
  const files = await loadWorkspaceJson(root);
  const { occurrences, changed } = buildStyleRename(files, packageId, macroId, oldStyle, newStyle);
  const currentWorkspace = usesCurrentEntitySchemas(files.find((file) => file.relPath === 'config.json')?.data);
  if (currentWorkspace) {
    for (const file of changed.values()) {
      if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
        file.next = stampSchemaVersion(file.next, CURRENT_ENTRY_SCHEMA_VERSION);
      } else if (/^macros\/[^/]+\.json$/.test(file.relPath)) {
        file.next = stampSchemaVersion(file.next, CURRENT_MACRO_SCHEMA_VERSION);
      }
    }
  }
  const plan = fingerprintPlan<StyleRenamePlan>({
    packageId, macroId, oldStyle, newStyle,
    occurrences: occurrences.sort((a, b) => a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || (a.offset ?? -1) - (b.offset ?? -1)),
    changedFiles: [...changed.values()].map((file) => file.relPath).sort(),
    sourceRevisions: files.map((file) => ({ file: file.relPath, sha256: createHash('sha256').update(file.raw).digest('hex') })),
    plannedOutputs: [...changed.values()].map((file) => ({
      sourceFile: file.relPath,
      targetFile: file.relPath,
      sha256: sha256(file.next),
    })).sort(comparePlannedOutput),
  });
  if (expectedPlan && !sameCanonicalPlan(plan, expectedPlan)) {
    throw new Error('Style rename plan is stale because workspace sources or planned outputs changed; rescan before applying.');
  }
  if (dryRun) return plan;
  const replacements = [...changed.values()].map((file) => ({
    ...file, targetAbsPath: file.absPath,
    temp: `${file.absPath}.snl-style-rename-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`,
  }));
  try {
    await Promise.all(replacements.map(async (file) => {
      await fs.writeFile(file.temp, file.next, { encoding: 'utf8', mode: file.mode, flag: 'wx' });
      await fs.chmod(file.temp, file.mode);
    }));
    for (const file of replacements) await assertUnchangedRegularFile(file);
    const installed: typeof replacements = [];
    try {
      for (const file of replacements) {
        await assertUnchangedRegularFile(file);
        await fs.rename(file.temp, file.absPath);
        installed.push(file);
      }
      const reverse = buildStyleRename(await loadWorkspaceJson(root), packageId, macroId, newStyle, oldStyle);
      if (reverse.occurrences.length !== occurrences.length) {
        throw new Error(`Post-write Style verification failed: new=${reverse.occurrences.length}, expected=${occurrences.length}.`);
      }
    } catch (error) {
      const failures = (await Promise.all(installed.map(async (file) => {
        try { await restoreReplacement(file); return null; }
        catch (rollbackError) { return `${file.relPath}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`; }
      }))).filter((message): message is string => message !== null);
      if (failures.length) throw new Error(`${error instanceof Error ? error.message : String(error)} Rollback failed for ${failures.join('; ')}.`);
      throw error;
    }
  } finally {
    await Promise.all(replacements.map((file) => fs.rm(file.temp, { force: true })));
  }
  return plan;
}

function buildStyleRename(
  files: LoadedJson[], packageId: string, macroId: string, oldStyle: string, newStyle: string,
): { occurrences: StyleOccurrence[]; changed: Map<string, LoadedJson & { next: string }> } {
  const occurrences: StyleOccurrence[] = [];
  const editsByFile = new Map<LoadedJson, TextEdit[]>();
  const definitions: Array<{ file: LoadedJson; macro: any; base: JSONPath }> = [];
  for (const file of files) {
    const data = file.data as any;
    if (/^macros\/[^/]+\.json$/.test(file.relPath) && data?.package === packageId && data?.macro?.name === macroId) {
      definitions.push({ file, macro: data.macro, base: ['macro'] });
    } else if (file.relPath === `term_macros/${packageId}.json` && isRecord(data?.macros) && Object.prototype.hasOwnProperty.call(data.macros, macroId)) {
      definitions.push({ file, macro: data.macros[macroId], base: ['macros', macroId] });
    }
  }
  if (definitions.length !== 1) throw new Error(`Expected one Macro definition for (${packageId}, ${macroId}), found ${definitions.length}.`);
  const definition = definitions[0];
  if (!Array.isArray(definition.macro.styles)) throw new Error(`Macro ${macroId} must contain styles[].`);
  const oldIndexes = definition.macro.styles.flatMap((style: any, index: number) => style?.style_name === oldStyle ? [index] : []);
  if (oldIndexes.length !== 1) throw new Error(`Expected one Style definition '${oldStyle}' on Macro '${macroId}', found ${oldIndexes.length}.`);
  if (definition.macro.styles.some((style: any) => style?.style_name === newStyle)) throw new Error(`Style '${newStyle}' already exists on Macro '${macroId}'.`);
  const addEdit = (file: LoadedJson, edit: TextEdit): void => {
    const edits = editsByFile.get(file) ?? [];
    edits.push(edit);
    editsByFile.set(file, edits);
  };
  const stylePath = [...definition.base, 'styles', oldIndexes[0], 'style_name'];
  addEdit(definition.file, stringValueEdit(definition.file, stylePath, newStyle));
  occurrences.push({ category: 'style-definition', file: definition.file.relPath, path: jsonPathLabel(stylePath) });
  if (isRecord(definition.macro.default_style)) {
    for (const [locale, value] of Object.entries(definition.macro.default_style)) {
      if (value !== oldStyle) continue;
      const defaultPath = [...definition.base, 'default_style', locale];
      addEdit(definition.file, stringValueEdit(definition.file, defaultPath, newStyle));
      occurrences.push({ category: 'default-style', file: definition.file.relPath, path: jsonPathLabel(defaultPath) });
    }
  }
  const resolved = targetMacroResolves(files, packageId, macroId);
  for (const file of files) {
    for (const source of snlSources(file)) {
      const selections = scanSnlStyleSelections(source.value);
      if (!resolved) continue;
      const matches = selections.filter((selection) => selection.macroId === macroId && selection.styleName === oldStyle);
      if (!matches.length) continue;
      let next = source.value;
      for (const match of [...matches].reverse()) next = next.slice(0, match.start) + newStyle + next.slice(match.end);
      addEdit(file, stringValueEdit(file, source.jsonPath, next));
      for (const match of matches) {
        const position = offsetPosition(source.value, match.start);
        occurrences.push({ category: 'snl-style', file: file.relPath, path: jsonPathLabel(source.jsonPath), offset: match.start, snlLine: position.line, snlColumn: position.column });
      }
    }
  }
  const changed = new Map<string, LoadedJson & { next: string }>();
  for (const [file, edits] of editsByFile) changed.set(file.absPath, { ...file, next: applyTextEdits(file.raw, edits) });
  return { occurrences, changed };
}

function snlSources(file: LoadedJson): Array<{ value: string; jsonPath: JSONPath }> {
  const data = file.data as any;
  if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
    const value = data?.entry?.content?.snl;
    return typeof value === 'string' && value.trim() ? [{ value, jsonPath: ['entry', 'content', 'snl'] }] : [];
  }
  if (file.relPath === 'entries.json' && Array.isArray(data)) {
    return data.flatMap((entry: any, index: number) => typeof entry?.content?.snl === 'string' && entry.content.snl.trim()
      ? [{ value: entry.content.snl, jsonPath: [index, 'content', 'snl'] }] : []);
  }
  return [];
}

function scanSnlStyleSelections(source: string): Array<{ macroId: string; styleName: string; start: number; end: number }> {
  parseSnlSyntaxTree(source);
  const tokens = tokenizeSnl(source);
  const out: Array<{ macroId: string; styleName: string; start: number; end: number }> = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const macro = tokens[index];
    if (macro.type !== 'ident' || tokens[index - 1]?.type === 'lbracket') continue;
    if (tokens[index - 1]?.type === 'at' && isPostfixAt(tokens[index - 2])) continue;
    let cursor = index + 1;
    if (tokens[cursor]?.type === 'at' && tokens[cursor + 1]?.type === 'ident') cursor += 2;
    const style = tokens[cursor + 1];
    if (tokens[cursor]?.type === 'lbracket' && style?.type === 'ident' && tokens[cursor + 2]?.type === 'rbracket') {
      out.push({ macroId: macro.value, styleName: style.value, start: style.start, end: style.end });
    }
  }
  return out;
}

function targetMacroResolves(files: LoadedJson[], packageId: string, macroId: string): boolean {
  const config = files.find((file) => file.relPath === 'config.json')?.data as any;
  const active = Array.isArray(config?.active_macro_packages) ? new Set<string>(config.active_macro_packages) : null;
  const packages: string[] = [];
  for (const file of files) {
    const data = file.data as any;
    if (/^macros\/[^/]+\.json$/.test(file.relPath) && data?.macro?.name === macroId && typeof data.package === 'string') packages.push(data.package);
    if (file.relPath.startsWith('term_macros/') && isRecord(data?.macros) && Object.prototype.hasOwnProperty.call(data.macros, macroId)) packages.push(path.posix.basename(file.relPath, '.json'));
  }
  const candidates = [...new Set(packages)].filter((id) => !active || active.has(id)).sort((a, b) => `${a}.json`.localeCompare(`${b}.json`));
  return candidates.at(-1) === packageId;
}

function jsonPathLabel(jsonPath: JSONPath): string {
  return jsonPath.map((part, index) => typeof part === 'number' ? `[${part}]` : index === 0 ? part : `.${part}`).join('');
}

async function renameEntityIdUnlocked(
  canonicalWorkspace: string,
  entityType: EntityType,
  oldId: string,
  newId: string,
  options: RenameOptions,
  expectedPlan?: RenamePlan,
): Promise<RenamePlan> {
  validateNonEmptyIdentity(oldId);
  validateNonEmptyIdentity(newId);
  if (entityType === 'macro' && /[@#$%\s()[\]{}]/u.test(newId)) {
    throw new Error(
      `Macro id '${newId}' contains a character forbidden by the SNL-Doc macro schema.`,
    );
  }
  if (oldId === newId) throw new Error('Old and new ids are identical.');

  const files = await loadWorkspaceJson(canonicalWorkspace);
  const occurrences = collectOccurrences(files, entityType, oldId).sort(compareOccurrence);
  const definitions = occurrences.filter((o) => o.role === 'definition');
  if (definitions.length === 0) {
    throw new Error(`No ${entityType} definition found for '${oldId}'.`);
  }
  if (definitions.length !== 1) {
    throw new Error(
      `Expected one ${entityType} definition for '${oldId}', found ${definitions.length}; resolve the identity collision before renaming.`,
    );
  }
  if (
    occurrences.some((o) => o.path.endsWith('.content.snl')) &&
    !isTraceableSnlIdentity(entityType, newId)
  ) {
    throw new Error(
      `${entityType} id '${newId}' is not representable as an SNL identifier, but '${oldId}' has SNL references.`,
    );
  }
  const destinationOccurrences = collectOccurrences(files, entityType, newId, {
    includeUnresolvedMacroTokens: entityType === 'macro',
  });
  if (destinationOccurrences.length > 0) {
    throw new Error(
      `${entityType} id '${newId}' already appears in ${destinationOccurrences.length} structured location(s); refusing to merge two identities.`,
    );
  }

  const rewriteSnlMacroTokens = entityType !== 'macro' || macroIsActive(files, oldId);
  const currentWorkspace = usesCurrentEntitySchemas(files.find((file) => file.relPath === 'config.json')?.data);
  const changed = new Map<string, LoadedJson & { next: string; targetAbsPath: string; targetRelPath: string }>();
  for (const file of files) {
    const edits = buildStructuredEdits(
      file, entityType, oldId, newId, rewriteSnlMacroTokens,
    );
    if (edits.length > 0) {
      let targetRelPath = file.relPath;
      if (entityType === 'entry' && /^entries\/[^/]+\.json$/.test(file.relPath) &&
          (file.data as any)?.entry?.id === oldId) {
        targetRelPath = entryEntityPath((file.data as any).package, newId);
      } else if (entityType === 'macro' && /^macros\/[^/]+\.json$/.test(file.relPath) &&
                 (file.data as any)?.macro?.name === oldId) {
        targetRelPath = macroEntityPath((file.data as any).package, newId);
      }
      let next = applyTextEdits(file.raw, edits);
      if (currentWorkspace && /^entries\/[^/]+\.json$/.test(file.relPath)) {
        next = stampSchemaVersion(next, CURRENT_ENTRY_SCHEMA_VERSION);
      } else if (currentWorkspace && /^macros\/[^/]+\.json$/.test(file.relPath)) {
        next = stampSchemaVersion(next, CURRENT_MACRO_SCHEMA_VERSION);
      }
      changed.set(file.absPath, {
        ...file,
        next,
        targetAbsPath: path.join(file.docRoot, targetRelPath),
        targetRelPath,
      });
    }
  }

  const plan = fingerprintPlan<RenamePlan>({
    entityType,
    oldId,
    newId,
    occurrences,
    changedFiles: [...changed.values()].map((f) => f.targetRelPath).sort(),
    sourceRevisions: files.map((file) => ({
      file: file.relPath,
      sha256: createHash('sha256').update(file.raw).digest('hex'),
    })),
    plannedOutputs: [...changed.values()].map((file) => ({
      sourceFile: file.relPath,
      targetFile: file.targetRelPath,
      sha256: sha256(file.next),
    })).sort(comparePlannedOutput),
  });
  if (expectedPlan && !sameCanonicalPlan(plan, expectedPlan)) {
    throw new Error('Rename plan is stale because workspace sources or planned outputs changed; rescan before applying.');
  }
  if (options.dryRun || changed.size === 0) return plan;

  const replacements = [...changed.values()].map((file) => ({
    ...file,
    temp: `${file.targetAbsPath}.snl-rename-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`,
  }));
  try {
    await Promise.all(
      replacements.map(async (file) => {
        await assertCanonicalDirectory(path.dirname(file.targetAbsPath), file.docRoot);
        if (file.targetAbsPath !== file.absPath && await pathExistsNoFollow(file.targetAbsPath)) {
          throw new Error(`Rename destination already exists: ${file.targetAbsPath}.`);
        }
        await fs.writeFile(file.temp, file.next, {
          encoding: 'utf8', mode: file.mode, flag: 'wx',
        });
        await fs.chmod(file.temp, file.mode);
      }),
    );
    if (options.beforeInstall) await options.beforeInstall();
    // Optimistic concurrency + symlink defense: refuse to install if any
    // source changed since planning. This cannot make a multi-file commit
    // crash-atomic, but it prevents silently overwriting cooperative edits.
    for (const file of replacements) await assertUnchangedRegularFile(file);

    const installed: typeof replacements = [];
    try {
      for (const file of replacements) {
        if (options.beforeInstallFile) await options.beforeInstallFile(file.relPath);
        await assertUnchangedRegularFile(file);
        await assertCanonicalDirectory(path.dirname(file.targetAbsPath), file.docRoot);
        if (file.targetAbsPath !== file.absPath && await pathExistsNoFollow(file.targetAbsPath)) {
          throw new Error(`Rename destination already exists: ${file.targetAbsPath}.`);
        }
        if (file.targetAbsPath === file.absPath) {
          await fs.rename(file.temp, file.absPath);
          installed.push(file);
        } else {
          // Hard-link installation is no-clobber: a concurrent destination
          // creation fails with EEXIST instead of being silently overwritten.
          await fs.link(file.temp, file.targetAbsPath);
          installed.push(file);
          await fs.rm(file.temp);
          await fs.rm(file.absPath);
        }
      }
      const verifiedFiles = await loadWorkspaceJson(canonicalWorkspace);
      const stale = collectOccurrences(verifiedFiles, entityType, oldId);
      const current = collectOccurrences(verifiedFiles, entityType, newId);
      const currentDefinitions = current.filter((o) => o.role === 'definition');
      if (stale.length !== 0 || current.length !== occurrences.length || currentDefinitions.length !== 1) {
        throw new Error(
          `Post-write verification failed: old=${stale.length}, new=${current.length}, definitions=${currentDefinitions.length}, expected=${occurrences.length}.`,
        );
      }
    } catch (error) {
      const rollbackFailures = (await Promise.all(installed.map(async (file) => {
        try {
          if (options.beforeRestoreFile) await options.beforeRestoreFile(file.relPath);
          await restoreReplacement(file);
          return null;
        } catch (rollbackError) {
          return `${file.relPath}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`;
        }
      }))).filter((message): message is string => message !== null);
      if (rollbackFailures.length > 0) {
        const original = error instanceof Error ? error.message : String(error);
        const combined = new Error(
          `${original} Rollback failed for ${rollbackFailures.join('; ')}. Workspace may be inconsistent.`,
        ) as Error & { cause?: unknown };
        combined.cause = error;
        throw combined;
      }
      throw error;
    }
  } finally {
    await Promise.all(replacements.map((f) => fs.rm(f.temp, { force: true })));
  }
  return plan;
}

function macroIsActive(files: LoadedJson[], id: string): boolean {
  const config = files.find((file) => file.relPath === 'config.json')?.data as any;
  const active = Array.isArray(config?.active_macro_packages)
    ? new Set<string>(config.active_macro_packages)
    : null;
  return files.some((file) => {
    if (file.relPath.startsWith('macros/')) {
      const packageId = (file.data as any)?.package;
      if (typeof packageId !== 'string' || (active && !active.has(packageId))) return false;
      return (file.data as any)?.macro?.name === id;
    }
    if (!file.relPath.startsWith('term_macros/')) return false;
    const bare = path.posix.basename(file.relPath, '.json');
    if (active && !active.has(bare)) return false;
    const macros = (file.data as any)?.macros;
    return isRecord(macros) && Object.prototype.hasOwnProperty.call(macros, id);
  });
}

function collectOccurrences(
  files: LoadedJson[],
  entityType: EntityType,
  id: string,
  options: { includeUnresolvedMacroTokens?: boolean } = {},
): EntityOccurrence[] {
  const out: EntityOccurrence[] = [];
  const includeSnlMacroTokens =
    entityType !== 'macro' ||
    options.includeUnresolvedMacroTokens === true ||
    macroIsActive(files, id);
  for (const file of files) {
    collectFileOccurrences(file, entityType, id, out, includeSnlMacroTokens);
  }
  return out;
}

function collectFileOccurrences(
  file: LoadedJson,
  entityType: EntityType,
  id: string,
  out: EntityOccurrence[],
  includeSnlMacroTokens: boolean,
): void {
  const data = file.data as any;
  if (/^packages\/[^/]+\.json$/.test(file.relPath)) {
    if (entityType === 'entry' && Array.isArray(data?.entry_ids)) {
      data.entry_ids.forEach((entryId: unknown, index: number) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType, id, 'reference', `entry_ids[${index}]`));
        }
      });
    }
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
    const entry = data?.entry;
    if (entityType === 'entry' && entry?.id === id) {
      out.push(occurrence(file, entityType, id, 'definition', 'entry.id'));
    }
    const snl = entry?.content?.snl;
    if (typeof snl === 'string' && snl.trim() !== '') {
      for (const ref of scanSnlReferences(snl, {
        postfixedMacroNames: entityType === 'macro' && includeSnlMacroTokens ? new Set([id]) : undefined,
      })) {
        if (ref.entityType !== entityType || ref.id !== id) continue;
        if (entityType === 'macro' && !includeSnlMacroTokens) continue;
        const pos = offsetPosition(snl, ref.start);
        out.push({
          ...occurrence(file, entityType, id, 'reference', 'entry.content.snl'),
          offset: ref.start,
          snlLine: pos.line,
          snlColumn: pos.column,
        });
      }
    }
    return;
  }

  if (/^macros\/[^/]+\.json$/.test(file.relPath)) {
    const macro = data?.macro;
    if (entityType === 'macro' && macro?.name === id) {
      out.push(occurrence(file, entityType, id, 'definition', 'macro.name'));
    }
    if (entityType === 'entry' && Array.isArray(macro?.source?.entries)) {
      macro.source.entries.forEach((entryId: unknown, index: number) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType, id, 'reference', `macro.source.entries[${index}]`));
        }
      });
    }
    return;
  }

  if (file.relPath === 'entries.json' && Array.isArray(data)) {
    data.forEach((entry: any, index: number) => {
      if (entityType === 'entry' && entry?.id === id) {
        out.push(occurrence(file, entityType, id, 'definition', `[${index}].id`));
      }
      const snl = entry?.content?.snl;
      if (typeof snl === 'string' && snl.trim() !== '') {
        for (const ref of scanSnlReferences(snl, {
          postfixedMacroNames: entityType === 'macro' && includeSnlMacroTokens ? new Set([id]) : undefined,
        })) {
          if (ref.entityType !== entityType || ref.id !== id) continue;
          if (entityType === 'macro' && !includeSnlMacroTokens) continue;
          const pos = offsetPosition(snl, ref.start);
          out.push({
            ...occurrence(file, entityType, id, 'reference', `[${index}].content.snl`),
            offset: ref.start,
            snlLine: pos.line,
            snlColumn: pos.column,
          });
        }
      }
    });
    return;
  }

  if (file.relPath.startsWith('term_macros/')) {
    const macros = data?.macros;
    if (!macros || typeof macros !== 'object' || Array.isArray(macros)) return;
    for (const [macroId, macro] of Object.entries(macros) as Array<[string, any]>) {
      if (entityType === 'macro' && macroId === id) {
        out.push(occurrence(file, entityType, id, 'definition', `macros[${JSON.stringify(macroId)}]`));
      }
      if (entityType === 'entry' && Array.isArray(macro?.source?.entries)) {
        macro.source.entries.forEach((entryId: unknown, index: number) => {
          if (entryId === id) {
            out.push(
              occurrence(
                file,
                entityType,
                id,
                'reference',
                `macros[${JSON.stringify(macroId)}].source.entries[${index}]`,
              ),
            );
          }
        });
      }
    }
    return;
  }

  if (entityType === 'entry' && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node: any, index: number) => {
      if (node?.props?.entryId === id) {
        out.push(occurrence(file, entityType, id, 'reference', `nodes[${index}].props.entryId`));
      }
    });
  } else if (file.relPath === 'relationships.json' && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel: any, index: number) => {
      if (entityType === 'entry' && rel?.from === id) {
        out.push(occurrence(file, entityType, id, 'reference', `relationships[${index}].from`));
      }
      if (entityType === 'entry' && rel?.to === id) {
        out.push(occurrence(file, entityType, id, 'reference', `relationships[${index}].to`));
      }
      if (rel?.metadata?.generator !== 'macro-source-scan') return;
      const witnessField = entityType === 'macro' ? 'macros' : 'postfixes';
      const witnesses = rel.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value: unknown, witnessIndex: number) => {
        if (value === id) {
          out.push(
            occurrence(
              file,
              entityType,
              id,
              'reference',
              `relationships[${index}].metadata.${witnessField}[${witnessIndex}]`,
            ),
          );
        }
      });
    });
  }
}

function buildStructuredEdits(
  file: LoadedJson,
  entityType: EntityType,
  oldId: string,
  newId: string,
  rewriteSnlMacroTokens: boolean,
): TextEdit[] {
  const edits: TextEdit[] = [];
  const data = file.data as any;
  if (/^packages\/[^/]+\.json$/.test(file.relPath)) {
    if (entityType === 'entry' && Array.isArray(data?.entry_ids) && data.entry_ids.includes(oldId)) {
      const entryIds = data.entry_ids.map((value: unknown) => value === oldId ? newId : value);
      edits.push(jsonValueEdit(
        file,
        ['entry_ids'],
        [...entryIds].sort((left, right) => String(left).localeCompare(String(right))),
      ));
    }
    return edits;
  }
  if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
    const entry = data?.entry;
    if (entityType === 'entry' && entry?.id === oldId) {
      edits.push(stringValueEdit(file, ['entry', 'id'], newId));
    }
    if (
      typeof entry?.content?.snl === 'string' && entry.content.snl.trim() !== '' &&
      (entityType !== 'macro' || rewriteSnlMacroTokens)
    ) {
      const next = replaceSnlReferences(entry.content.snl, entityType, oldId, newId);
      if (next !== entry.content.snl) {
        edits.push(stringValueEdit(file, ['entry', 'content', 'snl'], next));
      }
    }
    return edits;
  }

  if (/^macros\/[^/]+\.json$/.test(file.relPath)) {
    const macro = data?.macro;
    if (entityType === 'macro' && macro?.name === oldId) {
      edits.push(stringValueEdit(file, ['macro', 'name'], newId));
    }
    if (entityType === 'entry' && Array.isArray(macro?.source?.entries)) {
      macro.source.entries.forEach((value: unknown, index: number) => {
        if (value === oldId) {
          edits.push(stringValueEdit(file, ['macro', 'source', 'entries', index], newId));
        }
      });
    }
    return edits;
  }

  if (file.relPath === 'entries.json' && Array.isArray(data)) {
    data.forEach((entry: any, index: number) => {
      if (entityType === 'entry' && entry?.id === oldId) {
        edits.push(stringValueEdit(file, [index, 'id'], newId));
      }
      if (
        typeof entry?.content?.snl === 'string' &&
        entry.content.snl.trim() !== '' &&
        (entityType !== 'macro' || rewriteSnlMacroTokens)
      ) {
        const next = replaceSnlReferences(entry.content.snl, entityType, oldId, newId);
        if (next !== entry.content.snl) {
          edits.push(stringValueEdit(file, [index, 'content', 'snl'], next));
        }
      }
    });
    return edits;
  }

  if (file.relPath.startsWith('term_macros/')) {
    const macros = data?.macros;
    if (!macros || typeof macros !== 'object' || Array.isArray(macros)) return edits;
    if (entityType === 'macro' && Object.prototype.hasOwnProperty.call(macros, oldId)) {
      edits.push(propertyKeyEdit(file, ['macros', oldId], newId));
    }
    if (entityType === 'entry') {
      for (const [macroId, macro] of Object.entries(macros) as Array<[string, any]>) {
        if (!Array.isArray(macro?.source?.entries)) continue;
        macro.source.entries.forEach((value: unknown, index: number) => {
          if (value === oldId) {
            edits.push(stringValueEdit(file, ['macros', macroId, 'source', 'entries', index], newId));
          }
        });
      }
    }
    return edits;
  }

  if (entityType === 'entry' && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node: any, index: number) => {
      if (node?.props?.entryId === oldId) {
        edits.push(stringValueEdit(file, ['nodes', index, 'props', 'entryId'], newId));
      }
    });
  } else if (file.relPath === 'relationships.json' && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel: any, index: number) => {
      if (entityType === 'entry' && rel?.from === oldId) {
        edits.push(stringValueEdit(file, ['relationships', index, 'from'], newId));
      }
      if (entityType === 'entry' && rel?.to === oldId) {
        edits.push(stringValueEdit(file, ['relationships', index, 'to'], newId));
      }
      if (rel?.metadata?.generator !== 'macro-source-scan') return;
      const witnessField = entityType === 'macro' ? 'macros' : 'postfixes';
      const witnesses = rel.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value: unknown, witnessIndex: number) => {
        if (value === oldId) {
          edits.push(
            stringValueEdit(
              file,
              ['relationships', index, 'metadata', witnessField, witnessIndex],
              newId,
            ),
          );
        }
      });
    });
  }
  return edits;
}

function stringValueEdit(file: LoadedJson, jsonPath: JSONPath, value: string): TextEdit {
  const node = findNodeAtLocation(file.tree, jsonPath);
  if (!node || node.type !== 'string') {
    throw new Error(`${file.absPath}: expected string at ${JSON.stringify(jsonPath)}.`);
  }
  return { offset: node.offset, length: node.length, content: JSON.stringify(value) };
}

function jsonValueEdit(file: LoadedJson, jsonPath: JSONPath, value: unknown): TextEdit {
  const node = findNodeAtLocation(file.tree, jsonPath);
  if (!node) throw new Error(`${file.absPath}: expected value at ${JSON.stringify(jsonPath)}.`);
  return { offset: node.offset, length: node.length, content: JSON.stringify(value) };
}

function stampSchemaVersion(raw: string, schemaVersion: number): string {
  const edits = modifyJson(raw, ['schema_version'], schemaVersion, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: raw.includes('\r\n') ? '\r\n' : '\n' },
  });
  return applyJsonEdits(raw, edits);
}

function propertyKeyEdit(file: LoadedJson, valuePath: JSONPath, key: string): TextEdit {
  const valueNode = findNodeAtLocation(file.tree, valuePath);
  const keyNode = valueNode?.parent?.children?.[0];
  if (!valueNode || valueNode.parent?.type !== 'property' || !keyNode || keyNode.type !== 'string') {
    throw new Error(`${file.absPath}: expected property at ${JSON.stringify(valuePath)}.`);
  }
  return { offset: keyNode.offset, length: keyNode.length, content: JSON.stringify(key) };
}

function applyTextEdits(raw: string, edits: TextEdit[]): string {
  const ordered = [...edits].sort((a, b) => b.offset - a.offset);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i - 1].offset < ordered[i].offset + ordered[i].length) {
      throw new Error('Internal error: overlapping JSON source edits.');
    }
  }
  let next = raw;
  for (const edit of ordered) {
    next = next.slice(0, edit.offset) + edit.content + next.slice(edit.offset + edit.length);
  }
  return next;
}

export function scanSnlReferences(
  source: string,
  options: { postfixedMacroNames?: ReadonlySet<string> } = {},
): SnlReference[] {
  // Use the authority parser as the syntax gate. The source-preserving scanner
  // below exists only because the current AST does not retain token offsets.
  parseSnlSyntaxTree(source);
  const tokens = tokenizeSnl(source);
  const refs: SnlReference[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'ident') continue;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (prev?.type === 'lbracket' || prev?.type === 'hash') continue; // style tag or Tree3 local source target
    if (prev?.type === 'at' && !isPostfixAt(tokens[i - 2])) continue; // Tree3 binder declaration
    if (next?.type === 'at') {
      if (options.postfixedMacroNames?.has(token.value)) {
        refs.push({ entityType: 'macro', id: token.value, start: token.start, end: token.end });
      }
      continue;
    }
    if (prev?.type === 'at' && isPostfixAt(tokens[i - 2])) {
      refs.push({ entityType: 'entry', id: token.value, start: token.start, end: token.end });
      continue;
    }
    if (/^\d+(?:\.\d+)*$/.test(token.value)) continue; // numeral literal
    refs.push({ entityType: 'macro', id: token.value, start: token.start, end: token.end });
  }
  return refs;
}

function replaceSnlReferences(
  source: string,
  entityType: EntityType,
  oldId: string,
  newId: string,
): string {
  const matches = scanSnlReferences(source, {
    postfixedMacroNames: entityType === 'macro' ? new Set([oldId]) : undefined,
  }).filter((r) => r.entityType === entityType && r.id === oldId);
  let next = source;
  for (const match of matches.reverse()) {
    next = next.slice(0, match.start) + newId + next.slice(match.end);
  }
  return next;
}

function isPostfixAt(previous: SnlToken | undefined): boolean {
  return previous !== undefined && ['ident', 'delimited', 'rparen', 'rbracket'].includes(previous.type);
}

function tokenizeSnl(source: string): SnlToken[] {
  const tokens: SnlToken[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '$' || ch === '%' || ch === '`') {
      const delimiter = ch === '$' && source[i + 1] === '$' ? '$$' : ch;
      const close = source.indexOf(delimiter, i + delimiter.length);
      if (close < 0) throw new Error(`Malformed SNL: unclosed ${delimiter} delimiter at offset ${i}.`);
      tokens.push({ type: 'delimited', value: source.slice(i, close + delimiter.length), start: i, end: close + delimiter.length });
      i = close + delimiter.length;
      continue;
    }
    if (/[A-Za-z0-9_\\]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[A-Za-z0-9_.\-]/.test(source[i])) i++;
      tokens.push({ type: 'ident', value: source.slice(start, i), start, end: i });
      continue;
    }
    const punctuation: Record<string, SnlToken['type']> = {
      '@': 'at', '#': 'hash', '(': 'lparen', ')': 'rparen', '[': 'lbracket', ']': 'rbracket', ',': 'comma', '=': 'eq',
    };
    const type = punctuation[ch];
    if (!type) throw new Error(`Malformed SNL: unexpected character ${JSON.stringify(ch)} at offset ${i}.`);
    tokens.push({ type, value: ch, start: i, end: i + 1 });
    i++;
  }
  return tokens;
}

async function validateWorkspaceBoundary(workspaceRoot: string): Promise<string> {
  const requestedRoot = path.resolve(workspaceRoot);
  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(requestedRoot);
  } catch {
    throw new Error(`Workspace root does not exist: ${requestedRoot}`);
  }
  const rootStat = await fs.lstat(canonicalRoot);
  if (!rootStat.isDirectory()) throw new Error(`Workspace root is not a directory: ${canonicalRoot}`);

  const requestedDoc = path.join(requestedRoot, '.SNL_Doc');
  let docStat;
  try {
    docStat = await fs.lstat(requestedDoc);
  } catch {
    throw new Error(
      `No .SNL_Doc/ folder at ${requestedRoot}. Point --root at the workspace that contains .SNL_Doc/.`,
    );
  }
  if (!docStat.isDirectory() || docStat.isSymbolicLink()) {
    throw new Error(`${requestedDoc} must be a real directory, not a symlink.`);
  }
  const canonicalDoc = await fs.realpath(requestedDoc);
  const expectedDoc = path.join(canonicalRoot, '.SNL_Doc');
  if (canonicalDoc !== expectedDoc) {
    throw new Error(`${requestedDoc} escapes the canonical workspace boundary.`);
  }
  return canonicalRoot;
}

async function assertCanonicalDirectory(dir: string, docRoot: string): Promise<void> {
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${dir} must be a real directory, not a symlink.`);
  }
  const real = await fs.realpath(dir);
  const relative = path.relative(docRoot, real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${dir} escapes the canonical .SNL_Doc boundary.`);
  }
}

async function workspaceUsesEntityStorage(root: string): Promise<boolean> {
  const configPath = path.join(root, 'config.json');
  let handle;
  try {
    handle = await fs.open(configPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${configPath} must be a regular, non-symlink file.`);
    const config = JSON.parse(await handle.readFile('utf8')) as unknown;
    return usesEntityStorage(config);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
      throw new Error(`${configPath} must be a regular, non-symlink file.`);
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function appendJsonDirectoryCandidates(
  root: string,
  relativeDirectory: string,
  candidates: string[],
): Promise<void> {
  const directory = path.join(root, relativeDirectory);
  try {
    await assertCanonicalDirectory(directory, root);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.name.endsWith('.json') && entry.isSymbolicLink()) {
        throw new Error(`${absolute} must not be a symlink.`);
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        candidates.push(path.join(relativeDirectory, entry.name));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function loadWorkspaceJson(workspaceRoot: string): Promise<LoadedJson[]> {
  const root = snlDocRoot(workspaceRoot);
  await assertCanonicalDirectory(root, root);
  const entityStorage = await workspaceUsesEntityStorage(root);
  const candidates = ['config.json', 'relationships.json'];

  if (entityStorage) {
    // Reference discovery/writes share the same strict topology gate as the
    // public readers; never operate on a partial current workspace.
    await Promise.all([
      readEntries(workspaceRoot),
      readActiveMacros(workspaceRoot),
    ]);
    await appendJsonDirectoryCandidates(root, 'packages', candidates);
    await appendJsonDirectoryCandidates(root, 'entries', candidates);
    await appendJsonDirectoryCandidates(root, 'macros', candidates);
  } else {
    candidates.push('entries.json');
    await appendJsonDirectoryCandidates(root, 'term_macros', candidates);
  }

  const libraryRoot = path.join(root, 'libraries');
  try {
    await assertCanonicalDirectory(libraryRoot, root);
    const libraries = await fs.readdir(libraryRoot, { withFileTypes: true });
    for (const entry of libraries) {
      if (!entry.name.startsWith('.') && entry.isSymbolicLink()) {
        throw new Error(`${path.join(libraryRoot, entry.name)} must not be a symlink.`);
      }
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await assertCanonicalDirectory(path.join(libraryRoot, entry.name), root);
        candidates.push(path.join('libraries', entry.name, 'graph.json'));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const unique = [...new Set(candidates)].sort();
  const loaded: LoadedJson[] = [];
  for (const relPath of unique) {
    const absPath = path.join(root, relPath);
    await assertCanonicalDirectory(path.dirname(absPath), root);
    let raw: string;
    let stat;
    let handle;
    try {
      handle = await fs.open(absPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      stat = await handle.stat();
      if (!stat.isFile()) {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      raw = await handle.readFile('utf8');
    } catch (error) {
      if (handle) await handle.close();
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      throw error;
    }
    await handle.close();
    const errors: ParseError[] = [];
    const tree = parseTree(raw, errors, { disallowComments: true, allowTrailingComma: false });
    if (!tree || errors.length > 0) {
      const detail = errors.map((e) => `${printParseErrorCode(e.error)}@${e.offset}`).join(', ');
      throw new Error(`Failed to parse ${absPath}: ${detail || 'empty JSON document'}`);
    }
    validateNoDuplicateKeys(tree, absPath);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse ${absPath}: ${(error as Error).message}`);
    }
    const rel = relPath.split(path.sep).join('/');
    validateSchemaShape(absPath, rel, data);
    loaded.push({
      absPath,
      relPath: rel,
      raw,
      data,
      tree,
      mode: stat.mode,
      device: stat.dev,
      inode: stat.ino,
      docRoot: root,
    });
  }
  return loaded;
}

function validateNoDuplicateKeys(node: JsonNode, absPath: string): void {
  if (node.type === 'object') {
    const seen = new Set<string>();
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
      if (typeof key !== 'string') continue;
      if (seen.has(key)) {
        throw new Error(`${absPath}: duplicate JSON property ${JSON.stringify(key)} is not safe to migrate.`);
      }
      seen.add(key);
    }
  }
  for (const child of node.children ?? []) validateNoDuplicateKeys(child, absPath);
}

function validateSchemaShape(absPath: string, relPath: string, data: unknown): void {
  const value = data as any;
  const fail = (message: string): never => {
    throw new Error(`${absPath}: ${message}`);
  };
  if (relPath === 'config.json') {
    if (!isRecord(value)) fail('config.json must be an object.');
    if (
      value.active_macro_packages !== undefined &&
      (!Array.isArray(value.active_macro_packages) ||
        !value.active_macro_packages.every((item: unknown) => typeof item === 'string'))
    ) {
      fail('config.active_macro_packages must be a string array when present.');
    }
    return;
  }
  if (/^packages\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord(value) || value.format !== 'snl-package' || value.version !== 1 ||
        typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.description !== 'string') {
      fail('Package manifest must use the snl-package v1 envelope.');
    }
    if (relPath !== packageManifestPath(value.id)) fail('Package manifest path does not match its logical identity.');
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord(value) || value.format !== 'snl-entry' || value.version !== 1 ||
        typeof value.package !== 'string' || !isRecord(value.entry) ||
        typeof value.entry.id !== 'string' || !isRecord(value.entry.content) ||
        value.entry.package !== value.package) {
      fail('Entry entity must use the snl-entry v1 envelope with matching Package identity.');
    }
    if (relPath !== entryEntityPath(value.package, value.entry.id)) fail('Entry entity path does not match its logical identity.');
    if (value.entry.content.snl !== undefined && typeof value.entry.content.snl !== 'string') {
      fail('Entry content.snl must be a string when present.');
    }
    return;
  }
  if (/^macros\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord(value) || value.format !== 'snl-macro' || value.version !== 1 ||
        typeof value.package !== 'string' || !isRecord(value.macro) ||
        typeof value.macro.name !== 'string' || !isRecord(value.macro.source) ||
        !Array.isArray(value.macro.source.entries) ||
        !value.macro.source.entries.every((item: unknown) => typeof item === 'string')) {
      fail('Macro entity must use the snl-macro v1 envelope with source.entries[].');
    }
    if (relPath !== macroEntityPath(value.package, value.macro.name)) fail('Macro entity path does not match its logical identity.');
    return;
  }
  if (relPath === 'entries.json') {
    if (!Array.isArray(value)) fail('entries.json must be an array.');
    value.forEach((entry: any, index: number) => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !isRecord(entry.content)) {
        fail(`entry ${index} must contain string id and object content.`);
      }
      if (entry.content.snl !== undefined && typeof entry.content.snl !== 'string') {
        fail(`entry ${index} content.snl must be a string when present.`);
      }
    });
    return;
  }
  if (relPath.startsWith('term_macros/')) {
    if (!isRecord(value) || !isRecord(value.macros)) fail('macro package must contain an object macros map.');
    for (const [name, macro] of Object.entries(value.macros) as Array<[string, any]>) {
      if (!isRecord(macro) || !isRecord(macro.source) || !Array.isArray(macro.source.entries)) {
        fail(`macro ${JSON.stringify(name)} must contain source.entries[].`);
      }
      if (!macro.source.entries.every((item: unknown) => typeof item === 'string')) {
        fail(`macro ${JSON.stringify(name)} source.entries must contain only strings.`);
      }
    }
    return;
  }
  if (/^libraries\/[^/]+\/graph\.json$/.test(relPath)) {
    if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.relationships)) {
      fail('Library graph must contain nodes[] and relationships[].');
    }
    value.nodes.forEach((node: any, index: number) => {
      if (!isRecord(node) || !isRecord(node.props)) fail(`graph node ${index} must contain object props.`);
      if (node.props.entryId !== undefined && typeof node.props.entryId !== 'string') {
        fail(`graph node ${index} props.entryId must be a string when present.`);
      }
    });
    return;
  }
  if (relPath === 'relationships.json') {
    if (!isRecord(value) || !Array.isArray(value.relationships)) {
      fail('relationships.json must contain relationships[].');
    }
    value.relationships.forEach((rel: any, index: number) => {
      if (!isRecord(rel) || typeof rel.from !== 'string' || typeof rel.to !== 'string') {
        fail(`relationship ${index} must contain string from/to.`);
      }
      if (isRecord(rel.metadata) && rel.metadata.generator === 'macro-source-scan') {
        for (const field of ['macros', 'postfixes']) {
          const values = rel.metadata[field];
          if (values !== undefined && (!Array.isArray(values) || !values.every((v) => typeof v === 'string'))) {
            fail(`relationship ${index} metadata.${field} must be a string array when present.`);
          }
        }
      }
    });
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function pathExistsNoFollow(file: string): Promise<boolean> {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function assertFileContent(filePath: string, expected: string, label: string): Promise<void> {
  let handle;
  try {
    handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (await handle.readFile('utf8')) !== expected) {
      throw new Error(`${label} changed concurrently; refusing destructive rollback: ${filePath}.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
      throw new Error(`${label} became a symlink; refusing destructive rollback: ${filePath}.`);
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function restoreReplacement(
  file: LoadedJson & { targetAbsPath: string; next: string },
): Promise<void> {
  await assertFileContent(file.targetAbsPath, file.next, 'Installed rename output');
  if (file.targetAbsPath !== file.absPath) {
    if (await pathExistsNoFollow(file.absPath)) {
      throw new Error(`Rename source reappeared concurrently; refusing destructive rollback: ${file.absPath}.`);
    }
    await fs.rm(file.targetAbsPath);
  }
  await restoreOriginal(file);
}

async function restoreOriginal(file: LoadedJson): Promise<void> {
  await assertCanonicalDirectory(path.dirname(file.absPath), file.docRoot);
  const restoreTemp = `${file.absPath}.snl-restore-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`;
  try {
    await fs.writeFile(restoreTemp, file.raw, {
      encoding: 'utf8', mode: file.mode, flag: 'wx',
    });
    await fs.chmod(restoreTemp, file.mode);
    await fs.rename(restoreTemp, file.absPath);
  } finally {
    await fs.rm(restoreTemp, { force: true });
  }
}

async function assertUnchangedRegularFile(
  file: Pick<LoadedJson, 'absPath' | 'raw' | 'device' | 'inode' | 'docRoot'>,
): Promise<void> {
  await assertCanonicalDirectory(path.dirname(file.absPath), file.docRoot);
  let handle;
  try {
    handle = await fs.open(file.absPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== file.device || stat.ino !== file.inode) {
      throw new Error(`${file.absPath} changed identity during rename planning.`);
    }
    if ((await handle.readFile('utf8')) !== file.raw) {
      throw new Error(`${file.absPath} changed during rename planning; refusing to overwrite it.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
      throw new Error(`${file.absPath} became a symlink during rename planning.`);
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

function validateNonEmptyIdentity(id: string): void {
  if (id.trim() === '') throw new Error('Identity must be a non-empty string.');
}

function isTraceableSnlIdentity(entityType: EntityType, id: string): boolean {
  const pattern = entityType === 'macro'
    ? /^[A-Za-z_\\][A-Za-z0-9_.\-]*$/
    : /^[A-Za-z0-9_\\][A-Za-z0-9_.\-]*$/;
  return pattern.test(id);
}

function occurrence(
  file: LoadedJson,
  entityType: EntityType,
  id: string,
  role: OccurrenceRole,
  jsonPath: string,
): EntityOccurrence {
  let category: EntityOccurrence['category'];
  if (role === 'definition') category = 'definition';
  else if (file.relPath.startsWith('packages/') && jsonPath.startsWith('entry_ids[')) category = 'package-membership';
  else if (jsonPath.includes('.content.snl')) category = 'snl';
  else if (/^libraries\//.test(file.relPath)) category = 'library-index';
  else if (jsonPath.includes('.source.entries[')) category = 'macro-source';
  else if (jsonPath.includes('.metadata.macros[') || jsonPath.includes('.metadata.postfixes[')) category = 'generated-witness';
  else category = 'relationship';
  return { entityType, id, role, category, file: file.relPath, path: jsonPath };
}

function offsetPosition(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset).split('\n');
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

function compareOccurrence(a: EntityOccurrence, b: EntityOccurrence): number {
  return a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || (a.offset ?? -1) - (b.offset ?? -1);
}
