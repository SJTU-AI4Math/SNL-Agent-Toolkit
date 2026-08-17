// plugin-src/dsh-adapter.ts
import {
  defineTool
} from "@deepseek-ai/dsh-tools";

// plugin-src/toolkit-tools.ts
var ENTITY_TYPES = [
  "entry-kind",
  "macro-kind",
  "entry-package",
  "macro-package",
  "entry",
  "macro",
  "relationship",
  "library"
];
function object(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("tool input must be an object");
  }
  return input;
}
function requiredString(value, name2) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name2} must be a non-empty string`);
  return value;
}
function entityType(value) {
  if (!ENTITY_TYPES.includes(value)) {
    throw new TypeError(`entityType must be one of: ${ENTITY_TYPES.join(", ")}`);
  }
  return value;
}
var entityTypeSchema = { type: "string", enum: [...ENTITY_TYPES] };
var baseProperties = { root: { type: "string", description: "Absolute path to the workspace root." }, entityType: entityTypeSchema };
function createToolkitTools(adapter) {
  return [
    {
      name: "snl_entities_list",
      description: "List or search one kind of SNL entity in a workspace.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root", "entityType"],
        properties: { ...baseProperties, query: { type: "string" }, cursor: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 200 } }
      },
      async execute(raw) {
        const input = object(raw);
        const request = {
          root: requiredString(input.root, "root"),
          entityType: entityType(input.entityType),
          ...input.query !== void 0 ? { query: requiredString(input.query, "query") } : {},
          ...input.cursor !== void 0 ? { cursor: requiredString(input.cursor, "cursor") } : {},
          ...input.limit !== void 0 ? { limit: input.limit } : {}
        };
        if (request.limit !== void 0 && (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 200)) {
          throw new TypeError("limit must be an integer from 1 through 200");
        }
        return adapter.list(request);
      }
    },
    {
      name: "snl_entity_get",
      description: "Read one SNL entity and its revision token.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root", "entityType", "id"],
        properties: { ...baseProperties, id: { type: "string" } }
      },
      async execute(raw) {
        const input = object(raw);
        return adapter.get({
          root: requiredString(input.root, "root"),
          entityType: entityType(input.entityType),
          id: requiredString(input.id, "id")
        });
      }
    },
    {
      name: "snl_entity_apply",
      description: "Create, update, or delete one SNL entity through the authoritative entity adapter.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root", "entityType", "action"],
        properties: {
          ...baseProperties,
          action: { type: "string", enum: ["create", "update", "delete"] },
          id: { type: "string" },
          value: { type: "object" },
          expectedRevision: { type: "string" }
        }
      },
      async execute(raw) {
        const input = object(raw);
        if (!["create", "update", "delete"].includes(input.action)) {
          throw new TypeError("action must be create, update, or delete");
        }
        return adapter.apply({
          root: requiredString(input.root, "root"),
          entityType: entityType(input.entityType),
          action: input.action,
          ...input.id !== void 0 ? { id: requiredString(input.id, "id") } : {},
          ...input.value !== void 0 ? { value: object(input.value) } : {},
          ...input.expectedRevision !== void 0 ? { expectedRevision: requiredString(input.expectedRevision, "expectedRevision") } : {}
        });
      }
    },
    {
      name: "snl_workspace_validate",
      description: "Validate an SNL workspace and return structured issues without modifying it.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root"],
        properties: { root: baseProperties.root }
      },
      async execute(raw) {
        const input = object(raw);
        return adapter.validate({ root: requiredString(input.root, "root") });
      }
    }
  ];
}

// plugin-src/mcp-server.ts
import { pathToFileURL } from "node:url";
import { resolve as resolve4 } from "node:path";

// lib/entity-crud.ts
import { createHash as createHash2, randomUUID as randomUUID3 } from "node:crypto";
import { constants as constants4, promises as fs4 } from "node:fs";
import path5 from "node:path";

// lib/entity-storage.ts
import { createHash } from "node:crypto";
var PACKAGE_STORAGE_VERSION = 1;
var ENTRY_STORAGE_VERSION = 1;
var MACRO_STORAGE_VERSION = 1;
var CURRENT_PACKAGE_SCHEMA_VERSION = 2;
var CURRENT_ENTRY_SCHEMA_VERSION = 1;
var CURRENT_MACRO_SCHEMA_VERSION = 1;
var UNPACKAGED_PACKAGE_ID = "_unpackaged";
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
function macroEntityPath(packageId, macroName) {
  assertPackageId(packageId);
  if (!macroName) throw new Error("Macro name must be non-empty.");
  return `macros/${packageId}-${entityIdentityHash("macro", packageId, macroName)}.json`;
}
function assertCompatibleSchemaMarker(value, current, label) {
  if (!Object.hasOwn(value, "schema_version")) return;
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
import { constants, promises as fs } from "node:fs";
import * as path from "node:path";

// lib/snl-doc-schema.ts
import {
  isMacroDocumentV7,
  isMacroDocumentV8,
  migrateMacroDocument,
  migrateMacroV6toV7 as migrateMacroV6toV72,
  migrateMacroV7toV8 as migrateMacroV7toV82,
  migrateStyleV6toV7
} from "@sjtu-ai4math/snl-basics";

// lib/migrate-macro-package.ts
import {
  migrateMacroV6toV7,
  migrateMacroV7toV8
} from "@sjtu-ai4math/snl-basics";

// lib/snl-doc-schema.ts
function isMacroDocumentV11(value) {
  if (!isRecord(value)) return false;
  return Object.values(value).every((macro) => {
    if (!isRecord(macro) || typeof macro.name !== "string" || typeof macro.description !== "string" || typeof macro.kind !== "string" || !macro.kind || macro.kind === "partial" || typeof macro.dynamic_arity !== "boolean" || !isRecord(macro.source) || !isStringArray(macro.source.entries) || !isStringArray(macro.source.urls) || !isStringArray(macro.tags) || macro.tags.some((tag) => tag.includes("\\")) || Object.hasOwn(macro, "default_style") || !Array.isArray(macro.styles) || macro.styles.length === 0) {
      return false;
    }
    const names = /* @__PURE__ */ new Set();
    return macro.styles.every((style) => {
      if (!isRecord(style) || typeof style.style_name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(style.style_name) || names.has(style.style_name) || !isStringArray(style.tags) || style.tags.some((tag) => tag.includes("\\")) || Object.keys(style).some((field) => !["style_name", "tags", "template"].includes(field))) {
        return false;
      }
      names.add(style.style_name);
      const projections = macroV11TemplateProjections(style.template);
      if (!projections?.length) return false;
      const contracts = new Set(projections.map((projection) => {
        const placeholders = analyzePlaceholders(projection.body);
        return `${placeholders.variadic ? "dynamic" : "fixed"}:${placeholders.arity}`;
      }));
      return contracts.size === 1 && projections.every((projection) => {
        const placeholders = analyzePlaceholders(projection.body);
        return !placeholders.invalid && placeholders.variadic === macro.dynamic_arity;
      });
    });
  });
}
function macroV11TemplateProjections(value) {
  if (isTemplate(value)) return [value];
  if (!isRecord(value) || value.type !== "i18n" || typeof value.default_language !== "string" || !value.default_language || !isRecord(value.values) || !Object.hasOwn(value.values, value.default_language) || Object.keys(value).some((field) => !["type", "default_language", "values"].includes(field))) {
    return null;
  }
  const projections = Object.values(value.values);
  return projections.length > 0 && projections.every(isTemplate) ? projections : null;
}
function isTemplate(value) {
  if (!isRecord(value) || Object.hasOwn(value, "type") || !["formula_inline", "formula_display", "text", "block"].includes(String(value.mode)) || typeof value.body !== "string" || value.mode !== "block" && !value.body.trim() || value.separator !== void 0 && typeof value.separator !== "string") {
    return false;
  }
  return value.block_template_name === void 0 || value.mode === "block" && typeof value.block_template_name === "string";
}
function analyzePlaceholders(body) {
  let variadic = false;
  let max = -1;
  let invalid2 = false;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "#" || index > 0 && body[index - 1] === "\\") continue;
    const next = body[index + 1];
    if (next === "*") {
      variadic = true;
      index += 1;
    } else if (next !== void 0 && /\d/.test(next)) {
      let end = index + 2;
      while (end < body.length && /\d/.test(body[end])) end += 1;
      const digits = body.slice(index + 1, end);
      if (/^(?:0|[1-9]\d?)$/.test(digits)) max = Math.max(max, Number(digits));
      else invalid2 = true;
      index = end - 1;
    } else {
      invalid2 = true;
    }
  }
  return { variadic, arity: max + 1, invalid: invalid2 };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// lib/snl-doc.ts
function snlDocRoot(workspaceRoot) {
  return path.resolve(workspaceRoot, ".SNL_Doc");
}
function configPath(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "config.json");
}
function entriesPath(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "entries.json");
}
function entryEntitiesDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "entries");
}
function macroEntitiesDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "macros");
}
function packageManifestsDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "packages");
}
function termMacrosDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "term_macros");
}
async function pathExists(p) {
  try {
    await fs.lstat(p);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function readJson(p) {
  let handle;
  try {
    handle = await fs.open(p, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${p} must be a regular, non-symlink file.`);
    return JSON.parse(await handle.readFile("utf8"));
  } catch (error) {
    if (error.code === "ELOOP") {
      throw new Error(`${p} must be a regular, non-symlink file.`);
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
    stat = await fs.lstat(dir);
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
  return isRecord2(config) && (config.version === "0.0.11" || config.version === "0.1.0");
}
async function readConfig(workspaceRoot) {
  await assertSnlDoc(workspaceRoot);
  const p = configPath(workspaceRoot);
  if (!await pathExists(p)) {
    return { version: "0.0.0" };
  }
  const config = await readJson(p);
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
      if (!isRecord2(value) || typeof value.id !== "string" || !value.id || value.id !== value.id.trim()) {
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
  if (!isRecord2(value) || value.type !== "i18n" || typeof value.default_language !== "string" || !isRecord2(value.values)) {
    return false;
  }
  const values = Object.values(value.values);
  return values.length > 0 && values.every((item) => typeof item === "string") && (!required || values.some((item) => item.trim()));
}
function assertThemedColoring(value, label) {
  if (!isRecord2(value) || Object.hasOwn(value, "stroke") || Object.hasOwn(value, "background")) {
    throw new Error(`${label} must contain light and dark variants.`);
  }
  for (const theme of ["light", "dark"]) {
    const variant = value[theme];
    if (!isRecord2(variant) || typeof variant.stroke !== "string" || !variant.stroke.trim() || typeof variant.background !== "string" || !variant.background.trim()) {
      throw new Error(`${label}.${theme} requires non-empty string stroke and background.`);
    }
  }
}
function usesEntityStorage(config) {
  if (!isRecord2(config) || typeof config.version !== "string") {
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
  if (!isRecord2(config.entity_storage) || config.entity_storage.version !== 1) {
    throw new Error(`config.json has unsupported entity_storage version ${JSON.stringify(config.entity_storage?.version)}.`);
  }
  return true;
}
async function assertEntityStorageTopology(workspaceRoot, config) {
  const storage = config.entity_storage;
  if (!storage || storage.version !== 1 || storage.legacy_backup_version !== "0.0.5" || storage.entry_default_package !== UNPACKAGED_PACKAGE_ID || !storage.receipt || typeof storage.receipt !== "object" || Array.isArray(storage.receipt)) {
    throw new Error(`Workspace data ${config.version} requires complete entity_storage v1 metadata and receipt.`);
  }
  for (const [name2, directory] of [
    ["packages", packageManifestsDir(workspaceRoot)],
    ["entries", entryEntitiesDir(workspaceRoot)],
    ["macros", macroEntitiesDir(workspaceRoot)]
  ]) {
    try {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`${directory} must be a regular, non-symlink directory.`);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Current workspace is missing required entity directory ${name2}.`);
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
    const stat = await fs.lstat(entriesFile);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${entriesFile} must be a regular, non-symlink legacy backup file.`);
    }
    legacyEntries = await readJson(entriesFile);
  }
  const legacyPackages = /* @__PURE__ */ new Map();
  for (const { relativePath, value } of await readJsonDirectory(termMacrosDir(workspaceRoot))) {
    legacyPackages.set(path.basename(relativePath), value);
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
    const ids = /* @__PURE__ */ new Set();
    const entries = records.map(({ relativePath, value }) => {
      if (!isRecord2(value) || value.format !== "snl-entry" || value.version !== ENTRY_STORAGE_VERSION || typeof value.package !== "string" || !isRecord2(value.entry) || typeof value.entry.id !== "string" || !value.entry.id || value.entry.id !== value.entry.id.trim() || typeof value.entry.package !== "string") {
        throw new Error(`${relativePath} is not a valid SNL Entry envelope.`);
      }
      assertCompatibleSchemaMarker(value, CURRENT_ENTRY_SCHEMA_VERSION, `${relativePath} Entry envelope`);
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
        const actual = entries.filter((entry) => entry.package === manifest.id).map((entry) => entry.id).sort((left, right) => left.localeCompare(right));
        if (JSON.stringify(manifest.entry_ids) !== JSON.stringify(actual)) {
          throw new Error(
            `Package ${JSON.stringify(manifest.id)} entry_ids does not exactly match its owned Entry entities.`
          );
        }
      }
    }
    return entries;
  }
  const p = entriesPath(workspaceRoot);
  if (!await pathExists(p)) {
    return [];
  }
  const raw = await readJson(p);
  if (!Array.isArray(raw)) {
    throw new Error(`${p} is not a JSON array`);
  }
  return raw;
}
function defineIdentity(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  });
}
async function readAllMacroPackages(workspaceRoot) {
  const config = await readConfig(workspaceRoot);
  if (usesEntityStorage(config)) {
    await assertEntityStorageTopology(workspaceRoot, config);
    return readEntityMacroPackages(workspaceRoot);
  }
  const dir = termMacrosDir(workspaceRoot);
  if (!await pathExists(dir)) {
    return {};
  }
  const names = await fs.readdir(dir);
  const out = {};
  for (const name2 of names) {
    if (!name2.endsWith(".json")) continue;
    const bare = name2.replace(/\.json$/i, "");
    try {
      defineIdentity(out, bare, await readJson(path.join(dir, name2)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read macro package '${bare}': ${msg}`);
    }
  }
  return out;
}
async function readEntityMacroPackages(workspaceRoot) {
  const config = await readConfig(workspaceRoot);
  const manifests = await readEntityPackageManifests(workspaceRoot, usesCurrentEntitySchemas(config));
  const macros = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(macroEntitiesDir(workspaceRoot), true)) {
    if (!isRecord2(value) || value.format !== "snl-macro" || value.version !== MACRO_STORAGE_VERSION || typeof value.package !== "string" || !isRecord2(value.macro) || typeof value.macro.name !== "string" || !value.macro.name || value.macro.name !== value.macro.name.trim()) {
      throw new Error(`${relativePath} is not a valid SNL Macro envelope.`);
    }
    assertCompatibleSchemaMarker(value, CURRENT_MACRO_SCHEMA_VERSION, `${relativePath} Macro envelope`);
    const macroDocument = /* @__PURE__ */ Object.create(null);
    macroDocument[value.macro.name] = value.macro;
    const currentMacro = usesCurrentEntitySchemas(config);
    if (currentMacro ? !isMacroDocumentV11(macroDocument) : !isMacroDocumentV8(macroDocument)) {
      throw new Error(
        `${relativePath} Macro payload is not valid Macro v${currentMacro ? "11" : "8"} data.`
      );
    }
    assertExpectedEntityPath(relativePath, macroEntityPath(value.package, value.macro.name));
    if (!manifests.has(value.package)) {
      throw new Error(`${relativePath} references missing Package ${JSON.stringify(value.package)}.`);
    }
    const identity = `${value.package}\0${value.macro.name}`;
    if (identities.has(identity)) throw new Error(`Duplicate Macro identity ${JSON.stringify(identity)}.`);
    identities.add(identity);
    const envelope = value;
    const { name: _name, ...withoutName } = envelope.macro;
    const packageMacros = macros.get(value.package) ?? {};
    defineIdentity(
      packageMacros,
      value.macro.name,
      withoutName
    );
    macros.set(value.package, packageMacros);
  }
  const out = {};
  for (const manifest of [...manifests.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    defineIdentity(out, manifest.id, {
      version: usesCurrentEntitySchemas(config) ? "11" : "8",
      name: manifest.name,
      description: manifest.description,
      macros: macros.get(manifest.id) ?? {}
    });
  }
  return out;
}
async function readEntityPackageManifests(workspaceRoot, requireCurrentSchema = false) {
  const manifests = /* @__PURE__ */ new Map();
  const foldedIds = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(packageManifestsDir(workspaceRoot), true)) {
    if (!isRecord2(value) || value.format !== "snl-package" || value.version !== PACKAGE_STORAGE_VERSION || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string") {
      throw new Error(`${relativePath} is not a valid SNL Package manifest.`);
    }
    if (requireCurrentSchema) {
      if (value.schema_version !== CURRENT_PACKAGE_SCHEMA_VERSION) {
        throw new Error(
          `${relativePath} must carry current Package manifest schema_version ${CURRENT_PACKAGE_SCHEMA_VERSION}.`
        );
      }
      const entryIds = value.entry_ids;
      if (!Array.isArray(entryIds) || entryIds.some((entryId) => typeof entryId !== "string" || !entryId || entryId !== entryId.trim()) || new Set(entryIds).size !== entryIds.length || entryIds.some((entryId, index) => index > 0 && entryIds[index - 1].localeCompare(entryId) > 0)) {
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
  const directoryStat = await fs.lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`${directory} must be a real directory, not a symlink.`);
  }
  const base = path.basename(directory);
  const names = (await fs.readdir(directory)).filter((name2) => name2.endsWith(".json")).sort();
  return Promise.all(names.map(async (name2) => {
    const absolute = path.join(directory, name2);
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${absolute} must be a regular, non-symlink file.`);
    }
    return {
      relativePath: `${base}/${name2}`,
      value: await readJson(absolute)
    };
  }));
}
function assertExpectedEntityPath(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Entity path ${actual} does not match its logical identity path ${expected}.`);
  }
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function readActiveMacros(workspaceRoot) {
  const [config, packages] = await Promise.all([
    readConfig(workspaceRoot),
    readAllMacroPackages(workspaceRoot)
  ]);
  const active = config.active_macro_packages === void 0 ? null : new Set(config.active_macro_packages);
  if (active && usesEntityStorage(config)) {
    for (const packageId of active) {
      if (!Object.prototype.hasOwnProperty.call(packages, packageId)) {
        throw new Error(`active_macro_packages references missing Package ${JSON.stringify(packageId)}.`);
      }
    }
  }
  const flat = {};
  for (const pkgName of Object.keys(packages).sort(
    (left, right) => `${left}.json`.localeCompare(`${right}.json`)
  )) {
    if (active && !active.has(pkgName)) continue;
    const pkg = packages[pkgName];
    if (!pkg?.macros) continue;
    for (const [macroName, entry] of Object.entries(pkg.macros)) {
      const withName = {
        name: macroName,
        ...entry
      };
      defineIdentity(flat, macroName, withName);
    }
  }
  return flat;
}
async function readEntryKinds(workspaceRoot) {
  const cfg = await readConfig(workspaceRoot);
  return cfg.entry_kinds ?? [];
}

// lib/lint-entry.ts
import { extractExportedBinders } from "@sjtu-ai4math/snl-basics/core";

// lib/snl-parser.ts
import {
  parseSnlSyntaxTree,
  SnlSyntaxTreeParseError
} from "@sjtu-ai4math/snl-basics/core";
import {
  parseSnlSyntaxTree as parseSnlSyntaxTree2,
  SnlSyntaxTreeParseError as SnlSyntaxTreeParseError2
} from "@sjtu-ai4math/snl-basics/core";
function tryParseSnlSyntaxTree(input) {
  try {
    return { ok: true, tree: parseSnlSyntaxTree2(input) };
  } catch (e) {
    if (e instanceof SnlSyntaxTreeParseError2) {
      return { ok: false, error: e.message, position: e.position };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// lib/lint-entry.ts
function safeExportedBinders(source) {
  if (typeof source !== "string" || !source.trim()) return /* @__PURE__ */ new Set();
  try {
    return extractExportedBinders(source);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function isValidI18nString(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value;
  if (record.type !== "i18n" || typeof record.default_language !== "string") return false;
  if (typeof record.values !== "object" || record.values === null || Array.isArray(record.values)) return false;
  const values = Object.values(record.values);
  return values.length > 0 && values.every((item) => typeof item === "string");
}
function lintEntry(raw, ctx) {
  const issues = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    issues.push({
      severity: "error",
      code: "entry.not-object",
      message: `Entry payload must be a JSON object, got ${describe(raw)}.`
    });
    return { issues };
  }
  const e = raw;
  if (typeof e.id !== "string" || e.id.trim() === "") {
    issues.push({
      severity: "error",
      code: "entry.missing-id",
      message: "Field `id` must be a non-empty string.",
      path: "id"
    });
  } else if (ctx.siblingEntries.some((s) => s.id === e.id)) {
    issues.push({
      severity: "error",
      code: "entry.duplicate-id",
      message: `Entry id '${e.id}' already exists in the shared pool.`,
      path: "id"
    });
  }
  if (typeof e.kind !== "string" || e.kind.trim() === "") {
    issues.push({
      severity: "error",
      code: "entry.missing-kind",
      message: "Field `kind` must be a non-empty string.",
      path: "kind"
    });
  } else if (!ctx.entryKinds.some((k) => k.id === e.kind)) {
    const known = ctx.entryKinds.map((k) => k.id).join(", ") || "(none defined)";
    issues.push({
      severity: "error",
      code: "entry.unknown-kind",
      message: `kind '${e.kind}' is not in config.entry_kinds. Known: ${known}.`,
      path: "kind"
    });
  }
  if (typeof e.title !== "string" && !isValidI18nString(e.title)) {
    issues.push({
      severity: "error",
      code: "entry.missing-title",
      message: "Field `title` must be a string or valid I18n map.",
      path: "title"
    });
  }
  if (typeof e.content !== "object" || e.content === null || Array.isArray(e.content)) {
    issues.push({
      severity: "error",
      code: "entry.missing-content",
      message: "Field `content` must be an object (may be empty).",
      path: "content"
    });
  } else {
    for (const dialect of ["snl", "typst", "latex", "markdown", "text"]) {
      const val = e.content[dialect];
      const valid = val === void 0 || typeof val === "string" || dialect !== "snl" && isValidI18nString(val);
      if (!valid) {
        issues.push({
          severity: "error",
          code: "entry.bad-content-dialect",
          message: dialect === "snl" ? `content.snl must be a language-invariant string when present, got ${describe(val)}.` : `content.${dialect} must be a string or valid I18n map when present, got ${describe(val)}.`,
          path: `content.${dialect}`
        });
      }
    }
  }
  if (!("contribution_info" in e)) {
    issues.push({
      severity: "error",
      code: "entry.missing-contribution-info",
      message: "Field `contribution_info` is required (may be null).",
      path: "contribution_info"
    });
  }
  if (!("pointer" in e)) {
    issues.push({
      severity: "error",
      code: "entry.missing-pointer",
      message: "Field `pointer` is required (may be null).",
      path: "pointer"
    });
  }
  const snl = typeof e.content === "object" && e.content !== null && typeof e.content.snl === "string" ? e.content.snl : "";
  if (snl.trim().length > 0) {
    const parsed = tryParseSnlSyntaxTree(snl);
    if (!parsed.ok) {
      issues.push({
        severity: "error",
        code: "snl.parse",
        message: parsed.error,
        path: "content.snl",
        position: parsed.position
      });
    } else {
      const unresolved = findUnresolvedIdentifiers(snl, ctx.macros);
      for (const name2 of unresolved) {
        issues.push({
          severity: ctx.strictMacros ? "error" : "info",
          code: "snl.identifier-not-in-pool",
          message: `Identifier '${name2}' is not a registered macro; will render as fvar/bvar fallback. May be intentional (bound variable, local free variable) or may indicate a typo / missing macro registration \u2014 agent decides.`,
          path: "content.snl"
        });
      }
      const exportedBinders = /* @__PURE__ */ new Map();
      for (const sibling of ctx.siblingEntries) {
        if (typeof sibling.id === "string") {
          exportedBinders.set(sibling.id, safeExportedBinders(sibling.content?.snl));
        }
      }
      if (typeof e.id === "string") {
        exportedBinders.set(e.id, safeExportedBinders(snl));
      }
      const srcRefs = collectSrcReferences(parsed.tree);
      for (const ref of srcRefs) {
        const declarations = exportedBinders.get(ref.sourceId);
        if (!declarations) {
          issues.push({
            severity: "info",
            code: "snl.src-dangling",
            message: `Cross-entry src-postfix reference \`${ref.binderName}@${ref.sourceId}\` does not resolve to any entry in the shared pool. Tolerated (renders with a warning badge), but likely a typo \u2014 entry ids are stable once created and should point at a real source entry that owns the bound variable. See docs/context-entry-design.md.`,
            path: "content.snl"
          });
        } else if (!declarations.has(ref.binderName)) {
          issues.push({
            severity: "info",
            code: "snl.src-no-declaration",
            message: `Cross-entry source ${JSON.stringify(ref.sourceId)} exists but does not export binder ${JSON.stringify(ref.binderName)}.`,
            path: "content.snl"
          });
        }
      }
    }
  }
  return { issues };
}
function collectSrcReferences(node) {
  const out = /* @__PURE__ */ new Map();
  visit(node);
  return [...out.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.binderName.localeCompare(b.binderName));
  function visit(n) {
    if (!n || typeof n !== "object") return;
    const nn = n;
    const binderName = typeof nn.temporary_source === "string" ? nn.temporary_source : typeof nn.binder_name === "string" ? nn.binder_name : typeof nn.macro_name === "string" ? nn.macro_name : "";
    if (nn.postfix && typeof nn.postfix === "object") {
      const postfix = nn.postfix;
      if (postfix.type === "name" && typeof postfix.name === "string" && postfix.name.length > 0) {
        const ref = { sourceId: postfix.name, binderName };
        out.set(`${ref.sourceId}\0${ref.binderName}`, ref);
      }
    }
    if (nn.mdata && typeof nn.mdata === "object") {
      const src = nn.mdata.src;
      if (typeof src === "string" && src.length > 0) {
        const ref = { sourceId: src, binderName };
        out.set(`${ref.sourceId}\0${ref.binderName}`, ref);
      }
    }
    if (Array.isArray(nn.children)) for (const child of nn.children) visit(child);
  }
}
function findUnresolvedIdentifiers(snl, pool) {
  const stripped = snl.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[\s\S]*?\$/g, " ").replace(/%[\s\S]*?%/g, " ").replace(/`[\s\S]*?`/g, " ");
  const withoutAtIdents = stripped.replace(
    /@[A-Za-z_][A-Za-z0-9_.\-]*/g,
    " "
  );
  const re = /([A-Za-z_][A-Za-z0-9_.\-]*)/g;
  const seen = /* @__PURE__ */ new Set();
  const unresolved = /* @__PURE__ */ new Set();
  let m;
  while ((m = re.exec(withoutAtIdents)) !== null) {
    const name2 = m[1];
    if (seen.has(name2)) continue;
    seen.add(name2);
    if (!Object.hasOwn(pool, name2)) unresolved.add(name2);
  }
  return [...unresolved].sort();
}
function describe(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

// lib/katex-check.ts
import katex from "katex";
function checkKatex(source, opts = {}) {
  try {
    katex.renderToString(source, {
      throwOnError: true,
      displayMode: opts.displayMode === true,
      macros: opts.macros,
      // Strict rejects a few permissive-but-questionable inputs (Unicode
      // in math, deprecated commands, etc.). We keep it OFF: the
      // extension's runtime KaTeX runs in default (non-strict) mode, so
      // strict mode would raise false positives the author can't
      // reproduce in-app.
      strict: "ignore"
    });
    return { ok: true };
  } catch (err) {
    const raw = err.message ?? String(err);
    const { message, position } = parseKatexError(raw);
    return { ok: false, message, position, raw };
  }
}
function parseKatexError(raw) {
  let msg = raw.replace(/^KaTeX parse error:\s*/, "");
  let position;
  const posMatch = msg.match(/ at position (\d+):\s.*$/);
  if (posMatch) {
    position = Number.parseInt(posMatch[1], 10);
    msg = msg.slice(0, posMatch.index);
  }
  return { message: msg, position };
}
function fillTemplateWithPlaceholders(template, dynamic = {}) {
  const PH = "x";
  const separator = dynamic.separator ?? ", ";
  const variadicBody = [PH, PH, PH].join(separator);
  const out = [];
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === "\\" && template[i + 1] === "#") {
      out.push("\\#");
      i += 2;
      continue;
    }
    if (ch === "#") {
      if (template[i + 1] === "*") {
        out.push(variadicBody);
        i += 2;
        continue;
      }
      const digitsMatch = template.slice(i + 1).match(/^\d+/);
      if (digitsMatch) {
        out.push(PH);
        i += 1 + digitsMatch[0].length;
        continue;
      }
      out.push(ch);
      i += 1;
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
}
function templateNeedsKatex(mode, template) {
  if (mode === "formula_inline" || mode === "formula_display") return true;
  return /\\[A-Za-z]/.test(template);
}

// lib/lint-package.ts
var KNOWN_MODES = /* @__PURE__ */ new Set(["formula_inline", "formula_display", "text", "block"]);
var STYLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
var LEGACY_STYLE_FIELDS = [
  "tag",
  "variadic_left",
  "variadic_join",
  "variadic_right",
  "react_renderer_key"
];
function lintPackage(raw, opts = {}) {
  const issues = [];
  if (!isRecord3(raw)) {
    issues.push({ severity: "error", code: "package.not-object", message: `Macro package must be a JSON object, got ${describe2(raw)}.` });
    return { issues };
  }
  const pkg = raw;
  if (typeof pkg.version !== "string" || pkg.version === "") {
    issues.push({ severity: "error", code: "package.missing-version", message: "Field `version` must be a non-empty string.", path: "version" });
  }
  if (typeof pkg.name !== "string" || pkg.name === "") {
    issues.push({ severity: "error", code: "package.missing-name", message: "Field `name` must be a non-empty string.", path: "name" });
  }
  if (pkg.description !== void 0 && typeof pkg.description !== "string") {
    issues.push({ severity: "error", code: "package.bad-description", message: "`description` must be a string when present.", path: "description" });
  }
  if (!isRecord3(pkg.macros)) {
    issues.push({ severity: "error", code: "package.missing-macros", message: "`macros` must be an object (name \u2192 macro).", path: "macros" });
    return { issues };
  }
  if (pkg.version === "11") {
    const document = Object.fromEntries(Object.entries(pkg.macros).map(([name2, macro]) => [
      name2,
      isRecord3(macro) ? { name: name2, ...macro } : macro
    ]));
    if (!isMacroDocumentV11(document)) {
      issues.push({
        severity: "error",
        code: "package.macro-v11",
        message: "Package macros must satisfy the canonical Macro v11 schema.",
        path: "macros"
      });
    }
    if (opts.checkKatex !== false) lintMacroV11Katex(pkg.macros, issues);
    return { issues };
  }
  function lintMacroV11Katex(macros, issues2) {
    for (const [name2, rawMacro] of Object.entries(macros)) {
      if (!isRecord3(rawMacro) || rawMacro.kind === "sub" || !Array.isArray(rawMacro.styles)) continue;
      rawMacro.styles.forEach((rawStyle, styleIndex) => {
        if (!isRecord3(rawStyle)) return;
        const projections = macroV11TemplateProjections(rawStyle.template);
        if (!projections) return;
        projections.forEach((template, projectionIndex) => {
          if (!templateNeedsKatex(template.mode, template.body)) return;
          const filled = fillTemplateWithPlaceholders(template.body, {
            separator: template.separator
          });
          const result = checkKatex(filled, { displayMode: template.mode === "formula_display" });
          if (!result.ok) {
            const suffix = projections.length > 1 ? `.values[${projectionIndex}]` : "";
            const path6 = `macros.${name2}.styles[${styleIndex}].template${suffix}.body`;
            issues2.push({
              severity: "error",
              code: "style.katex-compile",
              message: `${path6} does not compile under KaTeX: ${result.message}. Filled preview ('#N' -> x): ${filled}`,
              path: path6,
              position: result.position
            });
          }
        });
      });
    }
  }
  for (const [name2, macro] of Object.entries(pkg.macros)) {
    lintMacroEntry(name2, macro, issues, opts.checkKatex !== false);
  }
  return { issues };
}
function lintMacroEntry(name2, raw, issues, checkKatexEnabled) {
  const path6 = `macros.${name2}`;
  if (!isRecord3(raw)) {
    issues.push({ severity: "error", code: "macro.not-object", message: `${path6}: macro entry must be an object.`, path: path6 });
    return;
  }
  const macro = raw;
  if (typeof macro.description !== "string") {
    issues.push({ severity: "error", code: "macro.missing-description", message: `${path6}.description must be a string (may be empty).`, path: `${path6}.description` });
  }
  if (!isRecord3(macro.source) || !isStringArray2(macro.source.entries) || !isStringArray2(macro.source.urls)) {
    issues.push({ severity: "error", code: "macro.bad-source", message: `${path6}.source must be { entries: string[], urls: string[] } (both arrays required, may be empty).`, path: `${path6}.source` });
  }
  if (typeof macro.dynamic_arity !== "boolean") {
    issues.push({ severity: "error", code: "macro.missing-dynamic-arity", message: `${path6}.dynamic_arity must be a boolean.`, path: `${path6}.dynamic_arity` });
  }
  if (macro.kind !== void 0 && typeof macro.kind !== "string") {
    issues.push({ severity: "error", code: "macro.bad-kind", message: `${path6}.kind must be a string when present.`, path: `${path6}.kind` });
  }
  if (!isStringArray2(macro.tags)) {
    issues.push({ severity: "error", code: "macro.missing-tags", message: `${path6}.tags must be a string array (may be empty).`, path: `${path6}.tags` });
  } else if (macro.tags.some((tag) => tag.includes("\\"))) {
    issues.push({ severity: "error", code: "macro.bad-tags", message: `${path6}.tags must not contain backslashes.`, path: `${path6}.tags` });
  }
  const defaultStyle = macro.default_style;
  if (defaultStyle === void 0) {
    issues.push({ severity: "error", code: "macro.missing-default-style", message: `${path6}.default_style must be a language \u2192 style-name object.`, path: `${path6}.default_style` });
  } else if (!isRecord3(defaultStyle) || Object.values(defaultStyle).some((value) => typeof value !== "string")) {
    issues.push({ severity: "error", code: "macro.bad-default-style", message: `${path6}.default_style must map language keys to style-name strings.`, path: `${path6}.default_style` });
  }
  if (!Array.isArray(macro.styles) || macro.styles.length === 0) {
    issues.push({ severity: "error", code: "macro.missing-styles", message: `${path6}.styles must be a non-empty array.`, path: `${path6}.styles` });
    return;
  }
  const seenNames = /* @__PURE__ */ new Set();
  const maxIndexes = [];
  macro.styles.forEach((rawStyle, index) => {
    const stylePath = `${path6}.styles[${index}]`;
    if (!isRecord3(rawStyle)) {
      issues.push({ severity: "error", code: "style.not-object", message: `${stylePath} must be an object.`, path: stylePath });
      return;
    }
    const style = rawStyle;
    for (const field of LEGACY_STYLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(rawStyle, field)) {
        issues.push({ severity: "error", code: "style.legacy-field", message: `${stylePath}.${field} is a pre-v7 field and is not allowed by Macro v8. Migrate the package.`, path: `${stylePath}.${field}` });
      }
    }
    if (typeof style.style_name !== "string" || style.style_name === "") {
      issues.push({ severity: "error", code: "style.missing-name", message: `${stylePath}.style_name must be a non-empty string.`, path: `${stylePath}.style_name` });
    } else if (!STYLE_NAME_RE.test(style.style_name)) {
      issues.push({ severity: "error", code: "style.bad-name", message: `${stylePath}.style_name must match ${STYLE_NAME_RE}.`, path: `${stylePath}.style_name` });
    } else if (seenNames.has(style.style_name)) {
      issues.push({ severity: "error", code: "style.duplicate-name", message: `${stylePath}.style_name '${style.style_name}' is duplicated within this macro.`, path: `${stylePath}.style_name` });
    } else {
      seenNames.add(style.style_name);
    }
    if (typeof style.mode !== "string" || !KNOWN_MODES.has(style.mode)) {
      issues.push({ severity: "error", code: "style.bad-mode", message: `${stylePath}.mode = ${JSON.stringify(style.mode)} \u2014 must be one of ${[...KNOWN_MODES].join(", ")}.`, path: `${stylePath}.mode` });
    }
    if (!isStringArray2(style.tags)) {
      issues.push({ severity: "error", code: "style.missing-tags", message: `${stylePath}.tags must be a string array (may be empty).`, path: `${stylePath}.tags` });
    } else if (style.tags.some((tag) => tag.includes("\\"))) {
      issues.push({ severity: "error", code: "style.bad-tags", message: `${stylePath}.tags must not contain backslashes.`, path: `${stylePath}.tags` });
    }
    if (style.separator !== void 0 && typeof style.separator !== "string") {
      issues.push({ severity: "error", code: "style.bad-separator", message: `${stylePath}.separator must be a string when present.`, path: `${stylePath}.separator` });
    }
    if (style.block_template_name !== void 0 && typeof style.block_template_name !== "string") {
      issues.push({ severity: "error", code: "style.bad-block-template", message: `${stylePath}.block_template_name must be a string when present.`, path: `${stylePath}.block_template_name` });
    } else if (style.block_template_name !== void 0 && style.mode !== "block") {
      issues.push({ severity: "error", code: "style.block-template-non-block", message: `${stylePath}.block_template_name is valid only in block mode.`, path: `${stylePath}.block_template_name` });
    }
    if (typeof style.template !== "string" || style.template.trim().length === 0) {
      issues.push({ severity: "error", code: "style.missing-template", message: `${stylePath}.template must be a non-empty string.`, path: `${stylePath}.template` });
      return;
    }
    const scan = scanTemplatePlaceholders(style.template);
    maxIndexes.push(scan.maxIndex);
    for (const token of scan.badTokens) {
      issues.push({ severity: "error", code: "style.bad-placeholder", message: `${stylePath}.template contains illegal placeholder '${token}'; only canonical '#0' through '#99' and '#*' are recognised (escape a literal hash as '\\#').`, path: `${stylePath}.template` });
    }
    if (macro.dynamic_arity === true && !scan.hasVariadic) {
      issues.push({ severity: "error", code: "style.dynamic-arity-missing-variadic", message: `${stylePath}.template must contain '#*' because the macro is dynamic_arity.`, path: `${stylePath}.template` });
    } else if (macro.dynamic_arity !== true && scan.hasVariadic) {
      issues.push({ severity: "error", code: "style.variadic-without-dynamic-arity", message: `${stylePath}.template uses '#*' but the macro is not dynamic_arity.`, path: `${stylePath}.template` });
    }
    if (macro.dynamic_arity !== true && style.separator !== void 0) {
      issues.push({ severity: "warning", code: "style.separator-unused", message: `${stylePath}.separator is ignored when the macro is not dynamic_arity.`, path: `${stylePath}.separator` });
    }
    if (checkKatexEnabled && macro.kind !== "partial" && style.template.length > 0 && typeof style.mode === "string" && templateNeedsKatex(style.mode, style.template) && scan.badTokens.length === 0) {
      const filled = fillTemplateWithPlaceholders(style.template, { separator: typeof style.separator === "string" ? style.separator : void 0 });
      const result = checkKatex(filled, { displayMode: style.mode === "formula_display" });
      if (!result.ok) {
        issues.push({ severity: "error", code: "style.katex-compile", message: `${stylePath}.template does not compile under KaTeX: ${result.message}. Filled preview (\u2018#N\u2019 \u2192 x): ${filled}`, path: `${stylePath}.template`, position: result.position });
      }
    }
  });
  if (isRecord3(defaultStyle)) {
    for (const [language, styleName] of Object.entries(defaultStyle)) {
      if (!language.trim() || typeof styleName !== "string" || !seenNames.has(styleName)) {
        issues.push({ severity: "error", code: "macro.bad-default-style", message: `${path6}.default_style[${JSON.stringify(language)}] must name a declared style.`, path: `${path6}.default_style` });
      }
    }
  }
  if (maxIndexes.length > 1 && new Set(maxIndexes).size > 1) {
    issues.push({ severity: "info", code: "macro.style-arity-mismatch", message: `${path6}: styles reference different maximum child indexes (${[...new Set(maxIndexes)].sort((a, b) => a - b).join(", ")}). This is legal but may be an oversight.`, path: `${path6}.styles` });
  }
}
function scanTemplatePlaceholders(template) {
  let maxIndex = -1;
  let hasVariadic = false;
  const badTokens = [];
  for (let index = 0; index < template.length; index += 1) {
    if (template[index] !== "#" || index > 0 && template[index - 1] === "\\") continue;
    const next = template[index + 1];
    if (next === "*") {
      hasVariadic = true;
      index += 1;
      continue;
    }
    if (next !== void 0 && /\d/.test(next)) {
      let end2 = index + 2;
      while (end2 < template.length && /\d/.test(template[end2])) end2 += 1;
      const digits = template.slice(index + 1, end2);
      if (/^(?:0|[1-9]\d?)$/.test(digits)) {
        maxIndex = Math.max(maxIndex, Number.parseInt(digits, 10));
      } else {
        badTokens.push(`#${digits}`);
      }
      index = end2 - 1;
      continue;
    }
    let end = index + 1;
    if (next === "#") end += 1;
    else if (next !== void 0 && /[A-Za-z_]/.test(next)) {
      end += 1;
      while (end < template.length && /[A-Za-z0-9_]/.test(template[end])) end += 1;
    } else if (next !== void 0 && !/\s/.test(next)) end += 1;
    badTokens.push(template.slice(index, end));
    index = end - 1;
  }
  return { maxIndex, hasVariadic, badTokens };
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray2(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function describe2(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// lib/entity-references.ts
import { constants as constants2 } from "node:fs";
import { promises as fs2 } from "node:fs";
import * as path3 from "node:path";
import {
  findNodeAtLocation,
  applyEdits as applyJsonEdits,
  modify as modifyJson,
  parseTree,
  printParseErrorCode
} from "jsonc-parser";

// lib/workspace-data-lock.ts
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { open, readFile, unlink } from "node:fs/promises";
import * as path2 from "node:path";
var DATA_WRITE_LOCK_FILENAME = ".data-write.lock";
function errorCode(error) {
  return error && typeof error === "object" && "code" in error ? String(error.code) : void 0;
}
function isLockRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  return record.version === 1 && Number.isInteger(record.pid) && typeof record.hostname === "string" && typeof record.token === "string" && typeof record.purpose === "string" && typeof record.createdAt === "string";
}
function localProcessIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== "ESRCH";
  }
}
async function readLock(lockPath) {
  try {
    const value = JSON.parse(await readFile(lockPath, "utf8"));
    return isLockRecord(value) ? value : null;
  } catch {
    return null;
  }
}
async function acquireLock(workspaceRoot, purpose) {
  const lockPath = path2.join(workspaceRoot, ".SNL_Doc", DATA_WRITE_LOCK_FILENAME);
  const record = {
    version: 1,
    pid: process.pid,
    hostname: hostname(),
    token: randomUUID(),
    purpose,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const handle = await open(lockPath, "wx", 384);
    try {
      await handle.writeFile(`${JSON.stringify(record)}
`, "utf8");
      await handle.sync();
      return { handle, lockPath, record };
    } catch (error) {
      await handle.close();
      await unlink(lockPath).catch(() => void 0);
      throw error;
    }
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
    const existing = await readLock(lockPath);
    const stale = existing !== null && existing.hostname === hostname() && !localProcessIsAlive(existing.pid);
    if (stale) {
      throw new Error(
        `SNL workspace data has a stale ${existing.purpose} lock from pid ${existing.pid}. After confirming no writer is active, remove ${lockPath} and retry.`
      );
    }
    const owner = existing ? `${existing.purpose} by pid ${existing.pid} on ${existing.hostname}` : "an unreadable lock (remove it only after confirming no writer is active)";
    throw new Error(`SNL workspace data is locked for ${owner}.`);
  }
}
async function withWorkspaceDataLock(workspaceRoot, purpose, task) {
  const acquired = await acquireLock(workspaceRoot, purpose);
  try {
    return await task();
  } finally {
    await acquired.handle.close();
    const current = await readLock(acquired.lockPath);
    if (current?.token === acquired.record.token) {
      try {
        await unlink(acquired.lockPath);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
    }
  }
}

// lib/entity-references.ts
async function findEntityReferences(workspaceRoot, entityType2, id) {
  const canonicalWorkspace = await validateWorkspaceBoundary(workspaceRoot);
  validateNonEmptyIdentity(id);
  const files = await loadWorkspaceJson(canonicalWorkspace);
  return collectOccurrences(files, entityType2, id).sort(compareOccurrence);
}
function macroIsActive(files, id) {
  const config = files.find((file) => file.relPath === "config.json")?.data;
  const active = Array.isArray(config?.active_macro_packages) ? new Set(config.active_macro_packages) : null;
  return files.some((file) => {
    if (file.relPath.startsWith("macros/")) {
      const packageId = file.data?.package;
      if (typeof packageId !== "string" || active && !active.has(packageId)) return false;
      return file.data?.macro?.name === id;
    }
    if (!file.relPath.startsWith("term_macros/")) return false;
    const bare = path3.posix.basename(file.relPath, ".json");
    if (active && !active.has(bare)) return false;
    const macros = file.data?.macros;
    return isRecord4(macros) && Object.prototype.hasOwnProperty.call(macros, id);
  });
}
function collectOccurrences(files, entityType2, id, options = {}) {
  const out = [];
  const includeSnlMacroTokens = entityType2 !== "macro" || options.includeUnresolvedMacroTokens === true || macroIsActive(files, id);
  for (const file of files) {
    collectFileOccurrences(file, entityType2, id, out, includeSnlMacroTokens);
  }
  return out;
}
function collectFileOccurrences(file, entityType2, id, out, includeSnlMacroTokens) {
  const data = file.data;
  if (/^packages\/[^/]+\.json$/.test(file.relPath)) {
    if (entityType2 === "entry" && Array.isArray(data?.entry_ids)) {
      data.entry_ids.forEach((entryId, index) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType2, id, "reference", `entry_ids[${index}]`));
        }
      });
    }
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
    const entry = data?.entry;
    if (entityType2 === "entry" && entry?.id === id) {
      out.push(occurrence(file, entityType2, id, "definition", "entry.id"));
    }
    const snl = entry?.content?.snl;
    if (typeof snl === "string" && snl.trim() !== "") {
      for (const ref of scanSnlReferences(snl, {
        postfixedMacroNames: entityType2 === "macro" && includeSnlMacroTokens ? /* @__PURE__ */ new Set([id]) : void 0
      })) {
        if (ref.entityType !== entityType2 || ref.id !== id) continue;
        if (entityType2 === "macro" && !includeSnlMacroTokens) continue;
        const pos = offsetPosition(snl, ref.start);
        out.push({
          ...occurrence(file, entityType2, id, "reference", "entry.content.snl"),
          offset: ref.start,
          snlLine: pos.line,
          snlColumn: pos.column
        });
      }
    }
    return;
  }
  if (/^macros\/[^/]+\.json$/.test(file.relPath)) {
    const macro = data?.macro;
    if (entityType2 === "macro" && macro?.name === id) {
      out.push(occurrence(file, entityType2, id, "definition", "macro.name"));
    }
    if (entityType2 === "entry" && Array.isArray(macro?.source?.entries)) {
      macro.source.entries.forEach((entryId, index) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType2, id, "reference", `macro.source.entries[${index}]`));
        }
      });
    }
    return;
  }
  if (file.relPath === "entries.json" && Array.isArray(data)) {
    data.forEach((entry, index) => {
      if (entityType2 === "entry" && entry?.id === id) {
        out.push(occurrence(file, entityType2, id, "definition", `[${index}].id`));
      }
      const snl = entry?.content?.snl;
      if (typeof snl === "string" && snl.trim() !== "") {
        for (const ref of scanSnlReferences(snl, {
          postfixedMacroNames: entityType2 === "macro" && includeSnlMacroTokens ? /* @__PURE__ */ new Set([id]) : void 0
        })) {
          if (ref.entityType !== entityType2 || ref.id !== id) continue;
          if (entityType2 === "macro" && !includeSnlMacroTokens) continue;
          const pos = offsetPosition(snl, ref.start);
          out.push({
            ...occurrence(file, entityType2, id, "reference", `[${index}].content.snl`),
            offset: ref.start,
            snlLine: pos.line,
            snlColumn: pos.column
          });
        }
      }
    });
    return;
  }
  if (file.relPath.startsWith("term_macros/")) {
    const macros = data?.macros;
    if (!macros || typeof macros !== "object" || Array.isArray(macros)) return;
    for (const [macroId, macro] of Object.entries(macros)) {
      if (entityType2 === "macro" && macroId === id) {
        out.push(occurrence(file, entityType2, id, "definition", `macros[${JSON.stringify(macroId)}]`));
      }
      if (entityType2 === "entry" && Array.isArray(macro?.source?.entries)) {
        macro.source.entries.forEach((entryId, index) => {
          if (entryId === id) {
            out.push(
              occurrence(
                file,
                entityType2,
                id,
                "reference",
                `macros[${JSON.stringify(macroId)}].source.entries[${index}]`
              )
            );
          }
        });
      }
    }
    return;
  }
  if (entityType2 === "entry" && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node, index) => {
      if (node?.props?.entryId === id) {
        out.push(occurrence(file, entityType2, id, "reference", `nodes[${index}].props.entryId`));
      }
    });
  } else if (file.relPath === "relationships.json" && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel, index) => {
      if (entityType2 === "entry" && rel?.from === id) {
        out.push(occurrence(file, entityType2, id, "reference", `relationships[${index}].from`));
      }
      if (entityType2 === "entry" && rel?.to === id) {
        out.push(occurrence(file, entityType2, id, "reference", `relationships[${index}].to`));
      }
      if (rel?.metadata?.generator !== "macro-source-scan") return;
      const witnessField = entityType2 === "macro" ? "macros" : "postfixes";
      const witnesses = rel.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value, witnessIndex) => {
        if (value === id) {
          out.push(
            occurrence(
              file,
              entityType2,
              id,
              "reference",
              `relationships[${index}].metadata.${witnessField}[${witnessIndex}]`
            )
          );
        }
      });
    });
  }
}
function scanSnlReferences(source, options = {}) {
  parseSnlSyntaxTree(source);
  const tokens = tokenizeSnl(source);
  const refs = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== "ident") continue;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (prev?.type === "lbracket" || prev?.type === "hash") continue;
    if (prev?.type === "at" && !isPostfixAt(tokens[i - 2])) continue;
    if (next?.type === "at") {
      if (options.postfixedMacroNames?.has(token.value)) {
        refs.push({ entityType: "macro", id: token.value, start: token.start, end: token.end });
      }
      continue;
    }
    if (prev?.type === "at" && isPostfixAt(tokens[i - 2])) {
      refs.push({ entityType: "entry", id: token.value, start: token.start, end: token.end });
      continue;
    }
    if (/^\d+(?:\.\d+)*$/.test(token.value)) continue;
    refs.push({ entityType: "macro", id: token.value, start: token.start, end: token.end });
  }
  return refs;
}
function isPostfixAt(previous) {
  return previous !== void 0 && ["ident", "delimited", "rparen", "rbracket"].includes(previous.type);
}
function tokenizeSnl(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "$" || ch === "%" || ch === "`") {
      const delimiter = ch === "$" && source[i + 1] === "$" ? "$$" : ch;
      const close = source.indexOf(delimiter, i + delimiter.length);
      if (close < 0) throw new Error(`Malformed SNL: unclosed ${delimiter} delimiter at offset ${i}.`);
      tokens.push({ type: "delimited", value: source.slice(i, close + delimiter.length), start: i, end: close + delimiter.length });
      i = close + delimiter.length;
      continue;
    }
    if (/[A-Za-z0-9_\\]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[A-Za-z0-9_.\-]/.test(source[i])) i++;
      tokens.push({ type: "ident", value: source.slice(start, i), start, end: i });
      continue;
    }
    const punctuation = {
      "@": "at",
      "#": "hash",
      "(": "lparen",
      ")": "rparen",
      "[": "lbracket",
      "]": "rbracket",
      ",": "comma",
      "=": "eq"
    };
    const type = punctuation[ch];
    if (!type) throw new Error(`Malformed SNL: unexpected character ${JSON.stringify(ch)} at offset ${i}.`);
    tokens.push({ type, value: ch, start: i, end: i + 1 });
    i++;
  }
  return tokens;
}
async function validateWorkspaceBoundary(workspaceRoot) {
  const requestedRoot = path3.resolve(workspaceRoot);
  let canonicalRoot;
  try {
    canonicalRoot = await fs2.realpath(requestedRoot);
  } catch {
    throw new Error(`Workspace root does not exist: ${requestedRoot}`);
  }
  const rootStat = await fs2.lstat(canonicalRoot);
  if (!rootStat.isDirectory()) throw new Error(`Workspace root is not a directory: ${canonicalRoot}`);
  const requestedDoc = path3.join(requestedRoot, ".SNL_Doc");
  let docStat;
  try {
    docStat = await fs2.lstat(requestedDoc);
  } catch {
    throw new Error(
      `No .SNL_Doc/ folder at ${requestedRoot}. Point --root at the workspace that contains .SNL_Doc/.`
    );
  }
  if (!docStat.isDirectory() || docStat.isSymbolicLink()) {
    throw new Error(`${requestedDoc} must be a real directory, not a symlink.`);
  }
  const canonicalDoc = await fs2.realpath(requestedDoc);
  const expectedDoc = path3.join(canonicalRoot, ".SNL_Doc");
  if (canonicalDoc !== expectedDoc) {
    throw new Error(`${requestedDoc} escapes the canonical workspace boundary.`);
  }
  return canonicalRoot;
}
async function assertCanonicalDirectory(dir, docRoot2) {
  const stat = await fs2.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${dir} must be a real directory, not a symlink.`);
  }
  const real = await fs2.realpath(dir);
  const relative2 = path3.relative(docRoot2, real);
  if (relative2.startsWith("..") || path3.isAbsolute(relative2)) {
    throw new Error(`${dir} escapes the canonical .SNL_Doc boundary.`);
  }
}
async function workspaceUsesEntityStorage(root) {
  const configPath2 = path3.join(root, "config.json");
  let handle;
  try {
    handle = await fs2.open(configPath2, constants2.O_RDONLY | constants2.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${configPath2} must be a regular, non-symlink file.`);
    const config = JSON.parse(await handle.readFile("utf8"));
    return usesEntityStorage(config);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    if (error.code === "ELOOP") {
      throw new Error(`${configPath2} must be a regular, non-symlink file.`);
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}
async function appendJsonDirectoryCandidates(root, relativeDirectory, candidates) {
  const directory = path3.join(root, relativeDirectory);
  try {
    await assertCanonicalDirectory(directory, root);
    for (const entry of await fs2.readdir(directory, { withFileTypes: true })) {
      const absolute = path3.join(directory, entry.name);
      if (entry.name.endsWith(".json") && entry.isSymbolicLink()) {
        throw new Error(`${absolute} must not be a symlink.`);
      }
      if (entry.isFile() && entry.name.endsWith(".json")) {
        candidates.push(path3.join(relativeDirectory, entry.name));
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function loadWorkspaceJson(workspaceRoot) {
  const root = snlDocRoot(workspaceRoot);
  await assertCanonicalDirectory(root, root);
  const entityStorage = await workspaceUsesEntityStorage(root);
  const candidates = ["config.json", "relationships.json"];
  if (entityStorage) {
    await Promise.all([
      readEntries(workspaceRoot),
      readActiveMacros(workspaceRoot)
    ]);
    await appendJsonDirectoryCandidates(root, "packages", candidates);
    await appendJsonDirectoryCandidates(root, "entries", candidates);
    await appendJsonDirectoryCandidates(root, "macros", candidates);
  } else {
    candidates.push("entries.json");
    await appendJsonDirectoryCandidates(root, "term_macros", candidates);
  }
  const libraryRoot = path3.join(root, "libraries");
  try {
    await assertCanonicalDirectory(libraryRoot, root);
    const libraries = await fs2.readdir(libraryRoot, { withFileTypes: true });
    for (const entry of libraries) {
      if (!entry.name.startsWith(".") && entry.isSymbolicLink()) {
        throw new Error(`${path3.join(libraryRoot, entry.name)} must not be a symlink.`);
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        await assertCanonicalDirectory(path3.join(libraryRoot, entry.name), root);
        candidates.push(path3.join("libraries", entry.name, "graph.json"));
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const unique = [...new Set(candidates)].sort();
  const loaded = [];
  for (const relPath of unique) {
    const absPath = path3.join(root, relPath);
    await assertCanonicalDirectory(path3.dirname(absPath), root);
    let raw;
    let stat;
    let handle;
    try {
      handle = await fs2.open(absPath, constants2.O_RDONLY | constants2.O_NOFOLLOW);
      stat = await handle.stat();
      if (!stat.isFile()) {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      raw = await handle.readFile("utf8");
    } catch (error) {
      if (handle) await handle.close();
      if (error.code === "ENOENT") continue;
      if (error.code === "ELOOP") {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      throw error;
    }
    await handle.close();
    const errors = [];
    const tree = parseTree(raw, errors, { disallowComments: true, allowTrailingComma: false });
    if (!tree || errors.length > 0) {
      const detail = errors.map((e) => `${printParseErrorCode(e.error)}@${e.offset}`).join(", ");
      throw new Error(`Failed to parse ${absPath}: ${detail || "empty JSON document"}`);
    }
    validateNoDuplicateKeys(tree, absPath);
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse ${absPath}: ${error.message}`);
    }
    const rel = relPath.split(path3.sep).join("/");
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
      docRoot: root
    });
  }
  return loaded;
}
function validateNoDuplicateKeys(node, absPath) {
  if (node.type === "object") {
    const seen = /* @__PURE__ */ new Set();
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
      if (typeof key !== "string") continue;
      if (seen.has(key)) {
        throw new Error(`${absPath}: duplicate JSON property ${JSON.stringify(key)} is not safe to migrate.`);
      }
      seen.add(key);
    }
  }
  for (const child of node.children ?? []) validateNoDuplicateKeys(child, absPath);
}
function validateSchemaShape(absPath, relPath, data) {
  const value = data;
  const fail = (message) => {
    throw new Error(`${absPath}: ${message}`);
  };
  if (relPath === "config.json") {
    if (!isRecord4(value)) fail("config.json must be an object.");
    if (value.active_macro_packages !== void 0 && (!Array.isArray(value.active_macro_packages) || !value.active_macro_packages.every((item) => typeof item === "string"))) {
      fail("config.active_macro_packages must be a string array when present.");
    }
    return;
  }
  if (/^packages\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord4(value) || value.format !== "snl-package" || value.version !== 1 || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string") {
      fail("Package manifest must use the snl-package v1 envelope.");
    }
    if (relPath !== packageManifestPath(value.id)) fail("Package manifest path does not match its logical identity.");
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord4(value) || value.format !== "snl-entry" || value.version !== 1 || typeof value.package !== "string" || !isRecord4(value.entry) || typeof value.entry.id !== "string" || !isRecord4(value.entry.content) || value.entry.package !== value.package) {
      fail("Entry entity must use the snl-entry v1 envelope with matching Package identity.");
    }
    if (relPath !== entryEntityPath(value.package, value.entry.id)) fail("Entry entity path does not match its logical identity.");
    if (value.entry.content.snl !== void 0 && typeof value.entry.content.snl !== "string") {
      fail("Entry content.snl must be a string when present.");
    }
    return;
  }
  if (/^macros\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord4(value) || value.format !== "snl-macro" || value.version !== 1 || typeof value.package !== "string" || !isRecord4(value.macro) || typeof value.macro.name !== "string" || !isRecord4(value.macro.source) || !Array.isArray(value.macro.source.entries) || !value.macro.source.entries.every((item) => typeof item === "string")) {
      fail("Macro entity must use the snl-macro v1 envelope with source.entries[].");
    }
    if (relPath !== macroEntityPath(value.package, value.macro.name)) fail("Macro entity path does not match its logical identity.");
    return;
  }
  if (relPath === "entries.json") {
    if (!Array.isArray(value)) fail("entries.json must be an array.");
    value.forEach((entry, index) => {
      if (!isRecord4(entry) || typeof entry.id !== "string" || !isRecord4(entry.content)) {
        fail(`entry ${index} must contain string id and object content.`);
      }
      if (entry.content.snl !== void 0 && typeof entry.content.snl !== "string") {
        fail(`entry ${index} content.snl must be a string when present.`);
      }
    });
    return;
  }
  if (relPath.startsWith("term_macros/")) {
    if (!isRecord4(value) || !isRecord4(value.macros)) fail("macro package must contain an object macros map.");
    for (const [name2, macro] of Object.entries(value.macros)) {
      if (!isRecord4(macro) || !isRecord4(macro.source) || !Array.isArray(macro.source.entries)) {
        fail(`macro ${JSON.stringify(name2)} must contain source.entries[].`);
      }
      if (!macro.source.entries.every((item) => typeof item === "string")) {
        fail(`macro ${JSON.stringify(name2)} source.entries must contain only strings.`);
      }
    }
    return;
  }
  if (/^libraries\/[^/]+\/graph\.json$/.test(relPath)) {
    if (!isRecord4(value) || !Array.isArray(value.nodes) || !Array.isArray(value.relationships)) {
      fail("Library graph must contain nodes[] and relationships[].");
    }
    value.nodes.forEach((node, index) => {
      if (!isRecord4(node) || !isRecord4(node.props)) fail(`graph node ${index} must contain object props.`);
      if (node.props.entryId !== void 0 && typeof node.props.entryId !== "string") {
        fail(`graph node ${index} props.entryId must be a string when present.`);
      }
    });
    return;
  }
  if (relPath === "relationships.json") {
    if (!isRecord4(value) || !Array.isArray(value.relationships)) {
      fail("relationships.json must contain relationships[].");
    }
    value.relationships.forEach((rel, index) => {
      if (!isRecord4(rel) || typeof rel.from !== "string" || typeof rel.to !== "string") {
        fail(`relationship ${index} must contain string from/to.`);
      }
      if (isRecord4(rel.metadata) && rel.metadata.generator === "macro-source-scan") {
        for (const field of ["macros", "postfixes"]) {
          const values = rel.metadata[field];
          if (values !== void 0 && (!Array.isArray(values) || !values.every((v) => typeof v === "string"))) {
            fail(`relationship ${index} metadata.${field} must be a string array when present.`);
          }
        }
      }
    });
  }
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateNonEmptyIdentity(id) {
  if (id.trim() === "") throw new Error("Identity must be a non-empty string.");
}
function occurrence(file, entityType2, id, role, jsonPath) {
  let category;
  if (role === "definition") category = "definition";
  else if (file.relPath.startsWith("packages/") && jsonPath.startsWith("entry_ids[")) category = "package-membership";
  else if (jsonPath.includes(".content.snl")) category = "snl";
  else if (/^libraries\//.test(file.relPath)) category = "library-index";
  else if (jsonPath.includes(".source.entries[")) category = "macro-source";
  else if (jsonPath.includes(".metadata.macros[") || jsonPath.includes(".metadata.postfixes[")) category = "generated-witness";
  else category = "relationship";
  return { entityType: entityType2, id, role, category, file: file.relPath, path: jsonPath };
}
function offsetPosition(source, offset) {
  const before = source.slice(0, offset).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
}
function compareOccurrence(a, b) {
  return a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || (a.offset ?? -1) - (b.offset ?? -1);
}

// lib/entity-writes.ts
import { constants as constants3, promises as fs3 } from "node:fs";
import * as path4 from "node:path";
import { randomUUID as randomUUID2 } from "node:crypto";
function isRecord5(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function assertCurrentWriteConfig(config, cli) {
  if (!usesEntityStorage(config)) {
    throw new Error(`${cli} requires workspace data 0.0.6, 0.0.11, or 0.1.0 per-entity storage.`);
  }
  if (!isRecord5(config) || !Array.isArray(config.entry_kinds)) {
    throw new Error("Current config.json entry_kinds must be an array.");
  }
  if (!Array.isArray(config.macro_kinds)) {
    throw new Error("Current config.json macro_kinds must be an array.");
  }
}
function effectiveActivePackageIds(config, packages) {
  const configured = config.active_macro_packages;
  return new Set(Array.isArray(configured) ? configured.filter((id) => typeof id === "string") : Object.keys(packages).filter((id) => id !== UNPACKAGED_PACKAGE_ID));
}
async function canonicalWriteWorkspaceRoot(workspaceRoot) {
  const resolved = path4.resolve(workspaceRoot);
  const real = await fs3.realpath(resolved);
  const stat = await fs3.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || real !== resolved) {
    throw new Error(`Workspace root ${resolved} must be a canonical, non-symlink directory.`);
  }
  const doc = path4.join(resolved, ".SNL_Doc");
  let docStat;
  try {
    docStat = await fs3.lstat(doc);
  } catch {
    throw new Error(`Workspace must contain an existing .SNL_Doc directory: ${doc}.`);
  }
  if (!docStat.isDirectory() || docStat.isSymbolicLink()) {
    throw new Error(`${doc} must be a real directory, not a symlink.`);
  }
  const realDoc = await fs3.realpath(doc);
  if (realDoc !== path4.join(real, ".SNL_Doc")) {
    throw new Error(`${doc} escapes the canonical workspace boundary.`);
  }
  return resolved;
}
function normalizeEntryDraft(raw, packageOverride) {
  if (!isRecord5(raw)) return raw;
  const normalizedOverride = typeof packageOverride === "string" ? packageOverride.trim() : packageOverride;
  const packageId = normalizedOverride !== void 0 ? normalizedOverride : raw.package !== void 0 ? typeof raw.package === "string" ? raw.package.trim() : raw.package : UNPACKAGED_PACKAGE_ID;
  return {
    ...raw,
    id: raw.id === void 0 ? raw.id : typeof raw.id === "string" ? raw.id.trim() : raw.id,
    package: packageId,
    kind: raw.kind === void 0 ? raw.kind : typeof raw.kind === "string" ? raw.kind.trim() : raw.kind,
    title: raw.title === void 0 ? "" : typeof raw.title === "string" ? raw.title.trim() : raw.title,
    content: raw.content === void 0 ? {} : raw.content,
    contribution_info: Object.prototype.hasOwnProperty.call(raw, "contribution_info") ? raw.contribution_info : null,
    pointer: Object.prototype.hasOwnProperty.call(raw, "pointer") ? raw.pointer : null
  };
}
function templateUsesVariadic(value) {
  if (typeof value !== "string") return false;
  for (let index = 0; index < value.length - 1; index += 1) {
    if (value[index] !== "#" || value[index + 1] !== "*") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) return true;
  }
  return false;
}
function normalizeMacroDraft(raw, current = false) {
  if (!isRecord5(raw)) return raw;
  const styles = Array.isArray(raw.styles) ? raw.styles.map((style) => isRecord5(style) ? { ...style, tags: style.tags === void 0 ? [] : style.tags } : style) : raw.styles;
  const firstStyle = Array.isArray(styles) && isRecord5(styles[0]) && typeof styles[0].style_name === "string" ? styles[0].style_name : void 0;
  const source = raw.source === void 0 ? {} : raw.source;
  const normalizedSource = isRecord5(source) ? {
    ...source,
    entries: source.entries === void 0 ? [] : source.entries,
    urls: source.urls === void 0 ? [] : source.urls
  } : source;
  return {
    ...raw,
    description: raw.description === void 0 ? "" : raw.description,
    source: normalizedSource,
    kind: current && raw.kind === void 0 ? "const" : raw.kind,
    dynamic_arity: raw.dynamic_arity === void 0 ? Array.isArray(styles) && styles.some((style) => isRecord5(style) && (current ? macroV11TemplateUsesVariadic(style.template) : templateUsesVariadic(style.template))) : raw.dynamic_arity,
    ...current ? {} : {
      default_style: raw.default_style === void 0 ? firstStyle ? { en: firstStyle } : void 0 : raw.default_style
    },
    tags: raw.tags === void 0 ? [] : raw.tags,
    styles
  };
}
function macroV11TemplateUsesVariadic(value) {
  if (!isRecord5(value)) return false;
  if (value.type === "i18n" && isRecord5(value.values)) {
    return Object.values(value.values).some(macroV11TemplateUsesVariadic);
  }
  return templateUsesVariadic(value.body);
}
async function installNewJson(docRoot2, relativePath, value) {
  const target = path4.join(docRoot2, relativePath);
  const directory = path4.dirname(target);
  const dirStat = await fs3.lstat(directory);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) {
    throw new Error(`${directory} must be a regular, non-symlink directory.`);
  }
  const temp = path4.join(directory, `.${path4.basename(target)}.snl-add-${process.pid}-${randomUUID2()}.tmp`);
  let handle;
  try {
    handle = await fs3.open(temp, constants3.O_CREAT | constants3.O_EXCL | constants3.O_WRONLY, 420);
    await handle.writeFile(jsonText(value), "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    await fs3.link(temp, target);
  } finally {
    await handle?.close();
    await fs3.rm(temp, { force: true });
  }
}
function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
async function readRegularText(file) {
  let handle;
  try {
    handle = await fs3.open(file, constants3.O_RDONLY | constants3.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${file} must be a regular, non-symlink file.`);
    return { text: await handle.readFile("utf8"), mode: stat.mode & 511 };
  } finally {
    await handle?.close();
  }
}
async function replaceJsonIfUnchanged(file, expected, value) {
  const current = await readRegularText(file);
  if (current.text !== expected) throw new Error(`${file} changed during Package creation; refusing to overwrite it.`);
  const directory = path4.dirname(file);
  const temp = path4.join(directory, `.${path4.basename(file)}.snl-add-${process.pid}-${randomUUID2()}.tmp`);
  let handle;
  try {
    handle = await fs3.open(temp, constants3.O_CREAT | constants3.O_EXCL | constants3.O_WRONLY, current.mode);
    await handle.writeFile(jsonText(value), "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    if ((await readRegularText(file)).text !== expected) {
      throw new Error(`${file} changed during Package creation; refusing to overwrite it.`);
    }
    await fs3.rename(temp, file);
  } finally {
    await handle?.close();
    await fs3.rm(temp, { force: true });
  }
}
async function addEntryEntity(workspaceRoot, raw, options = {}) {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, "add Entry entity", async () => {
    const config = await readConfig(workspaceRoot);
    assertCurrentWriteConfig(config, "snl-add-entry");
    const [entries, entryKinds, macros, packages] = await Promise.all([
      readEntries(workspaceRoot),
      readEntryKinds(workspaceRoot),
      readActiveMacros(workspaceRoot),
      readAllMacroPackages(workspaceRoot)
    ]);
    const normalized = normalizeEntryDraft(raw, options.package);
    const issues = [];
    if (isRecord5(raw) && options.package !== void 0 && Object.prototype.hasOwnProperty.call(raw, "package") && (typeof raw.package !== "string" || raw.package.trim() !== options.package.trim())) {
      issues.push({
        severity: "error",
        code: "entry.package-mismatch",
        message: `Draft package ${JSON.stringify(raw.package)} disagrees with --package ${JSON.stringify(options.package)}.`,
        path: "package"
      });
    }
    const report = lintEntry(normalized, {
      entryKinds,
      macros,
      siblingEntries: entries,
      strictMacros: options.strictMacros
    });
    issues.push(...report.issues);
    const packageValue = isRecord5(normalized) ? normalized.package : void 0;
    let packageId = "";
    if (typeof packageValue !== "string" || packageValue.length === 0) {
      issues.push({
        severity: "error",
        code: "entry.bad-package",
        message: "Entry package must be a non-empty Package ID string.",
        path: "package"
      });
    } else {
      packageId = packageValue;
      try {
        assertPackageId(packageId);
      } catch (error) {
        issues.push({
          severity: "error",
          code: "entry.bad-package",
          message: error instanceof Error ? error.message : String(error),
          path: "package"
        });
      }
    }
    if (packageId && !Object.prototype.hasOwnProperty.call(packages, packageId)) {
      issues.push({
        severity: "error",
        code: "entry.package-not-found",
        message: `Package ${JSON.stringify(packageId)} does not exist. Create it first or use _unpackaged.`,
        path: "package"
      });
    }
    if (issues.some((issue) => issue.code === "entry.duplicate-id")) {
      const id = isRecord5(normalized) && typeof normalized.id === "string" ? normalized.id : "";
      return {
        status: "conflict",
        entity: "entry",
        code: "entry.duplicate-id",
        message: `Entry id ${JSON.stringify(id)} already exists.`
      };
    }
    if (issues.some((issue) => issue.severity === "error")) {
      return { status: "invalid", entity: "entry", issues };
    }
    const entry = normalized;
    const relativePath = entryEntityPath(entry.package, entry.id);
    const envelope = {
      format: "snl-entry",
      version: ENTRY_STORAGE_VERSION,
      ...usesCurrentEntitySchemas(config) ? { schema_version: CURRENT_ENTRY_SCHEMA_VERSION } : {},
      package: entry.package,
      entry
    };
    const manifestFile = path4.join(
      snlDocRoot(workspaceRoot),
      packageManifestPath(entry.package)
    );
    const originalManifest = usesCurrentEntitySchemas(config) ? await readRegularText(manifestFile) : null;
    const nextManifest = originalManifest ? (() => {
      const manifest = JSON.parse(originalManifest.text);
      const entryIds = Array.isArray(manifest.entry_ids) ? manifest.entry_ids.filter((value) => typeof value === "string") : [];
      return {
        ...manifest,
        entry_ids: [.../* @__PURE__ */ new Set([...entryIds, entry.id])].sort((left, right) => left.localeCompare(right))
      };
    })() : null;
    try {
      await installNewJson(snlDocRoot(workspaceRoot), relativePath, envelope);
      if (originalManifest && nextManifest) {
        try {
          await options.beforePackageManifestInstall?.();
          await replaceJsonIfUnchanged(manifestFile, originalManifest.text, nextManifest);
        } catch (error) {
          const entityFile = path4.join(snlDocRoot(workspaceRoot), relativePath);
          try {
            await removeJsonIfUnchanged(entityFile, jsonText(envelope));
          } catch (rollbackError) {
            throw new Error(
              `${error instanceof Error ? error.message : String(error)} Rollback of ${entityFile} failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}.`,
              { cause: error }
            );
          }
          throw error;
        }
      }
    } catch (error) {
      if (error.code === "EEXIST") {
        return {
          status: "conflict",
          entity: "entry",
          code: "entry.duplicate-id",
          message: `Entry id ${JSON.stringify(entry.id)} already exists.`
        };
      }
      throw error;
    }
    return {
      status: "created",
      entity: "entry",
      id: entry.id,
      package: entry.package,
      path: relativePath,
      issues
    };
  });
}
async function removeJsonIfUnchanged(file, expected) {
  let handle;
  try {
    handle = await fs3.open(file, constants3.O_RDONLY | constants3.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || await handle.readFile("utf8") !== expected) {
      throw new Error("installed entity changed concurrently; refusing to remove it");
    }
    const current = await fs3.lstat(file);
    if (current.isSymbolicLink() || current.dev !== stat.dev || current.ino !== stat.ino) {
      throw new Error("installed entity path changed concurrently; refusing to remove it");
    }
    await fs3.rm(file);
  } finally {
    await handle?.close();
  }
}
async function addMacroEntity(workspaceRoot, packageId, raw, options = {}) {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, "add Macro entity", async () => {
    const config = await readConfig(workspaceRoot);
    assertCurrentWriteConfig(config, "snl-add-macro");
    const packages = await readAllMacroPackages(workspaceRoot);
    const issues = [];
    if (packageId === UNPACKAGED_PACKAGE_ID) {
      issues.push({
        severity: "error",
        code: "macro.system-package",
        message: "Macros cannot be added to the system _unpackaged Package.",
        path: "package"
      });
    } else if (!Object.prototype.hasOwnProperty.call(packages, packageId)) {
      issues.push({
        severity: "error",
        code: "macro.package-not-found",
        message: `Package ${JSON.stringify(packageId)} does not exist. Create it first with snl-add-package.`,
        path: "package"
      });
    }
    const current = usesCurrentEntitySchemas(config);
    const normalized = normalizeMacroDraft(raw, current);
    const name2 = isRecord5(normalized) && typeof normalized.name === "string" ? normalized.name : "";
    if (!name2 || /[@#$%\s()[\]{}]/u.test(name2)) {
      issues.push({
        severity: "error",
        code: "macro.bad-name",
        message: "Macro name must be non-empty and must not contain @, #, $, %, whitespace, parentheses, brackets, or braces.",
        path: "name"
      });
    }
    const macroBody = isRecord5(normalized) ? Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "name")) : normalized;
    const packageExists = Object.prototype.hasOwnProperty.call(packages, packageId);
    const synthetic = {
      version: current ? "11" : "8",
      name: packageExists ? packages[packageId].name : packageId,
      description: packageExists ? packages[packageId].description : "",
      macros: name2 ? { [name2]: macroBody } : {}
    };
    issues.push(...lintPackage(synthetic, { checkKatex: options.checkKatex !== false }).issues);
    if (packageExists && !effectiveActivePackageIds(config, packages).has(packageId)) {
      issues.push({
        severity: "info",
        code: "macro.package-inactive",
        message: `Package ${JSON.stringify(packageId)} is not active; the Macro is stored but will not resolve until the Package is activated.`,
        path: "package"
      });
    }
    if (name2 && packageExists && Object.prototype.hasOwnProperty.call(packages[packageId].macros, name2)) {
      return {
        status: "conflict",
        entity: "macro",
        code: "macro.duplicate-name",
        message: `Macro ${JSON.stringify(name2)} already exists in Package ${JSON.stringify(packageId)}.`
      };
    }
    if (issues.some((issue) => issue.severity === "error")) {
      return { status: "invalid", entity: "macro", issues };
    }
    const macro = normalized;
    const relativePath = macroEntityPath(packageId, macro.name);
    const envelope = {
      format: "snl-macro",
      version: MACRO_STORAGE_VERSION,
      ...current ? { schema_version: CURRENT_MACRO_SCHEMA_VERSION } : {},
      package: packageId,
      macro
    };
    try {
      await installNewJson(snlDocRoot(workspaceRoot), relativePath, envelope);
    } catch (error) {
      if (error.code === "EEXIST") {
        return {
          status: "conflict",
          entity: "macro",
          code: "macro.duplicate-name",
          message: `Macro ${JSON.stringify(macro.name)} already exists in Package ${JSON.stringify(packageId)}.`
        };
      }
      throw error;
    }
    return {
      status: "created",
      entity: "macro",
      name: macro.name,
      package: packageId,
      path: relativePath,
      issues
    };
  });
}
async function addPackageEntity(workspaceRoot, raw, options = {}) {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, "add Package manifest", async () => {
    const configFile = configPath(workspaceRoot);
    const originalConfig = await readRegularText(configFile);
    const config = JSON.parse(originalConfig.text);
    assertCurrentWriteConfig(config, "snl-add-package");
    const packages = await readAllMacroPackages(workspaceRoot);
    const issues = [];
    if (!isRecord5(raw)) {
      issues.push({ severity: "error", code: "package.not-object", message: "Package draft must be a JSON object." });
      return { status: "invalid", entity: "package", issues };
    }
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id || id === UNPACKAGED_PACKAGE_ID) {
      issues.push({
        severity: "error",
        code: "package.bad-id",
        message: "Package id must be a non-empty user Package ID and cannot be _unpackaged.",
        path: "id"
      });
    } else {
      try {
        assertPackageId(id);
      } catch (error) {
        issues.push({
          severity: "error",
          code: "package.bad-id",
          message: error instanceof Error ? error.message : String(error),
          path: "id"
        });
      }
    }
    const name2 = raw.name === void 0 ? id : typeof raw.name === "string" ? raw.name.trim() : raw.name;
    const description = raw.description === void 0 ? "" : typeof raw.description === "string" ? raw.description.trim() : raw.description;
    if (typeof name2 !== "string" || !name2) {
      issues.push({ severity: "error", code: "package.bad-name", message: "Package name must be a non-empty string.", path: "name" });
    }
    if (typeof description !== "string") {
      issues.push({ severity: "error", code: "package.bad-description", message: "Package description must be a string.", path: "description" });
    }
    const collision = Object.keys(packages).find((existing) => existing.toLowerCase() === id.toLowerCase());
    if (collision) {
      return {
        status: "conflict",
        entity: "package",
        code: "package.duplicate-id",
        message: `Package id ${JSON.stringify(id)} conflicts with existing Package ${JSON.stringify(collision)}.`
      };
    }
    if (issues.some((issue) => issue.severity === "error")) {
      return { status: "invalid", entity: "package", issues };
    }
    const manifest = {
      ...raw,
      format: "snl-package",
      version: PACKAGE_STORAGE_VERSION,
      ...usesCurrentEntitySchemas(config) ? { schema_version: CURRENT_PACKAGE_SCHEMA_VERSION, entry_ids: [] } : {},
      id,
      name: name2,
      description
    };
    const relativePath = packageManifestPath(id);
    await installNewJson(snlDocRoot(workspaceRoot), relativePath, manifest);
    const configRecord = config;
    const currentActive = effectiveActivePackageIds(configRecord, packages);
    const nextConfig = {
      ...configRecord,
      active_macro_packages: [.../* @__PURE__ */ new Set([...currentActive, id])].sort((left, right) => left.localeCompare(right))
    };
    try {
      if (options.beforeConfigInstall) await options.beforeConfigInstall();
      await replaceJsonIfUnchanged(configFile, originalConfig.text, nextConfig);
    } catch (error) {
      const manifestFile = path4.join(snlDocRoot(workspaceRoot), relativePath);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} The new Package manifest remains at ${manifestFile}. Its effective activation follows the unchanged config and it may already be active when active_macro_packages is omitted. Guarded failure handling intentionally does not unlink a live path because a non-cooperating writer could replace it between verification and deletion.`,
        { cause: error }
      );
    }
    return { status: "created", entity: "package", id, path: relativePath, active: true };
  });
}

// lib/entity-crud.ts
var ENTITY_TYPES2 = ["entry-kind", "macro-kind", "entry-package", "macro-package", "entry", "macro", "relationship", "library"];
var isRecord6 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var sha = (value) => createHash2("sha256").update(JSON.stringify(value)).digest("hex");
var compare = (a, b) => a.id.localeCompare(b.id);
function docRoot(root) {
  return path5.join(path5.resolve(root), ".SNL_Doc");
}
async function assertWorkspace(root) {
  const config = await readConfig(root);
  if (!usesEntityStorage(config))
    throw new Error("snl-entity requires current workspace data 0.0.6 per-entity storage.");
}
async function canonicalWriteWorkspace(root) {
  const resolved = path5.resolve(root);
  const real = await fs4.realpath(resolved);
  const stat = await fs4.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || real !== resolved)
    throw new Error(`Workspace root ${resolved} must be a canonical, non-symlink directory.`);
  const doc = path5.join(resolved, ".SNL_Doc");
  const docStat = await fs4.lstat(doc);
  if (!docStat.isDirectory() || docStat.isSymbolicLink() || await fs4.realpath(doc) !== path5.join(real, ".SNL_Doc"))
    throw new Error(`${doc} must be a canonical, non-symlink directory.`);
  return resolved;
}
async function readJson2(file) {
  return JSON.parse(await fs4.readFile(file, "utf8"));
}
async function jsonFiles(directory) {
  return (await fs4.readdir(directory, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => path5.join(directory, e.name)).sort();
}
function managed(type, id, value) {
  return { type, id, revision: sha(value), value };
}
function requireRecord(value, label) {
  if (!isRecord6(value))
    throw new Error(`${label} must be a JSON object.`);
  return value;
}
function requireId(value, field = "id") {
  if (typeof value[field] !== "string" || !value[field])
    throw new Error(`${field} must be a non-empty string.`);
  return value[field];
}
async function packageRows(root, type) {
  const rows = [];
  const doc = docRoot(root);
  for (const file of await jsonFiles(path5.join(doc, "packages"))) {
    const manifest = requireRecord(await readJson2(file), "Package manifest");
    if (manifest.format !== "snl-package" || manifest.version !== 1)
      throw new Error(`${file} is not a Package v1 manifest.`);
    const id = requireId(manifest);
    if (path5.relative(doc, file) !== packageManifestPath(id))
      throw new Error(`${file} does not match Package identity ${id}.`);
    if (type === "entry-package")
      rows.push(managed(type, id, manifest));
    else {
      const macros = /* @__PURE__ */ Object.create(null);
      for (const macroFile of await jsonFiles(path5.join(doc, "macros"))) {
        const envelope = requireRecord(await readJson2(macroFile), "Macro envelope");
        if (envelope.package !== id)
          continue;
        const macro = requireRecord(envelope.macro, "Macro payload");
        const name2 = requireId(macro, "name");
        macros[name2] = Object.fromEntries(Object.entries(macro).filter(([key]) => key !== "name"));
      }
      rows.push(managed(type, id, { ...manifest, macros }));
    }
  }
  return rows.sort(compare);
}
async function entryRows(root) {
  const rows = [];
  const doc = docRoot(root);
  for (const file of await jsonFiles(path5.join(doc, "entries"))) {
    const env = requireRecord(await readJson2(file), "Entry envelope");
    const value = requireRecord(env.entry, "Entry payload");
    const id = requireId(value);
    const pkg = typeof env.package === "string" ? env.package : "";
    if (path5.relative(doc, file) !== entryEntityPath(pkg, id))
      throw new Error(`${file} does not match Entry identity ${id}.`);
    rows.push(managed("entry", id, value));
  }
  return rows.sort(compare);
}
async function macroRows(root) {
  const rows = [];
  const doc = docRoot(root);
  for (const file of await jsonFiles(path5.join(doc, "macros"))) {
    const env = requireRecord(await readJson2(file), "Macro envelope");
    const value = requireRecord(env.macro, "Macro payload");
    const name2 = requireId(value, "name");
    const pkg = typeof env.package === "string" ? env.package : "";
    if (path5.relative(doc, file) !== macroEntityPath(pkg, name2))
      throw new Error(`${file} does not match Macro identity ${name2}.`);
    rows.push(managed("macro", `${pkg}::${name2}`, { package: pkg, ...value }));
  }
  return rows.sort(compare);
}
async function relationshipRows(root) {
  const file = path5.join(docRoot(root), "relationships.json");
  try {
    const data = requireRecord(await readJson2(file), "Relationships file");
    if (!Array.isArray(data.relationships))
      throw new Error("relationships.json#relationships must be an array.");
    return data.relationships.map((v) => {
      const value = requireRecord(v, "Relationship");
      return managed("relationship", requireId(value), value);
    }).sort(compare);
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function libraryRows(root) {
  const base = path5.join(docRoot(root), "libraries");
  const rows = [];
  let entries;
  try {
    entries = await fs4.readdir(base, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory())
      continue;
    const dir = path5.join(base, entry.name);
    const meta = requireRecord(await readJson2(path5.join(dir, "meta.json")), "Library meta");
    const graph = requireRecord(await readJson2(path5.join(dir, "graph.json")), "Library graph");
    let counters = { counters: [] };
    try {
      counters = requireRecord(await readJson2(path5.join(dir, "counters.json")), "Library counters");
    } catch (e) {
      if (e.code !== "ENOENT")
        throw e;
    }
    rows.push(managed("library", entry.name, { slug: entry.name, meta, graph, counters }));
  }
  return rows.sort(compare);
}
function isManagedEntityType(value) {
  return ENTITY_TYPES2.includes(value);
}
async function listManagedEntities(root, type) {
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind") {
    const config = await readConfig(root);
    const field = type === "entry-kind" ? "entry_kinds" : "macro_kinds";
    const values = config[field];
    if (!Array.isArray(values))
      throw new Error(`config.json#${field} must be an array.`);
    return values.map((v) => {
      const value = requireRecord(v, type);
      return managed(type, requireId(value), value);
    }).sort(compare);
  }
  if (type === "entry-package" || type === "macro-package")
    return packageRows(root, type);
  if (type === "entry")
    return entryRows(root);
  if (type === "macro")
    return macroRows(root);
  if (type === "relationship")
    return relationshipRows(root);
  return libraryRows(root);
}
async function getManagedEntity(root, type, id) {
  return (await listManagedEntities(root, type)).find((item) => item.id === id);
}
async function atomicWriteJson(file, value) {
  const directory = path5.dirname(file);
  const temp = path5.join(directory, `.${path5.basename(file)}.snl-entity-${process.pid}-${randomUUID3()}.tmp`);
  let handle;
  let mode = 420;
  try {
    mode = (await fs4.stat(file)).mode & 511;
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
  }
  try {
    handle = await fs4.open(temp, constants4.O_CREAT | constants4.O_EXCL | constants4.O_WRONLY, mode);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    await fs4.rename(temp, file);
    const dir = await fs4.open(directory, constants4.O_RDONLY);
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } finally {
    await handle?.close();
    await fs4.rm(temp, { force: true });
  }
}
function invalid(message) {
  return { status: "invalid", code: "entity.invalid", message };
}
function conflict(message) {
  return { status: "conflict", code: "entity.revision-conflict", message };
}
async function mutateConfigEntity(root, type, operation, id, input, ifMatch) {
  return withWorkspaceDataLock(root, `${operation} ${type}`, async () => {
    const file = path5.join(docRoot(root), "config.json");
    const config = requireRecord(await readJson2(file), "config.json");
    if (!usesEntityStorage(config))
      throw new Error("snl-entity requires current workspace data 0.0.6 per-entity storage.");
    const field = type === "entry-kind" ? "entry_kinds" : "macro_kinds";
    const values = config[field];
    if (!Array.isArray(values))
      throw new Error(`config.json#${field} must be an array.`);
    const index = values.findIndex((v) => isRecord6(v) && v.id === id);
    if (operation === "create") {
      const value2 = requireRecord(input, type);
      const problem2 = await validationMessage(root, type, value2);
      if (problem2)
        return invalid(problem2);
      const newId = requireId(value2);
      if (values.some((v) => isRecord6(v) && v.id === newId))
        return { status: "conflict", code: "entity.already-exists", message: `${type} ${JSON.stringify(newId)} already exists.` };
      const next = { ...config, [field]: [...values, value2] };
      await atomicWriteJson(file, next);
      return { status: "ok", operation, type, entity: managed(type, newId, value2) };
    }
    if (index < 0)
      return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` };
    const current = requireRecord(values[index], type);
    const currentEntity = managed(type, id, current);
    if (!ifMatch || ifMatch !== currentEntity.revision)
      return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
    if (operation === "delete") {
      const nextValues2 = values.filter((_, i) => i !== index);
      await atomicWriteJson(file, { ...config, [field]: nextValues2 });
      return { status: "ok", operation, type, entity: currentEntity };
    }
    const value = requireRecord(input, type);
    const problem = await validationMessage(root, type, value, id);
    if (problem)
      return invalid(problem);
    if (requireId(value) !== id)
      return invalid(`${type} identity is immutable: payload id must equal ${JSON.stringify(id)}.`);
    const nextValues = [...values];
    nextValues[index] = value;
    await atomicWriteJson(file, { ...config, [field]: nextValues });
    return { status: "ok", operation, type, entity: managed(type, id, value) };
  });
}
async function validationMessage(root, type, value, currentId) {
  const stringField = (field) => typeof value[field] === "string" && value[field] !== "";
  if (type === "entry-kind") {
    if (!stringField("id") || !stringField("name") || !isRecord6(value.coloring) || typeof value.style !== "string")
      return "Entry Kind requires non-empty id/name, coloring object, and string style.";
  } else if (type === "macro-kind") {
    if (!stringField("id") || !stringField("name") || typeof value.description !== "string" || !isRecord6(value.coloring))
      return "Macro Kind requires non-empty id/name, string description, and coloring object.";
  } else if (type === "entry-package" || type === "macro-package") {
    if (!stringField("id") || !stringField("name") || typeof value.description !== "string")
      return "Package requires non-empty id/name and string description.";
  } else if (type === "entry") {
    const issues = lintEntry(value, { entryKinds: await readEntryKinds(root), macros: await readActiveMacros(root), siblingEntries: (await readEntries(root)).filter((entry) => entry.id !== currentId) }).issues.filter((issue) => issue.severity === "error");
    if (issues.length)
      return issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    const packages = await packageRows(root, "entry-package");
    if (!packages.some((pkg) => pkg.id === value.package))
      return `Entry Package ${JSON.stringify(value.package)} does not exist.`;
  } else if (type === "macro") {
    const pkg = typeof value.package === "string" ? value.package : "";
    const name2 = typeof value.name === "string" ? value.name : "";
    const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package" && key !== "name"));
    const report = lintPackage({ version: "8", name: pkg, description: "", macros: name2 ? { [name2]: body } : {} }, { checkKatex: false });
    const errors = report.issues.filter((issue) => issue.severity === "error");
    if (!pkg || !name2 || errors.length)
      return !pkg || !name2 ? "Macro requires non-empty package and name." : errors.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    if (!(await packageRows(root, "entry-package")).some((row) => row.id === pkg))
      return `Macro Package ${JSON.stringify(pkg)} does not exist.`;
  } else if (type === "relationship") {
    if (!stringField("id") || !stringField("from") || !stringField("to") || !stringField("label"))
      return "Relationship requires non-empty id/from/to/label strings.";
  } else if (type === "library") {
    if (!stringField("slug") || !isRecord6(value.meta) || !isRecord6(value.graph) || !Array.isArray(value.graph.nodes) || !Array.isArray(value.graph.relationships) || !isRecord6(value.counters) || !Array.isArray(value.counters.counters))
      return "Library requires slug, meta, graph nodes/relationships, and counters.";
  }
  return void 0;
}
function identityFor(type, value) {
  if (type === "macro") {
    const pkg = typeof value.package === "string" ? value.package : "";
    return `${pkg}::${requireId(value, "name")}`;
  }
  if (type === "library")
    return requireId(value, "slug");
  return requireId(value);
}
async function createDirect(root, type, input) {
  const value = requireRecord(input, type);
  const problem = await validationMessage(root, type, value);
  if (problem)
    return invalid(problem);
  const id = identityFor(type, value);
  return withWorkspaceDataLock(root, `create ${type}`, async () => {
    if (await getManagedEntity(root, type, id))
      return { status: "conflict", code: "entity.already-exists", message: `${type} ${JSON.stringify(id)} already exists.` };
    if (type === "relationship") {
      const file = path5.join(docRoot(root), "relationships.json");
      let data = { version: 1, relationships: [] };
      try {
        data = requireRecord(await readJson2(file), "relationships.json");
      } catch (e) {
        if (e.code !== "ENOENT")
          throw e;
      }
      if (!Array.isArray(data.relationships))
        throw new Error("relationships.json#relationships must be an array.");
      await atomicWriteJson(file, { ...data, relationships: [...data.relationships, value] });
    } else {
      const dir = path5.join(docRoot(root), "libraries", id);
      if (path5.basename(id) !== id || id === "." || id === "..")
        return invalid("Library slug must be one safe path segment.");
      await fs4.mkdir(dir, { recursive: false });
      try {
        await atomicWriteJson(path5.join(dir, "meta.json"), requireRecord(value.meta, "Library meta"));
        await atomicWriteJson(path5.join(dir, "graph.json"), requireRecord(value.graph, "Library graph"));
        await atomicWriteJson(path5.join(dir, "counters.json"), requireRecord(value.counters, "Library counters"));
      } catch (e) {
        await fs4.rm(dir, { recursive: true, force: true });
        throw e;
      }
    }
    const entity = await getManagedEntity(root, type, id);
    if (!entity)
      throw new Error(`Created ${type} could not be read back.`);
    return { status: "ok", operation: "create", type, entity };
  });
}
async function createManagedEntity(root, type, input) {
  root = await canonicalWriteWorkspace(root);
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "create", void 0, input);
  if (type === "entry-package" || type === "macro-package") {
    const result = await addPackageEntity(root, input);
    if (result.status !== "created")
      return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map((i) => `${i.code}: ${i.message}`).join("; "));
    const entity = await getManagedEntity(root, type, result.id);
    if (!entity)
      throw new Error("Created Package could not be read back.");
    return { status: "ok", operation: "create", type, entity };
  }
  if (type === "entry") {
    const result = await addEntryEntity(root, input);
    if (result.status !== "created")
      return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map((i) => `${i.code}: ${i.message}`).join("; "));
    const entity = await getManagedEntity(root, type, result.id);
    if (!entity)
      throw new Error("Created Entry could not be read back.");
    return { status: "ok", operation: "create", type, entity };
  }
  if (type === "macro") {
    const value = requireRecord(input, "Macro");
    const pkg = typeof value.package === "string" ? value.package : "";
    const draft = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package"));
    const result = await addMacroEntity(root, pkg, draft);
    if (result.status !== "created")
      return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map((i) => `${i.code}: ${i.message}`).join("; "));
    const id = `${pkg}::${result.name}`;
    const entity = await getManagedEntity(root, type, id);
    if (!entity)
      throw new Error("Created Macro could not be read back.");
    return { status: "ok", operation: "create", type, entity };
  }
  return createDirect(root, type, input);
}
async function locateFile(root, type, entity) {
  const doc = docRoot(root);
  if (type === "entry-package" || type === "macro-package")
    return path5.join(doc, packageManifestPath(entity.id));
  if (type === "entry") {
    const pkg = typeof entity.value.package === "string" ? entity.value.package : "";
    return path5.join(doc, entryEntityPath(pkg, entity.id));
  }
  if (type === "macro") {
    const split = entity.id.indexOf("::");
    return path5.join(doc, macroEntityPath(entity.id.slice(0, split), entity.id.slice(split + 2)));
  }
  throw new Error(`No entity file for ${type}.`);
}
async function mutateDirect(root, type, operation, id, input, ifMatch) {
  return withWorkspaceDataLock(root, `${operation} ${type}`, async () => {
    const current = await getManagedEntity(root, type, id);
    if (!current)
      return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` };
    if (current.revision !== ifMatch)
      return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
    if (operation === "update") {
      const value = requireRecord(input, type);
      const problem = await validationMessage(root, type, value, id);
      if (problem)
        return invalid(problem);
      if (identityFor(type, value) !== id)
        return invalid(`${type} identity is immutable: payload identity must equal ${JSON.stringify(id)}.`);
      if (type === "relationship") {
        const file = path5.join(docRoot(root), "relationships.json");
        const data = requireRecord(await readJson2(file), "relationships.json");
        const values = data.relationships;
        if (!Array.isArray(values))
          throw new Error("relationships.json#relationships must be an array.");
        await atomicWriteJson(file, { ...data, relationships: values.map((row) => isRecord6(row) && row.id === id ? value : row) });
      } else if (type === "library") {
        const dir = path5.join(docRoot(root), "libraries", id);
        await atomicWriteJson(path5.join(dir, "meta.json"), requireRecord(value.meta, "Library meta"));
        await atomicWriteJson(path5.join(dir, "graph.json"), requireRecord(value.graph, "Library graph"));
        await atomicWriteJson(path5.join(dir, "counters.json"), requireRecord(value.counters, "Library counters"));
      } else {
        const file = await locateFile(root, type, current);
        if (type === "entry-package" || type === "macro-package") {
          const manifest = { ...value, format: "snl-package", version: 1 };
          delete manifest.macros;
          await atomicWriteJson(file, manifest);
        } else if (type === "entry") {
          await atomicWriteJson(file, { format: "snl-entry", version: 1, package: value.package, entry: value });
        } else {
          const split = id.indexOf("::");
          const pkg = id.slice(0, split);
          const macro = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package"));
          await atomicWriteJson(file, { format: "snl-macro", version: 1, package: pkg, macro });
        }
      }
      const entity = await getManagedEntity(root, type, id);
      if (!entity)
        throw new Error(`Updated ${type} could not be read back.`);
      return { status: "ok", operation, type, entity };
    }
    if (type === "entry") {
      const references = (await findEntityReferences(root, "entry", id)).filter((occurrence2) => occurrence2.role === "reference");
      if (references.length)
        return { status: "conflict", code: "entity.referenced", message: `Entry ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
      await fs4.unlink(await locateFile(root, type, current));
    } else if (type === "macro") {
      const name2 = id.slice(id.indexOf("::") + 2);
      const references = (await findEntityReferences(root, "macro", name2)).filter((occurrence2) => occurrence2.role === "reference");
      if (references.length)
        return { status: "conflict", code: "entity.referenced", message: `Macro ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
      await fs4.unlink(await locateFile(root, type, current));
    } else if (type === "relationship") {
      const file = path5.join(docRoot(root), "relationships.json");
      const data = requireRecord(await readJson2(file), "relationships.json");
      const values = data.relationships;
      if (!Array.isArray(values))
        throw new Error("relationships.json#relationships must be an array.");
      await atomicWriteJson(file, { ...data, relationships: values.filter((row) => !(isRecord6(row) && row.id === id)) });
    } else if (type === "library") {
      const dir = path5.join(docRoot(root), "libraries", id);
      const tomb = path5.join(path5.dirname(dir), `.${id}.snl-entity-${randomUUID3()}.deleted`);
      await fs4.rename(dir, tomb);
      await fs4.rm(tomb, { recursive: true });
    } else if (type === "entry-package" || type === "macro-package") {
      if (id === "_unpackaged")
        return invalid("The system _unpackaged Package cannot be deleted.");
      const entries = await entryRows(root);
      const macros = await macroRows(root);
      if (entries.some((e) => e.value.package === id) || macros.some((m) => m.value.package === id))
        return { status: "conflict", code: "package.not-empty", message: `Package ${JSON.stringify(id)} still contains entities.` };
      const file = await locateFile(root, type, current);
      await fs4.unlink(file);
      const configFile = path5.join(docRoot(root), "config.json");
      const config = requireRecord(await readJson2(configFile), "config.json");
      if (Array.isArray(config.active_macro_packages))
        await atomicWriteJson(configFile, { ...config, active_macro_packages: config.active_macro_packages.filter((v) => v !== id) });
    } else
      await fs4.unlink(await locateFile(root, type, current));
    return { status: "ok", operation, type, entity: current };
  });
}
async function updateManagedEntity(root, type, id, input, ifMatch) {
  root = await canonicalWriteWorkspace(root);
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "update", id, input, ifMatch);
  return mutateDirect(root, type, "update", id, input, ifMatch);
}
async function deleteManagedEntity(root, type, id, ifMatch) {
  root = await canonicalWriteWorkspace(root);
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "delete", id, void 0, ifMatch);
  return mutateDirect(root, type, "delete", id, void 0, ifMatch);
}

// plugin-src/entity-adapter.ts
function typeOf(value) {
  if (!isManagedEntityType(value)) throw new TypeError(`Unsupported SNL entity type: ${value}`);
  return value;
}
function queryText(value) {
  return JSON.stringify(value).toLocaleLowerCase();
}
function createEntityAdapter() {
  return {
    async list(request) {
      const type = typeOf(request.entityType);
      let entities = await listManagedEntities(request.root, type);
      if (request.query) {
        const needle = request.query.toLocaleLowerCase();
        entities = entities.filter((entity) => entity.id.toLocaleLowerCase().includes(needle) || queryText(entity.value).includes(needle));
      }
      if (request.cursor) entities = entities.filter((entity) => entity.id.localeCompare(request.cursor) > 0);
      const limit = request.limit ?? 100;
      const page = entities.slice(0, limit);
      return {
        entities: page,
        nextCursor: entities.length > page.length ? page.at(-1)?.id ?? null : null
      };
    },
    async get(request) {
      const entity = await getManagedEntity(request.root, typeOf(request.entityType), request.id);
      if (!entity) return { status: "not-found", code: "entity.not-found", message: `${request.entityType} ${JSON.stringify(request.id)} does not exist.` };
      return { entity, revision: entity.revision };
    },
    async apply(request) {
      const type = typeOf(request.entityType);
      if (request.action === "create") {
        if (!request.value) return { status: "invalid", code: "entity.value-required", message: "create requires value." };
        return createManagedEntity(request.root, type, request.value);
      }
      if (!request.id) return { status: "invalid", code: "entity.id-required", message: `${request.action} requires id.` };
      if (!request.expectedRevision) {
        return { status: "invalid", code: "entity.revision-required", message: `${request.action} requires expectedRevision from snl_entity_get.` };
      }
      return request.action === "update" ? updateManagedEntity(request.root, type, request.id, request.value, request.expectedRevision) : deleteManagedEntity(request.root, type, request.id, request.expectedRevision);
    },
    async validate({ root }) {
      const counts = /* @__PURE__ */ Object.create(null);
      for (const type of ENTITY_TYPES2) counts[type] = (await listManagedEntities(root, type)).length;
      return { valid: true, counts, issues: [] };
    }
  };
}

// plugin-src/mcp-server.ts
async function loadEntityAdapter(specifier = process.env.SNL_ENTITY_ADAPTER_MODULE) {
  if (!specifier) return createEntityAdapter();
  const url = specifier.startsWith("file:") || specifier.startsWith("data:") || specifier.startsWith("node:") ? specifier : pathToFileURL(resolve4(specifier)).href;
  const loaded = await import(url);
  const candidate = loaded.createEntityAdapter ? await loaded.createEntityAdapter() : typeof loaded.default === "function" ? await loaded.default() : loaded.default;
  if (!candidate || !["list", "get", "apply", "validate"].every((name2) => typeof candidate[name2] === "function")) {
    throw new Error("SNL entity adapter module must export createEntityAdapter() or a default adapter with list/get/apply/validate methods");
  }
  return candidate;
}

// plugin-src/dsh-adapter.ts
var name = "snl-agent-toolkit";
var inject = ["tools"];
function isRecord7(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function toDshValueSchema(raw) {
  if (!isRecord7(raw)) throw new TypeError("tool schema property must be an object");
  const description = typeof raw.description === "string" ? { description: raw.description } : {};
  const enumeration = Array.isArray(raw.enum) ? { enum: raw.enum } : {};
  switch (raw.type) {
    case "string":
      return { type: "string", ...description, ...enumeration };
    case "integer":
      return { type: "integer", ...description };
    case "number":
      return { type: "number", ...description };
    case "boolean":
      return { type: "boolean", ...description };
    case "array":
      return {
        type: "array",
        ...description,
        ...raw.items !== void 0 ? { items: toDshValueSchema(raw.items) } : {}
      };
    case "object":
      return { type: "object", additionalProperties: true, ...description };
    default:
      throw new TypeError(`unsupported DeepSeek Harness tool schema type: ${String(raw.type)}`);
  }
}
function toDshParameters(inputSchema) {
  if (inputSchema.type !== "object" || !isRecord7(inputSchema.properties)) {
    throw new TypeError("tool input schema must be an object schema with properties");
  }
  const required = new Set(Array.isArray(inputSchema.required) ? inputSchema.required : []);
  return Object.fromEntries(
    Object.entries(inputSchema.properties).map(([key, schema]) => {
      const property = {
        ...toDshValueSchema(schema),
        ...required.has(key) ? { required: true } : {}
      };
      return [key, property];
    })
  );
}
async function apply(ctx, config = {}) {
  const adapter = config.adapter ?? await loadEntityAdapter(config.adapterModule);
  for (const tool of createToolkitTools(adapter)) {
    ctx.tools.register(defineTool({
      name: tool.name,
      description: tool.description,
      parameters: toDshParameters(tool.inputSchema),
      output: {
        schema: { type: "json" },
        render(_args, value) {
          return [{ type: "text", text: JSON.stringify(value, null, 2) }];
        }
      },
      async execute(args, exec) {
        exec.signal.throwIfAborted();
        const value = await tool.execute(args);
        exec.signal.throwIfAborted();
        return value;
      }
    }));
  }
}
export {
  apply,
  inject,
  name
};
