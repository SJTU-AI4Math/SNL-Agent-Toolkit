/**
 * Discover the `.SNL_Doc/` folder for a given workspace root, and read its
 * canonical top-level files. Pure Node — no `vscode` dependency.
 *
 * All paths in / out are absolute (or resolved to absolute on read). This
 * mirrors the extension's src/snlDoc.ts helpers but goes through node:fs
 * so it works on any machine with a git checkout of the project.
 */

import { constants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { readRegularText } from './guarded-json-file.ts';
import { isMacroDocumentV11 as isSnlBasicsMacroDocumentV11 } from '@sjtu-ai4math/snl-basics';
import {
  type CounterNode,
  type EntryData,
  type EntryKind,
  type LibraryGraph,
  type LibraryMetaFile,
  type MacroKind,
  type MacroPackageEntry,
  type MacroPackageEntryWithoutName,
  type MacroPackageFile,
  type SnlConfig,
  isMacroDocumentV8,
} from './snl-doc-schema.ts';
import {
  ENTRY_STORAGE_VERSION,
  MACRO_STORAGE_VERSION,
  PACKAGE_STORAGE_VERSION,
  CURRENT_PACKAGE_SCHEMA_VERSION,

  assertCompatibleSchemaMarker,
  UNPACKAGED_PACKAGE_ID,
  entryEntityPath,
  macroEntityPath,
  makeEntityStorageReceipt,
  packageManifestPath,
  type MacroEnvelope,
  type PackageManifest,
} from './entity-storage.ts';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Absolute path to `<workspace>/.SNL_Doc`. */
export function snlDocRoot(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, '.SNL_Doc');
}

export function configPath(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'config.json');
}

export function entriesPath(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'entries.json');
}

export function entryEntitiesDir(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'entries');
}

export function macroEntitiesDir(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'macros');
}

export function packageManifestsDir(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'packages');
}

export function termMacrosDir(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'term_macros');
}

export function librariesDir(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'libraries');
}

export function libraryDir(workspaceRoot: string, slug: string): string {
  return path.join(librariesDir(workspaceRoot), slug);
}

export function libraryGraphPath(workspaceRoot: string, slug: string): string {
  return path.join(libraryDir(workspaceRoot, slug), 'graph.json');
}

export function libraryMetaPath(workspaceRoot: string, slug: string): string {
  return path.join(libraryDir(workspaceRoot, slug), 'meta.json');
}

export function libraryCountersPath(workspaceRoot: string, slug: string): string {
  return path.join(libraryDir(workspaceRoot, slug), 'counters.json');
}

// ---------------------------------------------------------------------------
// Existence & read helpers
// ---------------------------------------------------------------------------

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function readJson<T>(p: string): Promise<T> {
  let handle;
  try {
    handle = await fs.open(p, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${p} must be a regular, non-symlink file.`);
    return JSON.parse(await handle.readFile('utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
      throw new Error(`${p} must be a regular, non-symlink file.`);
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

async function readCanonicalLibraryJson<T>(p: string): Promise<T> {
  return JSON.parse((await readRegularText(p)).text) as T;
}

/**
 * Assert the given directory looks like an SNL-Doc workspace root — i.e. it
 * has a `.SNL_Doc/` folder. Throws with a friendly message otherwise. Used
 * as the first line of every CLI so failures explain themselves.
 */
export async function assertSnlDoc(workspaceRoot: string): Promise<void> {
  const dir = snlDocRoot(workspaceRoot);
  let stat;
  try {
    stat = await fs.lstat(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    throw new Error(
      `No .SNL_Doc/ folder at ${workspaceRoot}. Point --root at the workspace that contains .SNL_Doc/.`,
    );
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${dir} must be a regular, non-symlink directory.`);
  }
}

/**
 * Read `.SNL_Doc/config.json` if present, else return an empty config. A
 * corrupt config is a fatal error (throws) — we don't silently mask JSON
 * damage.
 */
export function usesCurrentEntitySchemas(config: unknown): boolean {
  return isRecord(config) &&
    (config.version === '0.0.11' || config.version === '0.1.0' || config.version === '0.2.0');
}

export function entityPayloadSchemaVersion(config: unknown): 1 | 2 {
  return isRecord(config) && config.version === '0.2.0' ? 2 : 1;
}

function requiresEntitySchemaMarker(config: unknown): boolean {
  return isRecord(config) && (config.version === '0.1.0' || config.version === '0.2.0');
}

export async function readConfig(workspaceRoot: string): Promise<SnlConfig> {
  await assertSnlDoc(workspaceRoot);
  const p = configPath(workspaceRoot);
  if (!(await pathExists(p))) {
    return { version: '0.0.0' };
  }
  const config = await readJson<SnlConfig>(p);
  if (usesCurrentEntitySchemas(config)) assertCurrentKindCatalogs(config);
  return config;
}

export function assertCurrentKindCatalogs(config: SnlConfig): void {
  for (const field of ['entry_kinds', 'macro_kinds'] as const) {
    const catalog = config[field];
    if (!Array.isArray(catalog)) throw new Error(`config.json#${field} must be an array.`);
    const ids = new Set<string>();
    catalog.forEach((value, index) => {
      const kind = value as unknown as Record<string, unknown>;
      if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
          value.id !== value.id.trim()) {
        throw new Error(`config.json#${field}[${index}].id must be a canonical non-empty string.`);
      }
      if (ids.has(value.id)) {
        throw new Error(`config.json#${field} contains duplicate id ${JSON.stringify(value.id)}.`);
      }
      ids.add(value.id);
      if (field === 'entry_kinds') {
        if (!isLocalizedLabel(kind.name, true)) {
          throw new Error(`config.json#entry_kinds[${index}].name must be a non-empty string or valid I18n map.`);
        }
        if (kind.description !== undefined && !isLocalizedLabel(kind.description, false)) {
          throw new Error(`config.json#entry_kinds[${index}].description must be a string or valid I18n map.`);
        }
        if (typeof kind.defaultCounterName !== 'string' || typeof kind.style !== 'string') {
          throw new Error(`config.json#entry_kinds[${index}] requires string defaultCounterName and style.`);
        }
      } else if (typeof kind.name !== 'string' || typeof kind.description !== 'string') {
        throw new Error(`config.json#macro_kinds[${index}] requires string name and description.`);
      }
      assertThemedColoring(kind.coloring, `config.json#${field}[${index}].coloring`);
    });
  }
}

function isLocalizedLabel(value: unknown, required: boolean): boolean {
  if (typeof value === 'string') return !required || !!value.trim();
  if (!isRecord(value) || value.type !== 'i18n' ||
      typeof value.default_language !== 'string' || !isRecord(value.values)) {
    return false;
  }
  const values = Object.values(value.values);
  return values.length > 0 && values.every((item) => typeof item === 'string') &&
    (!required || values.some((item) => (item as string).trim()));
}

function assertCurrentEntryPayload(value: Record<string, unknown>, label: string, schemaVersion: 1 | 2): void {
  if (typeof value.kind !== 'string' || !value.kind.trim() || value.kind !== value.kind.trim() ||
      !isLocalizedLabel(value.title, false) || !isRecord(value.content) ||
      !Object.hasOwn(value, 'contribution_info') || !Object.hasOwn(value, 'pointer')) {
    throw new Error(`${label} is not a valid schema-${schemaVersion} Entry payload.`);
  }
  if (schemaVersion === 2 && value.uuid !== '') {
    throw new Error(`${label} schema-2 requires an empty uuid root.`);
  }
  if (value.content.snl !== undefined && typeof value.content.snl !== 'string') {
    throw new Error(`${label}#content.snl must be a string when present.`);
  }
  for (const field of ['typst', 'latex', 'markdown', 'text'] as const) {
    if (value.content[field] !== undefined && !isLocalizedLabel(value.content[field], false)) {
      throw new Error(`${label}#content.${field} must be a string or valid I18n map when present.`);
    }
  }
}

function assertThemedColoring(value: unknown, label: string): void {
  if (!isRecord(value) || Object.hasOwn(value, 'stroke') || Object.hasOwn(value, 'background')) {
    throw new Error(`${label} must contain light and dark variants.`);
  }
  for (const theme of ['light', 'dark'] as const) {
    const variant = value[theme];
    if (!isRecord(variant) || typeof variant.stroke !== 'string' || !variant.stroke.trim() ||
        typeof variant.background !== 'string' || !variant.background.trim()) {
      throw new Error(`${label}.${theme} requires non-empty string stroke and background.`);
    }
  }
}

/** Select live storage without ever falling through to frozen backups. */
export function usesEntityStorage(config: unknown): boolean {
  if (!isRecord(config) || typeof config.version !== 'string') {
    throw new Error('config.json must be an object with a string version.');
  }
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(config.version);
  if (!match) throw new Error(`config.json has invalid data version ${JSON.stringify(config.version)}.`);
  const parts = match.slice(1).map(Number);
  const current = usesCurrentEntitySchemas(config) || config.version === '0.0.6';
  const legacy = parts[0] === 0 && parts[1] === 0 && parts[2] < 6;
  if (legacy) return false;
  if (!current) {
    throw new Error(`Unsupported future workspace data version ${config.version}; update the Toolkit instead of guessing its storage layout.`);
  }
  if (!Object.prototype.hasOwnProperty.call(config, 'entity_storage')) {
    throw new Error(`Workspace data ${config.version} requires entity_storage.version = 1; refusing frozen aggregate fallback.`);
  }
  if (!isRecord(config.entity_storage) || config.entity_storage.version !== 1) {
    throw new Error(`config.json has unsupported entity_storage version ${JSON.stringify(config.entity_storage?.version)}.`);
  }
  return true;
}

async function assertEntityStorageTopology(workspaceRoot: string, config: SnlConfig): Promise<void> {
  const storage = config.entity_storage as Record<string, unknown> | undefined;
  if (
    !storage ||
    storage.version !== 1 ||
    storage.legacy_backup_version !== '0.0.5' ||
    storage.entry_default_package !== UNPACKAGED_PACKAGE_ID ||
    !storage.receipt || typeof storage.receipt !== 'object' || Array.isArray(storage.receipt)
  ) {
    throw new Error(`Workspace data ${config.version} requires complete entity_storage v1 metadata and receipt.`);
  }

  for (const [name, directory] of [
    ['packages', packageManifestsDir(workspaceRoot)],
    ['entries', entryEntitiesDir(workspaceRoot)],
    ['macros', macroEntitiesDir(workspaceRoot)],
  ] as const) {
    try {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`${directory} must be a regular, non-symlink directory.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Current workspace is missing required entity directory ${name}.`);
      }
      throw error;
    }
  }
  if (config.active_macro_packages !== undefined) {
    if (!Array.isArray(config.active_macro_packages) ||
        !config.active_macro_packages.every((value) => typeof value === 'string')) {
      throw new Error('active_macro_packages must be an array of Package IDs.');
    }
    for (const packageId of config.active_macro_packages) {
      if (packageId === UNPACKAGED_PACKAGE_ID) {
        throw new Error('active_macro_packages cannot activate the system _unpackaged Package.');
      }
      if (packageId !== packageId.trim()) {
        throw new Error('active_macro_packages contains a whitespace-padded Package ID.');
      }
      packageManifestPath(packageId);
    }
  }

  const entriesFile = entriesPath(workspaceRoot);
  let legacyEntries: unknown = null;
  if (await pathExists(entriesFile)) {
    const stat = await fs.lstat(entriesFile);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${entriesFile} must be a regular, non-symlink legacy backup file.`);
    }
    legacyEntries = await readJson(entriesFile);
  }

  const legacyPackages = new Map<string, unknown>();
  for (const { relativePath, value } of await readJsonDirectory(termMacrosDir(workspaceRoot))) {
    legacyPackages.set(path.basename(relativePath), value);
  }
  const actual = makeEntityStorageReceipt(
    legacyEntries,
    legacyPackages,
    legacyEntries !== null || legacyPackages.size > 0,
  );
  if (JSON.stringify(storage.receipt) !== JSON.stringify(actual)) {
    throw new Error('Current entity topology migration receipt does not match the frozen legacy backup.');
  }
  const manifests = await readEntityPackageManifests(workspaceRoot);
  for (const packageId of config.active_macro_packages ?? []) {
    if (!manifests.has(packageId)) {
      throw new Error(`Active Macro Package ${JSON.stringify(packageId)} has no Package manifest.`);
    }
  }
}

/**
 * Read live Entry entities. With entity storage enabled, frozen entries.json
 * is ignored; legacy workspaces retain aggregate compatibility.
 */
export async function readEntries(workspaceRoot: string): Promise<EntryData[]> {
  const config = await readConfig(workspaceRoot);
  if (usesEntityStorage(config)) {
    await assertEntityStorageTopology(workspaceRoot, config);
    const manifests = await readEntityPackageManifests(workspaceRoot, usesCurrentEntitySchemas(config));
    const records = await readJsonDirectory(entryEntitiesDir(workspaceRoot), true);
    const entryKindIds = new Set((config.entry_kinds ?? []).map(kind => kind.id));
    const ids = new Set<string>();
    const entries = records.map(({ relativePath, value }) => {
      if (!isRecord(value) || value.format !== 'snl-entry' ||
          value.version !== ENTRY_STORAGE_VERSION || typeof value.package !== 'string' ||
          !isRecord(value.entry) || typeof value.entry.id !== 'string' || !value.entry.id ||
          value.entry.id !== value.entry.id.trim() || typeof value.entry.package !== 'string') {
        throw new Error(`${relativePath} is not a valid SNL Entry envelope.`);
      }
      assertCompatibleSchemaMarker(
        value,
        entityPayloadSchemaVersion(config),
        `${relativePath} Entry envelope`,
        requiresEntitySchemaMarker(config),
      );
      if (usesCurrentEntitySchemas(config)) {
        assertCurrentEntryPayload(value.entry, `${relativePath} Entry payload`, entityPayloadSchemaVersion(config));
        if (!entryKindIds.has(value.entry.kind as string)) {
          throw new Error(`${relativePath} Entry references missing Entry Kind ${JSON.stringify(value.entry.kind)}.`);
        }
      }
      if (value.entry.package !== value.package) {
        throw new Error(`${relativePath} Entry package disagrees with its envelope package.`);
      }
      if (!manifests.has(value.package)) {
        throw new Error(`${relativePath} references missing Package ${JSON.stringify(value.package)}.`);
      }
      assertExpectedEntityPath(relativePath, entryEntityPath(value.package, value.entry.id));
      if (ids.has(value.entry.id)) {
        throw new Error(`Duplicate Entry identity ${JSON.stringify(value.entry.id)}.`);
      }
      ids.add(value.entry.id);
      return value.entry as unknown as EntryData & { package: string };
    }).sort((left, right) => left.package.localeCompare(right.package) || left.id.localeCompare(right.id));
    if (usesCurrentEntitySchemas(config)) {
      for (const manifest of manifests.values()) {
        const actual = entries
          .filter((entry) => entry.package === manifest.id)
          .map((entry) => entry.id)
          .sort((left, right) => left.localeCompare(right));
        if (JSON.stringify(manifest.entry_ids) !== JSON.stringify(actual)) {
          throw new Error(
            `Package ${JSON.stringify(manifest.id)} entry_ids does not exactly match its owned Entry entities.`,
          );
        }
      }
    }
    return entries;
  }

  const p = entriesPath(workspaceRoot);
  if (!(await pathExists(p))) {
    return [];
  }
  const raw = await readJson<unknown>(p);
  if (!Array.isArray(raw)) {
    throw new Error(`${p} is not a JSON array`);
  }
  return raw as EntryData[];
}

function defineIdentity<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/**
 * Assemble every live Package manifest and Macro entity into the historical
 * Package map API used by Toolkit linters/renderers. Legacy aggregate Package
 * files remain readable only when entity storage is not enabled.
 */
export async function readAllMacroPackages(
  workspaceRoot: string,
): Promise<Record<string, MacroPackageFile>> {
  const config = await readConfig(workspaceRoot);
  if (usesEntityStorage(config)) {
    await assertEntityStorageTopology(workspaceRoot, config);
    return readEntityMacroPackages(workspaceRoot);
  }

  const dir = termMacrosDir(workspaceRoot);
  if (!(await pathExists(dir))) {
    return {};
  }
  const names = await fs.readdir(dir);
  const out: Record<string, MacroPackageFile> = {};
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const bare = name.replace(/\.json$/i, '');
    try {
      defineIdentity(out, bare, await readJson<MacroPackageFile>(path.join(dir, name)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read macro package '${bare}': ${msg}`);
    }
  }
  return out;
}

async function readEntityMacroPackages(
  workspaceRoot: string,
): Promise<Record<string, MacroPackageFile>> {
  const config = await readConfig(workspaceRoot);
  const manifests = await readEntityPackageManifests(workspaceRoot, usesCurrentEntitySchemas(config));

  const macros = new Map<string, Record<string, MacroPackageEntryWithoutName>>();
  const identities = new Set<string>();
  for (const { relativePath, value } of await readJsonDirectory(macroEntitiesDir(workspaceRoot), true)) {
    if (!isRecord(value) || value.format !== 'snl-macro' ||
        value.version !== MACRO_STORAGE_VERSION || typeof value.package !== 'string' ||
        !isRecord(value.macro) || typeof value.macro.name !== 'string' || !value.macro.name ||
        value.macro.name !== value.macro.name.trim()) {
      throw new Error(`${relativePath} is not a valid SNL Macro envelope.`);
    }
    assertCompatibleSchemaMarker(
      value,
      entityPayloadSchemaVersion(config),
      `${relativePath} Macro envelope`,
      requiresEntitySchemaMarker(config),
    );
    const macroDocument: Record<string, unknown> = Object.create(null);
    macroDocument[value.macro.name] = value.macro;
    const currentMacro = usesCurrentEntitySchemas(config);
    if (entityPayloadSchemaVersion(config) === 2 && value.macro.uuid !== '') {
      throw new Error(`${relativePath} Macro payload schema-2 requires an empty uuid root.`);
    }
    if (currentMacro ? !isSnlBasicsMacroDocumentV11(macroDocument) : !isMacroDocumentV8(macroDocument)) {
      throw new Error(
        `${relativePath} Macro payload is not valid Macro v${currentMacro ? '11' : '8'} data.`,
      );
    }
    assertExpectedEntityPath(relativePath, macroEntityPath(value.package, value.macro.name));
    if (!manifests.has(value.package)) {
      throw new Error(`${relativePath} references missing Package ${JSON.stringify(value.package)}.`);
    }
    const identity = `${value.package}\0${value.macro.name}`;
    if (identities.has(identity)) throw new Error(`Duplicate Macro identity ${JSON.stringify(identity)}.`);
    identities.add(identity);
    const envelope = value as unknown as MacroEnvelope<Record<string, unknown>>;
    const { name: _name, ...withoutName } = envelope.macro;
    const packageMacros = macros.get(value.package) ?? {};
    defineIdentity(
      packageMacros,
      value.macro.name,
      withoutName as MacroPackageEntryWithoutName,
    );
    macros.set(value.package, packageMacros);
  }

  const out: Record<string, MacroPackageFile> = {};
  for (const manifest of [...manifests.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    defineIdentity(out, manifest.id, {
      version: usesCurrentEntitySchemas(config) ? '11' : '8',
      name: manifest.name,
      description: manifest.description,
      macros: macros.get(manifest.id) ?? {},
    });
  }
  return out;
}

async function readEntityPackageManifests(
  workspaceRoot: string,
  requireCurrentSchema = false,
): Promise<Map<string, PackageManifest>> {
  const manifests = new Map<string, PackageManifest>();
  const foldedIds = new Set<string>();
  for (const { relativePath, value } of await readJsonDirectory(packageManifestsDir(workspaceRoot), true)) {
    if (!isRecord(value) || value.format !== 'snl-package' ||
        value.version !== PACKAGE_STORAGE_VERSION || typeof value.id !== 'string' ||
        typeof value.name !== 'string' || typeof value.description !== 'string') {
      throw new Error(`${relativePath} is not a valid SNL Package manifest.`);
    }
    if (requireCurrentSchema) {
      if (value.schema_version !== CURRENT_PACKAGE_SCHEMA_VERSION) {
        throw new Error(
          `${relativePath} must carry current Package manifest schema_version ${CURRENT_PACKAGE_SCHEMA_VERSION}.`,
        );
      }
      const entryIds = value.entry_ids;
      if (
        !Array.isArray(entryIds) ||
        entryIds.some((entryId: unknown) =>
          typeof entryId !== 'string' || !entryId || entryId !== entryId.trim()) ||
        new Set(entryIds).size !== entryIds.length ||
        entryIds.some((entryId: string, index: number) =>
          index > 0 && entryIds[index - 1].localeCompare(entryId) > 0)
      ) {
        throw new Error(
          `${relativePath}#entry_ids must be a present sorted array of unique, non-empty canonical Entry ids.`,
        );
      }
    }
    assertExpectedEntityPath(relativePath, packageManifestPath(value.id));
    const folded = value.id.toLowerCase();
    if (foldedIds.has(folded)) {
      throw new Error(`Duplicate Package identity under case-folding: ${value.id}.`);
    }
    foldedIds.add(folded);
    manifests.set(value.id, value as PackageManifest);
  }
  if (!manifests.has(UNPACKAGED_PACKAGE_ID)) {
    throw new Error(`Current entity storage requires the ${UNPACKAGED_PACKAGE_ID} Package manifest.`);
  }
  return manifests;
}

async function readJsonDirectory(
  directory: string,
  required = false,
): Promise<Array<{ relativePath: string; value: unknown }>> {
  if (!(await pathExists(directory))) {
    if (required) throw new Error(`Required entity directory is missing: ${directory}.`);
    return [];
  }
  const resolvedDirectory = path.resolve(directory);
  const directoryStat = await fs.lstat(resolvedDirectory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || await fs.realpath(resolvedDirectory) !== resolvedDirectory) {
    throw new Error(`${directory} must be a canonical real directory, not a symlink.`);
  }
  const base = path.basename(directory);
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  const rows = await Promise.all(names.map(async (name) => {
    const absolute = path.join(directory, name);
    const text = (await readRegularText(absolute)).text;
    let value: unknown;
    try { value = JSON.parse(text); }
    catch (error) { throw new Error(`Invalid JSON in ${absolute}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
    return { relativePath: `${base}/${name}`, value };
  }));
  const finalDirectoryStat = await fs.lstat(resolvedDirectory);
  if (!finalDirectoryStat.isDirectory() || finalDirectoryStat.isSymbolicLink()
      || finalDirectoryStat.dev !== directoryStat.dev || finalDirectoryStat.ino !== directoryStat.ino) {
    throw new Error(`${directory} changed concurrently while its entities were read.`);
  }
  return rows;
}

function assertExpectedEntityPath(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Entity path ${actual} does not match its logical identity path ${expected}.`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Flatten every macro across every package into a `name → entry` map,
 * respecting `config.active_macro_packages` (missing = all active).
 * Later-active packages overwrite earlier ones on name collision.
 */
export async function readActiveMacros(
  workspaceRoot: string,
): Promise<Record<string, MacroPackageEntry>> {
  const [config, packages] = await Promise.all([
    readConfig(workspaceRoot),
    readAllMacroPackages(workspaceRoot),
  ]);
  const active = config.active_macro_packages === undefined
    ? null
    : new Set(config.active_macro_packages);
  if (active && usesEntityStorage(config)) {
    for (const packageId of active) {
      if (!Object.prototype.hasOwnProperty.call(packages, packageId)) {
        throw new Error(`active_macro_packages references missing Package ${JSON.stringify(packageId)}.`);
      }
    }
  }
  const flat: Record<string, MacroPackageEntry> = {};
  // Package discovery order is canonical; active_macro_packages is a set, not
  // a precedence list. Later canonical Package filenames win name collisions.
  for (const pkgName of Object.keys(packages).sort(
    (left, right) => `${left}.json`.localeCompare(`${right}.json`),
  )) {
    if (active && !active.has(pkgName)) continue;
    const pkg = packages[pkgName];
    if (!pkg?.macros) continue;
    for (const [macroName, entry] of Object.entries(pkg.macros)) {
      const withName: MacroPackageEntry = {
        name: macroName,
        ...(entry as MacroPackageEntryWithoutName),
      };
      defineIdentity(flat, macroName, withName);
    }
  }
  return flat;
}

/** List every library slug on disk. Missing dir → `[]`. */
export async function listLibrarySlugs(workspaceRoot: string): Promise<string[]> {
  const dir = librariesDir(workspaceRoot);
  if (!(await pathExists(dir))) {
    return [];
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

export async function readLibraryMeta(
  workspaceRoot: string,
  slug: string,
): Promise<LibraryMetaFile | null> {
  const p = libraryMetaPath(workspaceRoot, slug);
  if (!(await pathExists(p))) return null;
  const raw = await readCanonicalLibraryJson<unknown>(p);
  if (
    !isRecord(raw) ||
    (raw.title !== undefined && typeof raw.title !== 'string') ||
    (raw.description !== undefined && typeof raw.description !== 'string')
  ) {
    throw new Error(`${p} is not a valid Library metadata shape`);
  }
  return raw as LibraryMetaFile;
}

export async function readLibraryCounters(
  workspaceRoot: string,
  slug: string,
): Promise<CounterNode[]> {
  const p = libraryCountersPath(workspaceRoot, slug);
  if (!(await pathExists(p))) return [];
  const raw = await readCanonicalLibraryJson<unknown>(p);
  if (!isRecord(raw) || !Array.isArray(raw.counters)) {
    throw new Error(`${p} is not a valid Library counters shape`);
  }
  return raw.counters as CounterNode[];
}

export async function readLibraryGraph(
  workspaceRoot: string,
  slug: string,
): Promise<LibraryGraph | null> {
  const p = libraryGraphPath(workspaceRoot, slug);
  if (!(await pathExists(p))) return null;
  const raw = await readCanonicalLibraryJson<unknown>(p);
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !Array.isArray((raw as LibraryGraph).nodes) ||
    !Array.isArray((raw as LibraryGraph).relationships)
  ) {
    throw new Error(`${p} is not a valid LibraryGraph shape`);
  }
  return raw as LibraryGraph;
}

// Convenience: pluck the entry_kinds / macro_kinds catalogs.

export async function readEntryKinds(workspaceRoot: string): Promise<EntryKind[]> {
  const cfg = await readConfig(workspaceRoot);
  return cfg.entry_kinds ?? [];
}

export async function readMacroKinds(workspaceRoot: string): Promise<MacroKind[]> {
  const cfg = await readConfig(workspaceRoot);
  return cfg.macro_kinds ?? [];
}
