import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify, types as utilTypes } from 'node:util';
import { parseTree, type Node as JsonNode, type ParseError } from 'jsonc-parser';
import { extractExportedBinders } from '@sjtu-ai4math/snl-basics/core';
import { validateManagedWorkspace, type ManagedEntityType } from './entity-crud.ts';
import { normalizeEntryDraft, normalizeMacroDraft } from './entity-writes.ts';
import { assertPackageId, compareCanonicalIds, entryEntityPath, macroEntityPath, packageManifestPath,
  CURRENT_ENTRY_SCHEMA_VERSION, CURRENT_MACRO_SCHEMA_VERSION, CURRENT_PACKAGE_SCHEMA_VERSION,
  ENTRY_STORAGE_VERSION, MACRO_STORAGE_VERSION, PACKAGE_STORAGE_VERSION } from './entity-storage.ts';
import { installNewJson, jsonText } from './guarded-json-file.ts';
import { readConfig, readEntries, readActiveMacros, readAllMacroPackages } from './snl-doc.ts';
import { lintEntry } from './lint-entry.ts';
import { lintPackage } from './lint-package.ts';
import type { LintIssue } from './lint-report.ts';
import { BATCH_JOURNAL_FILENAME, DATA_WRITE_LOCK_FILENAME, withWorkspaceDataLock } from './workspace-data-lock.ts';

type RecordJson = Record<string, unknown>;
export const BATCH_CREATE_TYPES = ['entry-kind', 'macro-kind', 'entry-package', 'macro-package', 'entry', 'macro', 'relationship'] as const;
export interface BatchOperation { command: string; arguments: { value: RecordJson } }
export class BatchError extends Error {
  constructor(public code: string, message: string, public exitCode: 1 | 2 = 1, public details?: unknown) { super(message); }
}
const record = (v: unknown): v is RecordJson => !!v && typeof v === 'object' && !Array.isArray(v);
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = (code: string, message: string): never => { throw new BatchError(code, message); };
function exact(value: RecordJson, fields: string[], label: string) {
  const extra = Object.keys(value).filter(k => !fields.includes(k));
  if (extra.length) throw new TypeError(`${label}: unknown keys ${extra.join(', ')}.`);
}
function text(v: RecordJson, key: string): string {
  const s = v[key];
  if (typeof s !== 'string' || !s || s !== s.trim() || s.includes('\0')) fail('batch.invalid', `${key} must be a non-empty canonical string without NUL.`);
  return s as string;
}
function packageId(value: string): void {
  try { assertPackageId(value); }
  catch (error) { fail('batch.invalid', error instanceof Error ? error.message : String(error)); }
}
/** JSON-only, key-order independent commitment, preserving own prototype-colliding keys. */
function canonical(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object' && value !== null && utilTypes.isProxy(value)) throw new TypeError('Batch JSON must not contain Proxies.');
  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1) throw new TypeError('Batch arrays must be dense JSON arrays without extra keys.');
    return Array.from({ length: value.length }, (_, index) => {
      const d = Object.getOwnPropertyDescriptor(value, String(index));
      if (!d || !('value' in d) || !d.enumerable) throw new TypeError('Batch arrays must contain inert own values.');
      return canonical(d.value);
    });
  }
  if (record(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    if (Reflect.ownKeys(value).length !== Object.keys(value).length) throw new TypeError('Batch JSON must not contain symbol or non-enumerable keys.');
    return Object.fromEntries(Object.keys(value).sort(compareCanonicalIds).map(k => {
      const d = Object.getOwnPropertyDescriptor(value, k)!;
      if (!('value' in d)) throw new TypeError('Batch JSON must not contain accessors.');
      return [k, canonical(d.value)];
    }));
  }
  throw new TypeError('Batch accepts only finite JSON data.');
}
export function parseBatchJson(input: string): unknown {
  const errors: ParseError[] = [];
  const tree = parseTree(input, errors, { disallowComments: true, allowTrailingComma: false });
  if (!tree || errors.length) throw new SyntaxError('Batch input must be strict JSON.');
  function visit(node: JsonNode) {
    if (node.type === 'object') {
      const keys = new Set<string>();
      for (const property of node.children ?? []) {
        const key = property.children![0].value as string;
        if (keys.has(key)) throw new SyntaxError(`Duplicate JSON property ${JSON.stringify(key)} in batch input.`);
        keys.add(key);
      }
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(tree);
  return JSON.parse(input);
}
function normalize(raw: unknown): BatchOperation[] {
  if (!Array.isArray(raw)) throw new TypeError('operations must be an array.');
  return (canonical(raw) as unknown[]).map((item, index) => {
    if (!record(item)) throw new TypeError(`operations[${index}] must be an object.`);
    exact(item, ['command', 'arguments'], `operations[${index}]`);
    if (!BATCH_CREATE_TYPES.some(type => item.command === `${type}/create`)) throw new TypeError(`Unsupported batch command ${JSON.stringify(item.command)}; only advertised create commands are accepted.`);
    if (!record(item.arguments)) throw new TypeError(`operations[${index}].arguments must be an object.`);
    exact(item.arguments, ['value'], `operations[${index}].arguments`);
    if (!record(item.arguments.value)) fail('batch.invalid', `operations[${index}].arguments.value must be an object.`);
    let value = canonical(item.arguments.value) as RecordJson;
    if (item.command === 'entry/create') value = normalizeEntryDraft(value) as RecordJson;
    if (item.command === 'macro/create') {
      const packageId = value.package;
      const body = Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'package'));
      value = { ...normalizeMacroDraft(body, true) as RecordJson, package: packageId };
    }
    if (item.command === 'entry-package/create' || item.command === 'macro-package/create') {
      const id = typeof value.id === 'string' ? value.id.trim() : value.id;
      value = { ...value, id, name: value.name === undefined ? id : typeof value.name === 'string' ? value.name.trim() : value.name,
        description: value.description === undefined ? '' : typeof value.description === 'string' ? value.description.trim() : value.description };
      for (const [key, expected] of Object.entries({ format: 'snl-package', version: PACKAGE_STORAGE_VERSION, schema_version: CURRENT_PACKAGE_SCHEMA_VERSION })) {
        if (Object.hasOwn(value, key) && value[key] !== expected) fail('batch.invalid', `Package ${key} must be ${JSON.stringify(expected)}.`);
      }
      if (Object.hasOwn(value, 'macros') || (Object.hasOwn(value, 'entry_ids') && (!Array.isArray(value.entry_ids) || value.entry_ids.length))) {
        fail('batch.invalid', 'Create Package membership through separate Entry/Macro operations, not embedded macros or nonempty entry_ids.');
      }
    }
    return canonical({ command: item.command, arguments: { value } }) as BatchOperation;
  });
}

type Node = { kind: 'directory'; mode: number } | { kind: 'file'; mode: number; bytes: Buffer };
type Snapshot = Map<string, Node>;
async function exists(p: string) { try { await fs.lstat(p); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } }
async function assertRoot(root: string) {
  for (const p of [root, path.join(root, '.SNL_Doc')]) {
    const s = await fs.lstat(p);
    if (!s.isDirectory() || s.isSymbolicLink() || await fs.realpath(p) !== p) throw new BatchError('workspace.unsafe-path', `${p} must be a canonical non-symlink directory.`, 2);
  }
  if (await exists(path.join(root, BATCH_JOURNAL_FILENAME))) throw new BatchError('batch.recovery-required', `Inspect ${BATCH_JOURNAL_FILENAME} and recover the retained transaction before writing.`, 2);
}
function supportedMode(mode: number, p: string): number {
  // Whole-tree copying has no ownership policy for setuid/setgid/sticky bits.
  // Reject rather than silently strip them (including for empty batches).
  if (mode & 0o7000) throw new BatchError('workspace.unsupported-mode', `Batch refuses setuid, setgid and sticky permission bits: ${p}.`, 2);
  return mode & 0o777;
}
async function snapshot(root: string): Promise<Snapshot> {
  const out: Snapshot = new Map();
  const doc = path.join(root, '.SNL_Doc');
  async function walk(relative: string) {
    if (relative === DATA_WRITE_LOCK_FILENAME) return;
    const p = path.join(doc, relative);
    const s = await fs.lstat(p);
    if (s.isSymbolicLink() || (!s.isDirectory() && !s.isFile())) throw new BatchError('workspace.unsafe-path', `Batch refuses symlinks and special files: ${p}.`, 2);
    const mode = supportedMode(s.mode, p);
    if (s.isDirectory()) {
      out.set(relative, { kind: 'directory', mode });
      for (const name of (await fs.readdir(p)).sort(compareCanonicalIds)) await walk(relative ? `${relative}/${name}` : name);
    } else {
      const handle = await fs.open(p, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const opened = await handle.stat();
        const openedMode = supportedMode(opened.mode, p);
        if (!opened.isFile() || opened.ino !== s.ino || opened.dev !== s.dev || opened.mode !== s.mode) throw new BatchError('batch.workspace-conflict', `${p} changed during capture.`);
        const bytes = await handle.readFile();
        const after = await handle.stat();
        if (after.mode !== opened.mode || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw new BatchError('batch.workspace-conflict', `${p} changed during capture.`);
        out.set(relative, { kind: 'file', mode: openedMode, bytes });
      } finally { await handle.close(); }
    }
  }
  await walk('');
  return out;
}
function revision(root: string, data: Snapshot) {
  const hash = createHash('sha256').update(`snl.batch.workspace/v1\0${root}\0`);
  for (const [name, node] of [...data].sort(([a], [b]) => compareCanonicalIds(a, b))) {
    hash.update(JSON.stringify([name, node.kind, node.mode, node.kind === 'file' ? node.bytes.length : 0]) + '\0');
    if (node.kind === 'file') hash.update(node.bytes);
  }
  return hash.digest('hex');
}
async function materialize(stage: string, data: Snapshot) {
  for (const [name, node] of data) {
    const p = path.join(stage, '.SNL_Doc', name);
    if (node.kind === 'directory') await fs.mkdir(p, { mode: 0o700 });
    else {
      await fs.writeFile(p, node.bytes, { flag: 'wx', mode: node.mode });
      await fs.chmod(p, node.mode); // Preserve authored modes independently of the process umask.
    }
  }
}
async function validate(root: string) {
  const result = await validateManagedWorkspace(root);
  if (!result.valid) {
    const unsupported = result.issues.some(i => /unsupported|newer than this Toolkit|no registered migration|must carry current Package manifest/.test(i.message));
    throw new BatchError(unsupported ? 'workspace.unsupported-schema' : 'batch.workspace-invalid', 'Whole-workspace validation failed.', unsupported ? 2 : 1, result);
  }
  return result;
}
function readJson(data: Snapshot, name: string): RecordJson {
  const node = data.get(name);
  if (!node || node.kind !== 'file') fail('batch.workspace-invalid', `Missing regular file ${name}.`);
  const value: unknown = JSON.parse((node as Extract<Node, { kind: 'file' }>).bytes.toString('utf8'));
  if (!record(value)) fail('batch.workspace-invalid', `${name} must be an object.`);
  return value as RecordJson;
}
interface ResultIdentity { type: ManagedEntityType; id: string; file: string }
async function prepare(stage: string, original: Snapshot, operations: BatchOperation[]) {
  const config = readJson(original, 'config.json');
  if (config.version !== '0.1.0') throw new BatchError('workspace.unsupported-schema', 'Batch v1 requires workspace data 0.1.0; migrate explicitly first.', 2);
  await validate(stage); // Never use the batch as an implicit repair/migration.
  const packages = new Map<string, RecordJson>();
  const entries = new Set<string>();
  const macros = new Set<string>();
  for (const [name, node] of original) {
    if (node.kind !== 'file' || !name.endsWith('.json')) continue;
    if (name.startsWith('packages/')) { const v = readJson(original, name); packages.set(text(v, 'id'), v); }
    if (name.startsWith('entries/')) entries.add(text(readJson(original, name).entry as RecordJson, 'id'));
    if (name.startsWith('macros/')) { const v = readJson(original, name); macros.add(`${v.package}\0${text(v.macro as RecordJson, 'name')}`); }
  }
  const packageIds = new Set([...packages.keys()].map(id => id.toLowerCase()));
  const active = new Set(Array.isArray(config.active_macro_packages) ? config.active_macro_packages as string[] : [...packages.keys()].filter(id => id !== '_unpackaged'));
  const kinds = new Map(['entry-kind', 'macro-kind'].map(type => [type, new Set((config[type === 'entry-kind' ? 'entry_kinds' : 'macro_kinds'] as RecordJson[]).map(v => text(v, 'id')))]));
  const relationships = original.has('relationships.json') ? readJson(original, 'relationships.json') : { relationships: [] };
  const relationRows = relationships.relationships as RecordJson[];
  const relationIds = new Set(relationRows.map(v => text(v, 'id')));
  const pending = new Map<string, unknown>();
  const changedPackages = new Set<string>();
  const identities: ResultIdentity[] = [];
  const addedEntries = new Map<string, string[]>();
  let configChanged = false;
  let activationChanged = false;
  let relationsChanged = false;
  for (let index = 0; index < operations.length; index++) {
    const op = operations[index];
    const type = op.command.split('/')[0] as ManagedEntityType;
    const value = op.arguments.value;
    const id = text(value, type === 'macro' ? 'name' : 'id');
    let file = '';
    const duplicate = () => fail('batch.already-exists', `operations[${index}]: ${type} ${JSON.stringify(id)} already exists or was created twice.`);
    if (type === 'entry-kind' || type === 'macro-kind') {
      if (kinds.get(type)!.has(id)) duplicate();
      kinds.get(type)!.add(id);
      (config[type === 'entry-kind' ? 'entry_kinds' : 'macro_kinds'] as unknown[]).push(value);
      configChanged = true; file = 'config.json';
    } else if (type === 'entry-package' || type === 'macro-package') {
      packageId(id);
      if (id === '_unpackaged' || packageIds.has(id.toLowerCase())) duplicate();
      if (typeof value.name !== 'string' || !value.name || typeof value.description !== 'string') fail('batch.invalid', 'Package requires nonempty name and string description.');
      packageIds.add(id.toLowerCase());
      packages.set(id, { ...value, format: 'snl-package', version: PACKAGE_STORAGE_VERSION, schema_version: CURRENT_PACKAGE_SCHEMA_VERSION, entry_ids: [] });
      changedPackages.add(id); active.add(id); configChanged = true; activationChanged = true; file = packageManifestPath(id);
    } else if (type === 'entry') {
      if (entries.has(id)) duplicate();
      entries.add(id);
      const pkg = text(value, 'package');
      packageId(pkg);
      file = entryEntityPath(pkg, id);
      pending.set(file, { format: 'snl-entry', version: ENTRY_STORAGE_VERSION, schema_version: CURRENT_ENTRY_SCHEMA_VERSION, package: pkg, entry: value });
      const added = addedEntries.get(pkg) ?? []; added.push(id); addedEntries.set(pkg, added);
    } else if (type === 'macro') {
      const pkg = text(value, 'package');
      packageId(pkg);
      if (macros.has(`${pkg}\0${id}`)) duplicate();
      if (/[@#$%\s()[\]{}]/u.test(id)) fail('macro.bad-name', 'Macro name contains forbidden syntax.');
      macros.add(`${pkg}\0${id}`); file = macroEntityPath(pkg, id);
      const macro = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'package'));
      pending.set(file, { format: 'snl-macro', version: MACRO_STORAGE_VERSION, schema_version: CURRENT_MACRO_SCHEMA_VERSION, package: pkg, macro });
    } else if (type === 'relationship') {
      if (relationIds.has(id)) duplicate();
      relationIds.add(id); relationRows.push(value); relationsChanged = true; file = 'relationships.json';
    }
    identities.push({ type, id: type === 'macro' ? `${value.package}::${id}` : id, file });
  }
  for (const [pkg, ids] of addedEntries) {
    const manifest = packages.get(pkg);
    if (!manifest) fail('batch.missing-package', `Entry Package ${JSON.stringify(pkg)} does not exist in the resulting batch.`);
    manifest!.entry_ids = [...manifest!.entry_ids as string[], ...ids].sort(compareCanonicalIds);
    changedPackages.add(pkg);
  }
  for (const pkg of changedPackages) pending.set(packageManifestPath(pkg), packages.get(pkg)!);
  if (configChanged) {
    if (activationChanged) config.active_macro_packages = [...active].sort(compareCanonicalIds);
    pending.set('config.json', config);
  }
  if (relationsChanged) pending.set('relationships.json', relationships);
  // No live writes. Each aggregate is written once, even for thousands of dependents.
  for (const [name, value] of pending) {
    const target = path.join(stage, '.SNL_Doc', name);
    if (original.has(name)) await fs.writeFile(target, jsonText(value));
    else await installNewJson(target, value);
  }
  const validation = await validate(stage); // Current schemas, identities, topology, graph closure.
  const [finalEntries, finalConfig, activeMacros, macroPackages] = await Promise.all([readEntries(stage), readConfig(stage), readActiveMacros(stage), readAllMacroPackages(stage)]);
  const binders = new Map<string, ReadonlySet<string>>();
  for (const entry of finalEntries) {
    try { binders.set(entry.id, extractExportedBinders(entry.content?.snl ?? '')); }
    catch { binders.set(entry.id, new Set()); }
  }
  const diagnostics: LintIssue[] = [...validation.issues];
  for (let i = 0; i < operations.length; i++) {
    const { command, arguments: { value } } = operations[i];
    let issues: LintIssue[] = [];
    if (command === 'entry/create') {
      // Duplicate identities were checked by a Set and the canonical whole-pool reader.
      issues = lintEntry(value, { entryKinds: finalConfig.entry_kinds ?? [], macros: activeMacros, siblingEntries: [], exportedBinders: binders }).issues;
    } else if (command === 'macro/create') {
      const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'name' && key !== 'package'));
      issues = lintPackage({ version: '11', name: value.package, description: '', macros: { [String(value.name)]: body } }, { checkKatex: true }).issues;
      const source = value.source as { entries?: string[] };
      for (const id of source.entries ?? []) if (!entries.has(id)) issues.push({ severity: 'error', code: 'macro.source-dangling', message: `Macro source.entries refers to missing Entry ${JSON.stringify(id)}.` });
      if (!kinds.get('macro-kind')!.has(String(value.kind))) issues.push({ severity: 'error', code: 'macro.unknown-kind', message: `Unknown Macro Kind ${JSON.stringify(value.kind)}.` });
    }
    diagnostics.push(...issues.map(issue => ({ ...issue, path: `operations[${i}]${issue.path ? `.${issue.path}` : ''}` })));
  }
  if (diagnostics.some(i => i.severity === 'error')) throw new BatchError('batch.validation-failed', 'Batch schema, syntax/semantic, or workspace-reference validation failed.', 1, { diagnostics });
  // Canonical results are extracted once from the already strictly validated staged envelopes.
  const results = identities.map(({ type, id, file }, index) => {
    let value = operations[index].arguments.value;
    let source: unknown = value;
    if (type === 'entry' || type === 'macro') source = pending.get(file);
    if (type === 'entry-package' || type === 'macro-package') {
      value = packages.get(id)!;
      if (type === 'macro-package') {
        value = { ...value, macros: macroPackages[id].macros };
      }
      source = value;
    }
    return { operation: 'create', entity: { type, id, revision: sha(source), value } };
  });
  return { diagnostics, results, counts: validation.counts };
}

async function syncDir(p: string) { const h = await fs.open(p, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW); try { await h.sync(); } finally { await h.close(); } }
async function seal(stage: string, original: Snapshot) {
  const tree = await snapshot(stage);
  for (const [name, node] of tree) {
    const p = path.join(stage, '.SNL_Doc', name);
    if (node.kind === 'file') { const h = await fs.open(p, constants.O_RDONLY | constants.O_NOFOLLOW); try { await h.sync(); } finally { await h.close(); } }
  }
  for (const [name, node] of [...tree].reverse()) if (node.kind === 'directory') {
    const p = path.join(stage, '.SNL_Doc', name);
    await fs.chmod(p, original.get(name)?.mode ?? node.mode);
    await syncDir(p);
  }
  await syncDir(stage);
}
const run = promisify(execFile);
// No shell, third-party dependency or non-atomic fallback. Two directories must share a filesystem.
const EXCHANGE = 'import ctypes,os,sys\nl=ctypes.CDLL(None,use_errno=True)\nf=l.renameat2\nf.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]\nf.restype=ctypes.c_int\nr=f(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2)\nif r: raise OSError(ctypes.get_errno(),os.strerror(ctypes.get_errno()))\n';
async function exchange(a: string, b: string) {
  if (process.platform !== 'linux') throw new BatchError('batch.publication-unsupported', 'Atomic batch apply requires Linux renameat2(RENAME_EXCHANGE) and python3.', 2);
  await run('python3', ['-I', '-c', EXCHANGE, a, b]);
}
export interface BatchApplyHooks {
  /** Local regression seam, never accepted in an operation request. */
  beforeExchange?: () => Promise<void>;
  afterExchange?: () => Promise<void>;
  beforeParentSync?: () => Promise<void>;
}
/** Whole canonical authority revision, shared by batch and relationship publication. */
export async function captureWorkspaceRevision(root: string, allowWriterLock = false): Promise<string> {
  await assertRoot(root);
  if (!allowWriterLock && await exists(path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME))) throw new BatchError('workspace.locked', 'Workspace has an active or stale writer lock.', 2);
  return revision(root, await snapshot(root));
}
export async function checkBatch(root: string, raw: unknown) {
  const operations = normalize(raw);
  await assertRoot(root);
  if (await exists(path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME))) throw new BatchError('workspace.locked', 'Workspace has an active or stale writer lock; check again after it is resolved.', 2);
  const original = await snapshot(root);
  const expectedWorkspaceRevision = revision(root, original);
  const temporaryRoot = await fs.realpath(os.tmpdir());
  const relativeTemporaryRoot = path.relative(root, temporaryRoot);
  if (relativeTemporaryRoot === '' || (!relativeTemporaryRoot.startsWith(`..${path.sep}`) && relativeTemporaryRoot !== '..' && !path.isAbsolute(relativeTemporaryRoot))) {
    throw new BatchError('batch.unsafe-temp-directory', 'The check temporary directory must be outside the workspace; set TMPDIR to an external directory.', 2);
  }
  const stage = await fs.mkdtemp(path.join(temporaryRoot, 'snl-batch-check-'));
  try {
    await materialize(stage, original);
    const prepared = await prepare(stage, original, operations);
    await assertRoot(root);
    if (await exists(path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME)) || revision(root, await snapshot(root)) !== expectedWorkspaceRevision) fail('batch.workspace-conflict', 'Workspace changed during preflight; check the complete batch again.');
    return { normalizedOperations: operations, checkedDigest: sha(['snl.batch/v1', operations]), expectedWorkspaceRevision, diagnostics: prepared.diagnostics, counts: prepared.counts };
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
}
export async function applyBatch(root: string, raw: unknown, checkedDigest: string, expectedWorkspaceRevision: string, hooks: BatchApplyHooks = {}) {
  const operations = normalize(raw);
  await assertRoot(root);
  let committedRevision: string | undefined;
  try {
    return await withWorkspaceDataLock(root, 'apply checked batch (inspect recovery journal before stale-lock removal)', async () => {
      if (sha(['snl.batch/v1', operations]) !== checkedDigest) fail('batch.digest-conflict', 'checkedDigest does not match the normalized operation sequence; recheck the whole batch.');
      const original = await snapshot(root);
      if (revision(root, original) !== expectedWorkspaceRevision) fail('batch.workspace-conflict', 'Workspace revision changed; recheck the whole batch, never replay a suffix.');
      const stage = await fs.mkdtemp(path.join(root, '.snl-batch-'));
      const liveDoc = path.join(root, '.SNL_Doc');
      const stagedDoc = path.join(stage, '.SNL_Doc');
      const journal = path.join(root, BATCH_JOURNAL_FILENAME);
      let retain = false;
      let journalCreated = false;
      let committed = false;
      let originalInode: Awaited<ReturnType<typeof fs.stat>> | undefined;
      try {
        await materialize(stage, original);
        const prepared = await prepare(stage, original, operations);
        // Probe platform/filesystem support before any live namespace mutation.
        const a = path.join(stage, 'probe-a'), b = path.join(stage, 'probe-b');
        await fs.mkdir(a); await fs.mkdir(b); await exchange(a, b); await fs.rmdir(a); await fs.rmdir(b);
        const lock = await fs.readFile(path.join(liveDoc, DATA_WRITE_LOCK_FILENAME));
        await fs.writeFile(path.join(stagedDoc, DATA_WRITE_LOCK_FILENAME), lock, { flag: 'wx', mode: 0o600 });
        const lh = await fs.open(path.join(stagedDoc, DATA_WRITE_LOCK_FILENAME), 'r'); try { await lh.sync(); } finally { await lh.close(); }
        await seal(stage, original);
        const resultingWorkspaceRevision = revision(root, await snapshot(stage));
        if (revision(root, await snapshot(root)) !== expectedWorkspaceRevision) fail('batch.workspace-conflict', 'Workspace changed while staging; publication refused.');
        originalInode = await fs.stat(liveDoc);
        await installNewJson(journal, { protocol: 'snl.batch.recovery/v1', root, stage, expectedWorkspaceRevision, resultingWorkspaceRevision, checkedDigest, originalDirectory: { dev: originalInode.dev, ino: originalInode.ino } });
        journalCreated = true;
        await hooks.beforeExchange?.();
        await exchange(liveDoc, stagedDoc);
        await hooks.afterExchange?.();
        await hooks.beforeParentSync?.();
        await syncDir(root); await syncDir(stage);
        await validate(root);
        if (revision(root, await snapshot(root)) !== resultingWorkspaceRevision) throw new BatchError('batch.readback-failed', 'Published workspace does not match the validated candidate.', 2);
        // This journal unlink is the commit point. Before it, detected failures roll back.
        await fs.unlink(journal); journalCreated = false; committed = true; committedRevision = resultingWorkspaceRevision;
        const diagnostics: LintIssue[] = [...prepared.diagnostics];
        // Canonical data and both exchange parents were synced before commit.
        // Journal garbage collection is not a second publication; a journal that
        // reappears after power loss requires revision-based manual reconciliation.
        try { await fs.rm(stage, { recursive: true, force: true }); }
        catch { retain = true; diagnostics.push({ severity: 'warning', code: 'batch.backup-cleanup-failed', message: `Commit completed; retained transaction backup at ${stage}.` }); }
        return { results: prepared.results, resultingWorkspaceRevision, workspaceRevision: resultingWorkspaceRevision, diagnostics, publication: 'linux-directory-exchange', recoveryPath: retain ? stage : null };
      } catch (error) {
        if (journalCreated && originalInode) {
          try {
            const now = await fs.stat(liveDoc);
            if (now.dev !== originalInode.dev || now.ino !== originalInode.ino) await exchange(liveDoc, stagedDoc);
            await syncDir(root); await syncDir(stage);
            if (revision(root, await snapshot(root)) !== expectedWorkspaceRevision) throw new Error('Rollback revision mismatch.');
            await fs.unlink(journal); journalCreated = false;
          } catch (rollback) {
            retain = true;
            throw new BatchError('batch.recovery-required', `Batch failed and rollback is uncertain. Preserve ${stage} and ${journal}; inspect both complete generations before removing any lock.`, 2, { primary: String(error), rollback: String(rollback) });
          }
        }
        throw error;
      } finally {
        if (!committed && !retain && !journalCreated) await fs.rm(stage, { recursive: true, force: true });
      }
    });
  } catch (error) {
    if (committedRevision) throw new BatchError('batch.committed-cleanup-failed', 'The complete batch committed, but lock/resource cleanup failed. Do not replay; inspect the resulting workspace and remaining lock.', 2, { resultingWorkspaceRevision: committedRevision, cause: String(error) });
    throw error;
  }
}
