#!/usr/bin/env node

// src/cli/lint-graph.ts
import { promises as fs3 } from "node:fs";
import * as path3 from "node:path";

// lib/cli-args.ts
function parseArgs(argv, specs) {
  const bySpec = {};
  const shortAlias = {};
  for (const s of specs) {
    bySpec[s.name] = s;
    if (s.short) shortAlias[s.short] = s.name;
  }
  const flags = {};
  const positional = [];
  for (const s of specs) {
    if (s.default !== void 0) flags[s.name] = s.default;
  }
  let i = 0;
  let seenDashDash = false;
  while (i < argv.length) {
    const tok = argv[i];
    if (seenDashDash) {
      positional.push(tok);
      i++;
      continue;
    }
    if (tok === "--") {
      seenDashDash = true;
      i++;
      continue;
    }
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const inlineVal = eq === -1 ? void 0 : tok.slice(eq + 1);
      const spec = bySpec[name];
      if (!spec) throw new Error(`Unknown flag: --${name}`);
      if (spec.hasValue === false) {
        if (inlineVal !== void 0) {
          throw new Error(`Flag --${name} is boolean; did you mean --${name}?`);
        }
        flags[name] = true;
        i++;
      } else {
        if (inlineVal !== void 0) {
          flags[name] = inlineVal;
          i++;
        } else {
          const next = argv[i + 1];
          if (next === void 0 || next.startsWith("-")) {
            throw new Error(`Flag --${name} requires a value`);
          }
          flags[name] = next;
          i += 2;
        }
      }
    } else if (tok.startsWith("-") && tok.length === 2) {
      const short = tok.slice(1);
      const name = shortAlias[short];
      if (!name) throw new Error(`Unknown flag: -${short}`);
      const spec = bySpec[name];
      if (spec.hasValue === false) {
        flags[name] = true;
        i++;
      } else {
        const next = argv[i + 1];
        if (next === void 0 || next.startsWith("-")) {
          throw new Error(`Flag -${short} (--${name}) requires a value`);
        }
        flags[name] = next;
        i += 2;
      }
    } else {
      positional.push(tok);
      i++;
    }
  }
  return { flags, positional };
}
function formatUsage(cliName, synopsis, specs) {
  const lines = [`Usage: ${cliName} ${synopsis}`, "", "Options:"];
  for (const s of specs) {
    const flagStr = s.short ? `-${s.short}, --${s.name}` : `    --${s.name}`;
    const kind = s.hasValue === false ? "" : " <value>";
    const dflt = s.default !== void 0 ? ` (default: ${JSON.stringify(s.default)})` : "";
    lines.push(`  ${flagStr}${kind}${dflt}`);
    if (s.help) lines.push(`      ${s.help}`);
  }
  return lines.join("\n");
}
var ROOT_FLAG = {
  name: "root",
  short: "r",
  hasValue: true,
  default: ".",
  help: "Path to the workspace containing .SNL_Doc/ (defaults to $PWD)."
};
var JSON_FLAG = {
  name: "json",
  hasValue: false,
  default: false,
  help: "Output JSON instead of human-readable text."
};
var HELP_FLAG = {
  name: "help",
  short: "h",
  hasValue: false,
  default: false,
  help: "Show usage and exit."
};

// lib/snl-doc.ts
import { constants as constants2, promises as fs2 } from "node:fs";
import * as path2 from "node:path";

// lib/guarded-json-file.ts
import { constants, promises as fs } from "node:fs";
import path from "node:path";
async function readCanonicalDirectoryIdentity(directory) {
  const resolved = path.resolve(directory);
  const stat = await fs.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(resolved) !== resolved) {
    throw new Error(`${resolved} must be a canonical, non-symlink directory.`);
  }
  return { dev: stat.dev, ino: stat.ino };
}
async function assertCanonicalDirectory(directory, expected) {
  const observed = await readCanonicalDirectoryIdentity(directory);
  if (expected && (observed.dev !== expected.dev || observed.ino !== expected.ino)) {
    throw new Error(`${path.resolve(directory)} changed concurrently; refusing to use a replacement directory.`);
  }
  return observed;
}
async function readRegularText(file) {
  const directory = path.dirname(file);
  const directoryIdentity = await assertCanonicalDirectory(directory);
  let handle;
  try {
    handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    await assertCanonicalDirectory(directory, directoryIdentity);
    if (!stat.isFile()) throw new Error(`${file} must be a regular, non-symlink file.`);
    return {
      text: await handle.readFile("utf8"),
      mode: stat.mode & 511,
      dev: stat.dev,
      ino: stat.ino,
      directoryDev: directoryIdentity.dev,
      directoryIno: directoryIdentity.ino
    };
  } catch (error) {
    if (error.code === "ELOOP")
      throw new Error(`${file} must be a regular, non-symlink file.`, { cause: error });
    throw error;
  } finally {
    await handle?.close();
  }
}

// lib/entity-storage.ts
import { createHash } from "node:crypto";
var PACKAGE_STORAGE_VERSION = 1;
var ENTRY_STORAGE_VERSION = 1;
var CURRENT_PACKAGE_SCHEMA_VERSION = 2;
var CURRENT_ENTRY_SCHEMA_VERSION = 1;
var UNPACKAGED_PACKAGE_ID = "_unpackaged";
function compareCanonicalIds(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function semanticDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function makeEntityStorageReceipt(entries, macroPackages, legacyBackupPresent) {
  const entryList = Array.isArray(entries) ? entries : [];
  const packages = [...macroPackages].sort(([left], [right]) => left.localeCompare(right));
  return {
    legacy_backup_present: legacyBackupPresent,
    legacy_entries_present: legacyBackupPresent && Array.isArray(entries),
    entry_count: entryList.length,
    macro_package_count: packages.length,
    macro_count: packages.reduce((count, [, value]) => count + (value && typeof value === "object" && !Array.isArray(value) && value.macros && typeof value.macros === "object" && !Array.isArray(value.macros) ? Object.keys(value.macros).length : 0), 0),
    entries_digest: semanticDigest(entryList),
    macro_packages_digest: semanticDigest(packages)
  };
}
var PACKAGE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
var WINDOWS_DEVICE_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
function assertPackageId(packageId) {
  if (packageId !== UNPACKAGED_PACKAGE_ID && (!PACKAGE_ID_RE.test(packageId) || packageId.toLowerCase().endsWith(".json"))) {
    throw new Error(
      `Package id ${JSON.stringify(packageId)} must be 1-64 ASCII letters, digits, dots, underscores, or hyphens, start with a letter or digit, and not end in .json.`
    );
  }
  if (WINDOWS_DEVICE_RE.test(packageId)) {
    throw new Error(`Package id ${JSON.stringify(packageId)} is a reserved Windows device name.`);
  }
}
function entityIdentityHash(kind, ...segments) {
  if (segments.some((segment) => segment.includes("\0"))) {
    throw new Error("Entity identities may not contain NUL characters.");
  }
  return createHash("sha256").update(Buffer.from(`snl-doc/v1\0${kind}\0${segments.join("\0")}`, "utf8")).digest("hex").slice(0, 20);
}
function packageManifestPath(packageId) {
  assertPackageId(packageId);
  return `packages/${packageId}-${entityIdentityHash("package", packageId)}.json`;
}
function entryEntityPath(packageId, entryId) {
  assertPackageId(packageId);
  if (!entryId) throw new Error("Entry id must be non-empty.");
  return `entries/${packageId}-${entityIdentityHash("entry", packageId, entryId)}.json`;
}
function assertCompatibleSchemaMarker(value, current, label, required = false) {
  if (!Object.hasOwn(value, "schema_version")) {
    if (required) throw new Error(`${label} must carry schema_version ${current}.`);
    return;
  }
  if (!Number.isInteger(value.schema_version) || value.schema_version < 1) {
    throw new Error(`${label} schema_version must be a positive integer.`);
  }
  if (value.schema_version > current) {
    throw new Error(
      `${label} schema version ${String(value.schema_version)} is newer than this Toolkit supports (${current}).`
    );
  }
  if (value.schema_version < current) {
    throw new Error(
      `${label} schema_version ${String(value.schema_version)} has no registered migration to ${current}.`
    );
  }
}

// lib/snl-doc.ts
function snlDocRoot(workspaceRoot) {
  return path2.resolve(workspaceRoot, ".SNL_Doc");
}
function configPath(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "config.json");
}
function entriesPath(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "entries.json");
}
function entryEntitiesDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "entries");
}
function macroEntitiesDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "macros");
}
function packageManifestsDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "packages");
}
function termMacrosDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "term_macros");
}
function librariesDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "libraries");
}
function libraryDir(workspaceRoot, slug) {
  return path2.join(librariesDir(workspaceRoot), slug);
}
function libraryGraphPath(workspaceRoot, slug) {
  return path2.join(libraryDir(workspaceRoot, slug), "graph.json");
}
async function pathExists(p2) {
  try {
    await fs2.lstat(p2);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function readJson(p2) {
  let handle;
  try {
    handle = await fs2.open(p2, constants2.O_RDONLY | constants2.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${p2} must be a regular, non-symlink file.`);
    return JSON.parse(await handle.readFile("utf8"));
  } catch (error) {
    if (error.code === "ELOOP") {
      throw new Error(`${p2} must be a regular, non-symlink file.`);
    }
    throw error;
  } finally {
    await handle?.close();
  }
}
async function assertSnlDoc(workspaceRoot) {
  const dir = snlDocRoot(workspaceRoot);
  let stat;
  try {
    stat = await fs2.lstat(dir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    throw new Error(
      `No .SNL_Doc/ folder at ${workspaceRoot}. Point --root at the workspace that contains .SNL_Doc/.`
    );
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${dir} must be a regular, non-symlink directory.`);
  }
}
function usesCurrentEntitySchemas(config) {
  return isRecord(config) && (config.version === "0.0.11" || config.version === "0.1.0");
}
async function readConfig(workspaceRoot) {
  await assertSnlDoc(workspaceRoot);
  const p2 = configPath(workspaceRoot);
  if (!await pathExists(p2)) {
    return { version: "0.0.0" };
  }
  const config = await readJson(p2);
  if (usesCurrentEntitySchemas(config)) assertCurrentKindCatalogs(config);
  return config;
}
function assertCurrentKindCatalogs(config) {
  for (const field of ["entry_kinds", "macro_kinds"]) {
    const catalog = config[field];
    if (!Array.isArray(catalog)) throw new Error(`config.json#${field} must be an array.`);
    const ids = /* @__PURE__ */ new Set();
    catalog.forEach((value, index) => {
      const kind = value;
      if (!isRecord(value) || typeof value.id !== "string" || !value.id || value.id !== value.id.trim()) {
        throw new Error(`config.json#${field}[${index}].id must be a canonical non-empty string.`);
      }
      if (ids.has(value.id)) {
        throw new Error(`config.json#${field} contains duplicate id ${JSON.stringify(value.id)}.`);
      }
      ids.add(value.id);
      if (field === "entry_kinds") {
        if (!isLocalizedLabel(kind.name, true)) {
          throw new Error(`config.json#entry_kinds[${index}].name must be a non-empty string or valid I18n map.`);
        }
        if (kind.description !== void 0 && !isLocalizedLabel(kind.description, false)) {
          throw new Error(`config.json#entry_kinds[${index}].description must be a string or valid I18n map.`);
        }
        if (typeof kind.defaultCounterName !== "string" || typeof kind.style !== "string") {
          throw new Error(`config.json#entry_kinds[${index}] requires string defaultCounterName and style.`);
        }
      } else if (typeof kind.name !== "string" || typeof kind.description !== "string") {
        throw new Error(`config.json#macro_kinds[${index}] requires string name and description.`);
      }
      assertThemedColoring(kind.coloring, `config.json#${field}[${index}].coloring`);
    });
  }
}
function isLocalizedLabel(value, required) {
  if (typeof value === "string") return !required || !!value.trim();
  if (!isRecord(value) || value.type !== "i18n" || typeof value.default_language !== "string" || !isRecord(value.values)) {
    return false;
  }
  const values = Object.values(value.values);
  return values.length > 0 && values.every((item) => typeof item === "string") && (!required || values.some((item) => item.trim()));
}
function assertCurrentEntryPayload(value, label) {
  if (typeof value.kind !== "string" || !value.kind.trim() || value.kind !== value.kind.trim() || !isLocalizedLabel(value.title, false) || !isRecord(value.content) || !Object.hasOwn(value, "contribution_info") || !Object.hasOwn(value, "pointer")) {
    throw new Error(`${label} is not a valid schema-1 Entry payload.`);
  }
  if (value.content.snl !== void 0 && typeof value.content.snl !== "string") {
    throw new Error(`${label}#content.snl must be a string when present.`);
  }
  for (const field of ["typst", "latex", "markdown", "text"]) {
    if (value.content[field] !== void 0 && !isLocalizedLabel(value.content[field], false)) {
      throw new Error(`${label}#content.${field} must be a string or valid I18n map when present.`);
    }
  }
}
function assertThemedColoring(value, label) {
  if (!isRecord(value) || Object.hasOwn(value, "stroke") || Object.hasOwn(value, "background")) {
    throw new Error(`${label} must contain light and dark variants.`);
  }
  for (const theme of ["light", "dark"]) {
    const variant = value[theme];
    if (!isRecord(variant) || typeof variant.stroke !== "string" || !variant.stroke.trim() || typeof variant.background !== "string" || !variant.background.trim()) {
      throw new Error(`${label}.${theme} requires non-empty string stroke and background.`);
    }
  }
}
function usesEntityStorage(config) {
  if (!isRecord(config) || typeof config.version !== "string") {
    throw new Error("config.json must be an object with a string version.");
  }
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(config.version);
  if (!match) throw new Error(`config.json has invalid data version ${JSON.stringify(config.version)}.`);
  const parts = match.slice(1).map(Number);
  const current = usesCurrentEntitySchemas(config) || config.version === "0.0.6";
  const legacy = parts[0] === 0 && parts[1] === 0 && parts[2] < 6;
  if (legacy) return false;
  if (!current) {
    throw new Error(`Unsupported future workspace data version ${config.version}; update the Toolkit instead of guessing its storage layout.`);
  }
  if (!Object.prototype.hasOwnProperty.call(config, "entity_storage")) {
    throw new Error(`Workspace data ${config.version} requires entity_storage.version = 1; refusing frozen aggregate fallback.`);
  }
  if (!isRecord(config.entity_storage) || config.entity_storage.version !== 1) {
    throw new Error(`config.json has unsupported entity_storage version ${JSON.stringify(config.entity_storage?.version)}.`);
  }
  return true;
}
async function assertEntityStorageTopology(workspaceRoot, config) {
  const storage = config.entity_storage;
  if (!storage || storage.version !== 1 || storage.legacy_backup_version !== "0.0.5" || storage.entry_default_package !== UNPACKAGED_PACKAGE_ID || !storage.receipt || typeof storage.receipt !== "object" || Array.isArray(storage.receipt)) {
    throw new Error(`Workspace data ${config.version} requires complete entity_storage v1 metadata and receipt.`);
  }
  for (const [name, directory] of [
    ["packages", packageManifestsDir(workspaceRoot)],
    ["entries", entryEntitiesDir(workspaceRoot)],
    ["macros", macroEntitiesDir(workspaceRoot)]
  ]) {
    try {
      const stat = await fs2.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`${directory} must be a regular, non-symlink directory.`);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Current workspace is missing required entity directory ${name}.`);
      }
      throw error;
    }
  }
  if (config.active_macro_packages !== void 0) {
    if (!Array.isArray(config.active_macro_packages) || !config.active_macro_packages.every((value) => typeof value === "string")) {
      throw new Error("active_macro_packages must be an array of Package IDs.");
    }
    for (const packageId of config.active_macro_packages) {
      if (packageId === UNPACKAGED_PACKAGE_ID) {
        throw new Error("active_macro_packages cannot activate the system _unpackaged Package.");
      }
      if (packageId !== packageId.trim()) {
        throw new Error("active_macro_packages contains a whitespace-padded Package ID.");
      }
      packageManifestPath(packageId);
    }
  }
  const entriesFile = entriesPath(workspaceRoot);
  let legacyEntries = null;
  if (await pathExists(entriesFile)) {
    const stat = await fs2.lstat(entriesFile);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${entriesFile} must be a regular, non-symlink legacy backup file.`);
    }
    legacyEntries = await readJson(entriesFile);
  }
  const legacyPackages = /* @__PURE__ */ new Map();
  for (const { relativePath, value } of await readJsonDirectory(termMacrosDir(workspaceRoot))) {
    legacyPackages.set(path2.basename(relativePath), value);
  }
  const actual = makeEntityStorageReceipt(
    legacyEntries,
    legacyPackages,
    legacyEntries !== null || legacyPackages.size > 0
  );
  if (JSON.stringify(storage.receipt) !== JSON.stringify(actual)) {
    throw new Error("Current entity topology migration receipt does not match the frozen legacy backup.");
  }
  const manifests = await readEntityPackageManifests(workspaceRoot);
  for (const packageId of config.active_macro_packages ?? []) {
    if (!manifests.has(packageId)) {
      throw new Error(`Active Macro Package ${JSON.stringify(packageId)} has no Package manifest.`);
    }
  }
}
async function readEntries(workspaceRoot) {
  const config = await readConfig(workspaceRoot);
  if (usesEntityStorage(config)) {
    await assertEntityStorageTopology(workspaceRoot, config);
    const manifests = await readEntityPackageManifests(workspaceRoot, usesCurrentEntitySchemas(config));
    const records = await readJsonDirectory(entryEntitiesDir(workspaceRoot), true);
    const entryKindIds = new Set((config.entry_kinds ?? []).map((kind) => kind.id));
    const ids = /* @__PURE__ */ new Set();
    const entries = records.map(({ relativePath, value }) => {
      if (!isRecord(value) || value.format !== "snl-entry" || value.version !== ENTRY_STORAGE_VERSION || typeof value.package !== "string" || !isRecord(value.entry) || typeof value.entry.id !== "string" || !value.entry.id || value.entry.id !== value.entry.id.trim() || typeof value.entry.package !== "string") {
        throw new Error(`${relativePath} is not a valid SNL Entry envelope.`);
      }
      assertCompatibleSchemaMarker(
        value,
        CURRENT_ENTRY_SCHEMA_VERSION,
        `${relativePath} Entry envelope`,
        config.version === "0.1.0"
      );
      if (usesCurrentEntitySchemas(config)) {
        assertCurrentEntryPayload(value.entry, `${relativePath} Entry payload`);
        if (!entryKindIds.has(value.entry.kind)) {
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
      return value.entry;
    }).sort((left, right) => left.package.localeCompare(right.package) || left.id.localeCompare(right.id));
    if (usesCurrentEntitySchemas(config)) {
      for (const manifest of manifests.values()) {
        const actual = entries.filter((entry) => entry.package === manifest.id).map((entry) => entry.id).sort(compareCanonicalIds);
        if (JSON.stringify(manifest.entry_ids) !== JSON.stringify(actual)) {
          throw new Error(
            `Package ${JSON.stringify(manifest.id)} entry_ids does not exactly match its owned Entry entities.`
          );
        }
      }
    }
    return entries;
  }
  const p2 = entriesPath(workspaceRoot);
  if (!await pathExists(p2)) {
    return [];
  }
  const raw = await readJson(p2);
  if (!Array.isArray(raw)) {
    throw new Error(`${p2} is not a JSON array`);
  }
  return raw;
}
async function readEntityPackageManifests(workspaceRoot, requireCurrentSchema = false) {
  const manifests = /* @__PURE__ */ new Map();
  const foldedIds = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(packageManifestsDir(workspaceRoot), true)) {
    if (!isRecord(value) || value.format !== "snl-package" || value.version !== PACKAGE_STORAGE_VERSION || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string") {
      throw new Error(`${relativePath} is not a valid SNL Package manifest.`);
    }
    if (requireCurrentSchema) {
      if (value.schema_version !== CURRENT_PACKAGE_SCHEMA_VERSION) {
        throw new Error(
          `${relativePath} must carry current Package manifest schema_version ${CURRENT_PACKAGE_SCHEMA_VERSION}.`
        );
      }
      const entryIds = value.entry_ids;
      if (!Array.isArray(entryIds) || entryIds.some((entryId) => typeof entryId !== "string" || !entryId || entryId !== entryId.trim()) || new Set(entryIds).size !== entryIds.length || entryIds.some((entryId, index) => index > 0 && compareCanonicalIds(entryIds[index - 1], entryId) > 0)) {
        throw new Error(
          `${relativePath}#entry_ids must be a present sorted array of unique, non-empty canonical Entry ids.`
        );
      }
    }
    assertExpectedEntityPath(relativePath, packageManifestPath(value.id));
    const folded = value.id.toLowerCase();
    if (foldedIds.has(folded)) {
      throw new Error(`Duplicate Package identity under case-folding: ${value.id}.`);
    }
    foldedIds.add(folded);
    manifests.set(value.id, value);
  }
  if (!manifests.has(UNPACKAGED_PACKAGE_ID)) {
    throw new Error(`Current entity storage requires the ${UNPACKAGED_PACKAGE_ID} Package manifest.`);
  }
  return manifests;
}
async function readJsonDirectory(directory, required = false) {
  if (!await pathExists(directory)) {
    if (required) throw new Error(`Required entity directory is missing: ${directory}.`);
    return [];
  }
  const resolvedDirectory = path2.resolve(directory);
  const directoryStat = await fs2.lstat(resolvedDirectory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || await fs2.realpath(resolvedDirectory) !== resolvedDirectory) {
    throw new Error(`${directory} must be a canonical real directory, not a symlink.`);
  }
  const base = path2.basename(directory);
  const names = (await fs2.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const rows = await Promise.all(names.map(async (name) => {
    const absolute = path2.join(directory, name);
    const text = (await readRegularText(absolute)).text;
    let value;
    try {
      value = JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON in ${absolute}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    return { relativePath: `${base}/${name}`, value };
  }));
  const finalDirectoryStat = await fs2.lstat(resolvedDirectory);
  if (!finalDirectoryStat.isDirectory() || finalDirectoryStat.isSymbolicLink() || finalDirectoryStat.dev !== directoryStat.dev || finalDirectoryStat.ino !== directoryStat.ino) {
    throw new Error(`${directory} changed concurrently while its entities were read.`);
  }
  return rows;
}
function assertExpectedEntityPath(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Entity path ${actual} does not match its logical identity path ${expected}.`);
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function listLibrarySlugs(workspaceRoot) {
  const dir = librariesDir(workspaceRoot);
  if (!await pathExists(dir)) {
    return [];
  }
  const entries = await fs2.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort();
}

// lib/lint-graph.ts
function lintGraph(raw, ctx) {
  const issues = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    issues.push({
      severity: "error",
      code: "graph.not-object",
      message: `graph.json must be a JSON object, got ${describe(raw)}.`
    });
    return { issues };
  }
  const g = raw;
  if (!Array.isArray(g.nodes)) {
    issues.push({
      severity: "error",
      code: "graph.missing-nodes",
      message: "`nodes` must be an array.",
      path: "nodes"
    });
  }
  if (!Array.isArray(g.relationships)) {
    issues.push({
      severity: "error",
      code: "graph.missing-relationships",
      message: "`relationships` must be an array.",
      path: "relationships"
    });
  }
  if (!Array.isArray(g.nodes) || !Array.isArray(g.relationships)) {
    return { issues };
  }
  const seenNodeIds = /* @__PURE__ */ new Set();
  const nodes = [];
  g.nodes.forEach((rawNode, i) => {
    if (typeof rawNode !== "object" || rawNode === null || Array.isArray(rawNode)) {
      issues.push({
        severity: "error",
        code: "graph.node.not-object",
        message: `nodes[${i}] must be an object.`,
        path: `nodes[${i}]`
      });
      return;
    }
    const n = rawNode;
    if (typeof n.id !== "string" || n.id === "") {
      issues.push({
        severity: "error",
        code: "graph.node.missing-id",
        message: `nodes[${i}].id must be a non-empty string.`,
        path: `nodes[${i}].id`
      });
      return;
    }
    if (typeof n.label !== "string" || n.label === "") {
      issues.push({
        severity: "error",
        code: "graph.node.missing-label",
        message: `nodes[${i}].label must be a non-empty string.`,
        path: `nodes[${i}].label`
      });
    } else if (n.label !== "Entry") {
      issues.push({
        severity: "warning",
        code: "graph.node.unknown-label",
        message: `nodes[${i}].label = '${n.label}' \u2014 v2 only understands 'Entry'. The node is kept as-is on disk but ignored by the numbering engine.`,
        path: `nodes[${i}].label`
      });
    }
    if (typeof n.props !== "object" || n.props === null || Array.isArray(n.props)) {
      issues.push({
        severity: "error",
        code: "graph.node.missing-props",
        message: `nodes[${i}].props must be an object (may be empty {}).`,
        path: `nodes[${i}].props`
      });
    }
    if (seenNodeIds.has(n.id)) {
      issues.push({
        severity: "error",
        code: "graph.node.duplicate-id",
        message: `nodes[${i}].id '${n.id}' is not unique within this library.`,
        path: `nodes[${i}].id`
      });
      return;
    }
    seenNodeIds.add(n.id);
    nodes.push(n);
  });
  const relationships = [];
  g.relationships.forEach((rawRel, i) => {
    if (typeof rawRel !== "object" || rawRel === null || Array.isArray(rawRel)) {
      issues.push({
        severity: "error",
        code: "graph.rel.not-object",
        message: `relationships[${i}] must be an object.`,
        path: `relationships[${i}]`
      });
      return;
    }
    const r = rawRel;
    let bad = false;
    if (typeof r.from !== "string" || r.from === "") {
      issues.push({
        severity: "error",
        code: "graph.rel.missing-from",
        message: `relationships[${i}].from must be a non-empty string.`,
        path: `relationships[${i}].from`
      });
      bad = true;
    }
    if (typeof r.to !== "string" || r.to === "") {
      issues.push({
        severity: "error",
        code: "graph.rel.missing-to",
        message: `relationships[${i}].to must be a non-empty string.`,
        path: `relationships[${i}].to`
      });
      bad = true;
    }
    if (typeof r.label !== "string" || r.label === "") {
      issues.push({
        severity: "error",
        code: "graph.rel.missing-label",
        message: `relationships[${i}].label must be a non-empty string.`,
        path: `relationships[${i}].label`
      });
      bad = true;
    } else if (r.label !== "branch") {
      issues.push({
        severity: "warning",
        code: "graph.rel.unknown-label",
        message: `relationships[${i}].label = '${r.label}' \u2014 v2 only understands 'branch'. Kept as-is but ignored by the numbering engine.`,
        path: `relationships[${i}].label`
      });
    }
    if (!bad) relationships.push(r);
  });
  const branchRels = relationships.filter((r) => r.label === "branch");
  branchRels.forEach((r, i) => {
    if (!seenNodeIds.has(r.from)) {
      issues.push({
        severity: "error",
        code: "graph.rel.dangling-from",
        message: `Branch relationship references unknown node id '${r.from}' as parent.`,
        path: `relationships (branch #${i})`
      });
    }
    if (!seenNodeIds.has(r.to)) {
      issues.push({
        severity: "error",
        code: "graph.rel.dangling-to",
        message: `Branch relationship references unknown node id '${r.to}' as child.`,
        path: `relationships (branch #${i})`
      });
    }
  });
  const parentCount = /* @__PURE__ */ new Map();
  for (const r of branchRels) {
    if (!seenNodeIds.has(r.to)) continue;
    parentCount.set(r.to, (parentCount.get(r.to) ?? 0) + 1);
  }
  for (const [nodeId, cnt] of parentCount) {
    if (cnt > 1) {
      issues.push({
        severity: "error",
        code: "graph.multi-parent",
        message: `Node '${nodeId}' has ${cnt} incoming branch edges. Each Entry node must have at most one branch parent.`,
        path: `nodes (id=${nodeId})`
      });
    }
  }
  const cyclesFound = detectCycles(branchRels, seenNodeIds);
  for (const cycle of cyclesFound) {
    issues.push({
      severity: "error",
      code: "graph.cycle",
      message: `Branch subgraph contains a cycle: ${cycle.join(" -> ")}. The numbering engine's chain walk would loop forever.`,
      path: "relationships"
    });
  }
  const poolIds = new Set(ctx.poolEntries.map((e) => e.id));
  for (const n of nodes) {
    if (n.label !== "Entry") continue;
    const entryId = n.props?.entryId;
    if (entryId === void 0 || entryId === null || entryId === "") {
      continue;
    }
    if (typeof entryId !== "string") {
      issues.push({
        severity: "error",
        code: "graph.node.bad-entry-id-type",
        message: `Node '${n.id}'.props.entryId must be a string when present.`,
        path: `nodes (id=${n.id}).props.entryId`
      });
      continue;
    }
    if (!poolIds.has(entryId)) {
      issues.push({
        severity: "error",
        code: "graph.node.entry-not-in-pool",
        message: `Node '${n.id}'.props.entryId = '${entryId}' does not exist in the shared Entry entity pool (.SNL_Doc/entries/*.json).`,
        path: `nodes (id=${n.id}).props.entryId`
      });
    }
  }
  return { issues };
}
function detectCycles(branchRels, nodeIds) {
  const children = /* @__PURE__ */ new Map();
  for (const r of branchRels) {
    if (!nodeIds.has(r.from) || !nodeIds.has(r.to)) continue;
    const list = children.get(r.from);
    if (list) list.push(r.to);
    else children.set(r.from, [r.to]);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const colour = /* @__PURE__ */ new Map();
  const stack = [];
  const found = [];
  const visit = (nodeId) => {
    colour.set(nodeId, GRAY);
    stack.push(nodeId);
    for (const c of children.get(nodeId) ?? []) {
      const state = colour.get(c) ?? WHITE;
      if (state === GRAY) {
        const idx = stack.indexOf(c);
        const chain = stack.slice(idx).concat([c]);
        found.push(chain);
      } else if (state === WHITE) {
        visit(c);
      }
    }
    stack.pop();
    colour.set(nodeId, BLACK);
  };
  for (const id of nodeIds) {
    if ((colour.get(id) ?? WHITE) === WHITE) visit(id);
  }
  return found;
}
function describe(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

// lib/lint-report.ts
function hasErrors(report) {
  return report.issues.some((i) => i.severity === "error");
}
function issueCount(reports) {
  const c = { errors: 0, warnings: 0, infos: 0 };
  for (const r of reports) {
    for (const i of r.issues) {
      if (i.severity === "error") c.errors++;
      else if (i.severity === "warning") c.warnings++;
      else c.infos++;
    }
  }
  return c;
}
function formatReport(reports) {
  const useColor = process.stdout.isTTY;
  const c = (color, text) => useColor ? `\x1B[${color}m${text}\x1B[0m` : text;
  const sevBadge = {
    error: c("31", "ERROR  "),
    warning: c("33", "WARN   "),
    info: c("36", "INFO   ")
  };
  const lines = [];
  for (const r of reports) {
    if (r.file) lines.push(c("1", r.file));
    if (r.issues.length === 0) {
      lines.push("  (no issues)");
      continue;
    }
    for (const i of r.issues) {
      const loc = i.path ? c("2", ` [${i.path}]`) : "";
      const pos = i.position !== void 0 ? c("2", ` (at ${i.position})`) : "";
      lines.push(`  ${sevBadge[i.severity]} ${c("2", i.code)}${loc}${pos}`);
      lines.push(`         ${i.message}`);
    }
  }
  const tot = issueCount(reports);
  lines.push("");
  lines.push(
    `${tot.errors} error${tot.errors === 1 ? "" : "s"}, ${tot.warnings} warning${tot.warnings === 1 ? "" : "s"}, ${tot.infos} info`
  );
  return lines.join("\n");
}

// src/cli/lint-graph.ts
var SLUG_FLAG = {
  name: "slug",
  hasValue: true,
  help: "Library slug (relative to .SNL_Doc/libraries/). May be repeated. When neither --slug nor a positional file is given, every library on disk is linted."
};
var SPECS = [ROOT_FLAG, SLUG_FLAG, JSON_FLAG, HELP_FLAG];
async function main() {
  const rawArgv = process.argv.slice(2);
  const slugs = [];
  const filtered = [];
  for (let i = 0; i < rawArgv.length; i++) {
    const tok = rawArgv[i];
    if (tok === "--slug" || tok === "-s") {
      const next = rawArgv[i + 1];
      if (next === void 0 || next.startsWith("-")) {
        process.stderr.write(`Flag ${tok} requires a value.
`);
        return 2;
      }
      slugs.push(next);
      i++;
    } else if (tok.startsWith("--slug=")) {
      slugs.push(tok.slice("--slug=".length));
    } else {
      filtered.push(tok);
    }
  }
  let parsed;
  try {
    parsed = parseArgs(filtered, SPECS.filter((s) => s.name !== "slug"));
  } catch (err) {
    process.stderr.write(`${err.message}

`);
    process.stderr.write(usage() + "\n");
    return 2;
  }
  if (parsed.flags.help === true) {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  const root = path3.resolve(String(parsed.flags.root));
  const asJson = parsed.flags.json === true;
  try {
    await assertSnlDoc(root);
  } catch (err) {
    process.stderr.write(`${err.message}
`);
    return 2;
  }
  const targets = [...parsed.positional.map((p2) => path3.resolve(p2))];
  for (const slug of slugs) {
    targets.push(libraryGraphPath(root, slug));
  }
  if (targets.length === 0) {
    const allSlugs = await listLibrarySlugs(root);
    for (const slug of allSlugs) {
      const p2 = libraryGraphPath(root, slug);
      if (await pathExists(p2)) targets.push(p2);
    }
    if (targets.length === 0) {
      process.stderr.write(
        `No graph.json files found under ${path3.join(root, ".SNL_Doc/libraries")}.
`
      );
      return 2;
    }
  }
  const poolEntries = await readEntries(root);
  const reports = [];
  for (const abs of targets) {
    let raw;
    try {
      const text = await fs3.readFile(abs, "utf8");
      raw = JSON.parse(text);
    } catch (err) {
      reports.push({
        file: abs,
        issues: [
          {
            severity: "error",
            code: "file.read",
            message: err.message
          }
        ]
      });
      continue;
    }
    const report = lintGraph(raw, { poolEntries });
    report.file = abs;
    reports.push(report);
  }
  if (asJson) {
    process.stdout.write(JSON.stringify(reports, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(reports) + "\n");
    const c = issueCount(reports);
    process.stdout.write(
      `Linted ${reports.length} file${reports.length === 1 ? "" : "s"}: ${c.errors} error${c.errors === 1 ? "" : "s"}, ${c.warnings} warning${c.warnings === 1 ? "" : "s"}, ${c.infos} info.
`
    );
  }
  return reports.some(hasErrors) ? 1 : 0;
}
function usage() {
  return formatUsage(
    "snl-lint-graph",
    "[options] [graph.json ...]",
    [ROOT_FLAG, SLUG_FLAG, JSON_FLAG, HELP_FLAG]
  );
}
main().then((code) => process.exit(code));
