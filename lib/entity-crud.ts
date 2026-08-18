import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { CURRENT_ENTRY_SCHEMA_VERSION, CURRENT_MACRO_SCHEMA_VERSION, CURRENT_PACKAGE_SCHEMA_VERSION, ENTRY_STORAGE_VERSION, MACRO_STORAGE_VERSION, PACKAGE_STORAGE_VERSION, packageManifestPath, entryEntityPath, macroEntityPath } from "./entity-storage.ts";
import { assertCurrentKindCatalogs, readActiveMacros, readAllMacroPackages, readConfig, readEntries, readEntryKinds, usesCurrentEntitySchemas, usesEntityStorage } from "./snl-doc.ts";
import type { SnlConfig } from "./snl-doc-schema.ts";
import { lintEntry } from "./lint-entry.ts";
import { lintPackage } from "./lint-package.ts";
import { lintGraph } from "./lint-graph.ts";
import { findEntityReferences } from "./entity-references.ts";
import { withWorkspaceDataLock } from "./workspace-data-lock.ts";
import { addEntryEntity, addMacroEntity, addPackageEntity } from "./entity-writes.ts";
import { installNewJson, jsonText, readRegularText, removeJsonIfUnchanged, replaceJsonIfUnchanged } from "./guarded-json-file.ts";
export const ENTITY_TYPES = ["entry-kind", "macro-kind", "entry-package", "macro-package", "entry", "macro", "relationship", "library"] as const;
export type ManagedEntityType = typeof ENTITY_TYPES[number];
export interface ManagedEntity {
    type: ManagedEntityType;
    id: string;
    revision: string;
    value: Record<string, unknown>;
}
export type EntityMutationResult = {
    status: "ok";
    operation: "create" | "update" | "delete";
    type: ManagedEntityType;
    entity: ManagedEntity;
} | {
    status: "conflict" | "not-found" | "invalid";
    code: string;
    message: string;
};
type RecordJson = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordJson => !!value && typeof value === "object" && !Array.isArray(value);
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const compare = (a: ManagedEntity, b: ManagedEntity) => a.id.localeCompare(b.id);
function docRoot(root: string) { return path.join(path.resolve(root), ".SNL_Doc"); }
async function assertWorkspace(root: string) { const config = await readConfig(root); if (!usesEntityStorage(config))
    throw new Error("snl-entity requires current workspace data 0.0.6 per-entity storage."); }
async function canonicalWriteWorkspace(root: string): Promise<string> { const resolved = path.resolve(root); const real = await fs.realpath(resolved); const stat = await fs.lstat(resolved); if (!stat.isDirectory() || stat.isSymbolicLink() || real !== resolved)
    throw new Error(`Workspace root ${resolved} must be a canonical, non-symlink directory.`); const doc = path.join(resolved, ".SNL_Doc"); const docStat = await fs.lstat(doc); if (!docStat.isDirectory() || docStat.isSymbolicLink() || await fs.realpath(doc) !== path.join(real, ".SNL_Doc"))
    throw new Error(`${doc} must be a canonical, non-symlink directory.`); return resolved; }
async function readJson(file: string): Promise<unknown> { return JSON.parse(await fs.readFile(file, "utf8")); }
async function jsonFiles(directory: string): Promise<string[]> { return (await fs.readdir(directory, { withFileTypes: true })).filter(e => e.isFile() && e.name.endsWith(".json")).map(e => path.join(directory, e.name)).sort(); }
function managed(type: ManagedEntityType, id: string, value: RecordJson, revisionSource: unknown = value): ManagedEntity { return { type, id, revision: sha(revisionSource), value }; }
function requireRecord(value: unknown, label: string): RecordJson { if (!isRecord(value))
    throw new Error(`${label} must be a JSON object.`); return value; }
type DirectoryIdentity = { dev: number; ino: number };
async function readDirectoryIdentity(directory: string): Promise<DirectoryIdentity> {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new Error(`${directory} must be a regular, non-symlink directory.`);
    return { dev: stat.dev, ino: stat.ino };
}
async function assertDirectoryIdentity(directory: string, expected: DirectoryIdentity): Promise<void> {
    const observed = await readDirectoryIdentity(directory);
    if (observed.dev !== expected.dev || observed.ino !== expected.ino)
        throw new Error(`${directory} changed concurrently; refusing to access a replacement directory.`);
}
async function syncDirectoryDurably(
    directory: string,
    beforeSync?: () => void | Promise<void>,
    expected?: { dev: number; ino: number },
): Promise<void> {
    await beforeSync?.();
    if (expected) await assertDirectoryIdentity(directory, expected);
    const handle = await fs.open(directory, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
    try {
        const stat = await handle.stat();
        if (expected && (stat.dev !== expected.dev || stat.ino !== expected.ino))
            throw new Error(`${directory} changed concurrently before directory sync.`);
        await handle.sync();
        if (expected) await assertDirectoryIdentity(directory, expected);
    }
    finally { await handle.close(); }
}

async function restoreCapturedDirectory(
    captured: string,
    target: string,
    hooks: { beforeInstall?: () => void | Promise<void>; afterReservationCheckBeforeCopy?: () => void | Promise<void>; beforeSync?: () => void | Promise<void> } = {},
): Promise<void> {
    const parent = path.dirname(target);
    const parentIdentity = await readDirectoryIdentity(parent);
    try {
        // Reserve the absent canonical name without replacing anything a
        // concurrent writer may have created there.
        await fs.mkdir(target);
    }
    catch (error) {
        throw new Error(`${target} could not be restored without overwriting a concurrent replacement; captured directory remains at ${captured}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    const reservation = await readDirectoryIdentity(target);
    await hooks.beforeInstall?.();
    try {
        await assertDirectoryIdentity(parent, parentIdentity);
        await assertDirectoryIdentity(target, reservation);
        const targetHandle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
        try {
            const targetStat = await targetHandle.stat();
            if (targetStat.dev !== reservation.dev || targetStat.ino !== reservation.ino)
                throw new Error(`${target} changed concurrently before restoration copy.`);
            if (process.platform !== "linux")
                throw new Error("Safe descriptor-relative Library restoration is unavailable on this platform.");
            const pinnedTarget = `/proc/self/fd/${targetHandle.fd}`;
            await hooks.afterReservationCheckBeforeCopy?.();
            for (const name of await fs.readdir(captured)) {
                await fs.cp(path.join(captured, name), path.join(pinnedTarget, name), { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true, verbatimSymlinks: true });
            }
            await targetHandle.sync();
        }
        finally { await targetHandle.close(); }
        await assertDirectoryIdentity(parent, parentIdentity);
        await assertDirectoryIdentity(target, reservation);
        await syncDirectoryDurably(parent, hooks.beforeSync, parentIdentity);
        await assertDirectoryIdentity(parent, parentIdentity);
        await assertDirectoryIdentity(target, reservation);
        // Keep the hidden captured tree as a recovery copy. Recursively deleting
        // it would re-open a late-arriving-data race through an outstanding dirfd.
    }
    catch (error) {
        try {
            await assertDirectoryIdentity(target, reservation);
            await fs.rmdir(target);
        }
        catch { /* Preserve a concurrent replacement or a partial recovery tree. */ }
        throw new Error(`${target} could not be restored without touching a concurrent replacement; captured directory remains at ${captured}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}
function requireId(value: RecordJson, field = "id"): string { if (typeof value[field] !== "string" || !value[field])
    throw new Error(`${field} must be a non-empty string.`); return value[field] as string; }
async function packageRows(root: string, type: "entry-package" | "macro-package"): Promise<ManagedEntity[]> {
    // The public SNL readers own schema-marker, payload-version, topology, and
    // exact Package-membership validation. CRUD must not maintain a laxer copy.
    await readEntries(root);
    const macroPackages = type === "macro-package" ? await readAllMacroPackages(root) : undefined;
    const rows: ManagedEntity[] = [];
    const doc = docRoot(root);
    for (const file of await jsonFiles(path.join(doc, "packages"))) {
        const manifest = requireRecord(await readJson(file), "Package manifest");
        const id = requireId(manifest);
        if (path.relative(doc, file) !== packageManifestPath(id))
            throw new Error(`${file} does not match Package identity ${id}.`);
        if (type === "entry-package")
            rows.push(managed(type, id, manifest));
        else {
            const authoritative = macroPackages?.[id];
            if (!authoritative)
                throw new Error(`Package ${JSON.stringify(id)} was not returned by the authoritative Macro reader.`);
            rows.push(managed(type, id, { ...manifest, macros: authoritative.macros }));
        }
    }
    return rows.sort(compare);
}
export interface EntityReadOptions {
    afterAuthoritativeRead?: (type: "entry" | "macro") => void | Promise<void>;
}
async function entryRows(root: string, options: EntityReadOptions = {}): Promise<ManagedEntity[]> {
    const rows: ManagedEntity[] = [];
    const doc = docRoot(root);
    const values = await readEntries(root);
    await options.afterAuthoritativeRead?.("entry");
    for (const value of values) {
        const persisted = await readRegularText(path.join(doc, entryEntityPath(value.package ?? "", value.id)));
        const envelope = requireRecord(JSON.parse(persisted.text), "Entry envelope");
        if (!isRecord(envelope.entry) || sha(envelope.entry) !== sha(value))
            throw new Error(`Entry ${JSON.stringify(value.id)} changed concurrently while listing; retry.`);
        rows.push(managed("entry", value.id, value as unknown as RecordJson, envelope));
    }
    return rows.sort(compare);
}
async function macroRows(root: string, options: EntityReadOptions = {}): Promise<ManagedEntity[]> {
    const rows: ManagedEntity[] = [];
    const doc = docRoot(root);
    const packages = await readAllMacroPackages(root);
    await options.afterAuthoritativeRead?.("macro");
    for (const [pkg, macroPackage] of Object.entries(packages)) {
        for (const [name, body] of Object.entries(macroPackage.macros)) {
            const persisted = await readRegularText(path.join(doc, macroEntityPath(pkg, name)));
            const envelope = requireRecord(JSON.parse(persisted.text), "Macro envelope");
            const persistedMacro = isRecord(envelope.macro) ? envelope.macro : undefined;
            const persistedBody = persistedMacro
                ? Object.fromEntries(Object.entries(persistedMacro).filter(([key]) => key !== "name"))
                : undefined;
            if (envelope.package !== pkg || !persistedMacro || !persistedBody || persistedMacro.name !== name || sha(persistedBody) !== sha(body))
                throw new Error(`Macro ${JSON.stringify(`${pkg}::${name}`)} changed concurrently while listing; retry.`);
            rows.push(managed("macro", `${pkg}::${name}`, { package: pkg, name, ...body }, envelope));
        }
    }
    return rows.sort(compare);
}
async function relationshipRows(root: string): Promise<ManagedEntity[]> { const file = path.join(docRoot(root), "relationships.json"); try {
    const data = requireRecord(JSON.parse((await readRegularText(file)).text), "Relationships file");
    if (!Array.isArray(data.relationships))
        throw new Error("relationships.json#relationships must be an array.");
    const ids = new Set<string>();
    return data.relationships.map(v => {
        const value = requireRecord(v, "Relationship");
        const id = requireId(value);
        if (ids.has(id)) throw new Error(`relationships.json contains duplicate id ${JSON.stringify(id)}.`);
        ids.add(id);
        return managed("relationship", id, value);
    }).sort(compare);
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return [];
    throw e;
} }
async function libraryExtraNames(dir: string): Promise<string[]> {
    const owned = new Set(["meta.json", "graph.json", "counters.json"]);
    return (await fs.readdir(dir)).filter(name => !owned.has(name)).sort((a, b) => a.localeCompare(b));
}
async function readLibraryDirectoryValue(dir: string, slug: string): Promise<RecordJson> {
    const meta = requireRecord(JSON.parse((await readRegularText(path.join(dir, "meta.json"))).text), "Library meta");
    const graph = requireRecord(JSON.parse((await readRegularText(path.join(dir, "graph.json"))).text), "Library graph");
    let counters: RecordJson = { counters: [] };
    try {
        counters = requireRecord(JSON.parse((await readRegularText(path.join(dir, "counters.json"))).text), "Library counters");
    }
    catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return { slug, meta, graph, counters };
}
async function libraryRows(root: string): Promise<ManagedEntity[]> { const base = path.join(docRoot(root), "libraries"); const rows: ManagedEntity[] = []; let entries; try {
    const baseStat = await fs.lstat(base);
    if (!baseStat.isDirectory() || baseStat.isSymbolicLink())
        throw new Error(`${base} must be a regular, non-symlink Library directory.`);
    entries = await fs.readdir(base, { withFileTypes: true });
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return [];
    throw e;
} for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name === ".gitkeep") continue;
    if (entry.isSymbolicLink() || !entry.isDirectory())
        throw new Error(`${path.join(base, entry.name)} must be a regular, non-symlink Library directory.`);
    const dir = path.join(base, entry.name);
    rows.push(managed("library", entry.name, await readLibraryDirectoryValue(dir, entry.name)));
} return rows.sort(compare); }
export function isManagedEntityType(value: string): value is ManagedEntityType { return (ENTITY_TYPES as readonly string[]).includes(value); }
export async function listManagedEntities(root: string, type: ManagedEntityType, options: EntityReadOptions = {}): Promise<ManagedEntity[]> {
    await assertWorkspace(root);
    if (type === "entry-kind" || type === "macro-kind") {
        const config = await readConfig(root) as unknown as RecordJson;
        const field = type === "entry-kind" ? "entry_kinds" : "macro_kinds";
        const values = config[field];
        if (!Array.isArray(values))
            throw new Error(`config.json#${field} must be an array.`);
        return values.map(v => { const value = requireRecord(v, type); return managed(type, requireId(value), value); }).sort(compare);
    }
    if (type === "entry-package" || type === "macro-package")
        return packageRows(root, type);
    if (type === "entry")
        return entryRows(root, options);
    if (type === "macro")
        return macroRows(root, options);
    if (type === "relationship")
        return relationshipRows(root);
    return libraryRows(root);
}
export async function validateManagedWorkspace(root: string): Promise<{
    valid: boolean;
    counts: Record<string, number>;
    issues: Array<{ severity: "error" | "warning" | "info"; code: string; message: string; path?: string }>;
}> {
    const counts: Record<string, number> = Object.create(null) as Record<string, number>;
    const rows = new Map<ManagedEntityType, ManagedEntity[]>();
    for (const type of ENTITY_TYPES) {
        const entities = await listManagedEntities(root, type);
        rows.set(type, entities);
        counts[type] = entities.length;
    }
    const entries = await readEntries(root);
    const entryIds = new Set(entries.map(entry => entry.id));
    const issues: Array<{ severity: "error" | "warning" | "info"; code: string; message: string; path?: string }> = [];
    for (const relationship of rows.get("relationship") ?? []) {
        const from = relationship.value.from;
        const to = relationship.value.to;
        if (typeof from === "string" && !entryIds.has(from))
            issues.push({ severity: "error", code: "relationship.dangling-from", message: `Relationship ${relationship.id} references missing Entry ${from}.`, path: `relationship:${relationship.id}.from` });
        if (typeof to === "string" && !entryIds.has(to))
            issues.push({ severity: "error", code: "relationship.dangling-to", message: `Relationship ${relationship.id} references missing Entry ${to}.`, path: `relationship:${relationship.id}.to` });
    }
    for (const library of rows.get("library") ?? []) {
        for (const issue of lintGraph(library.value.graph, { poolEntries: entries }).issues) {
            issues.push({ ...issue, path: `library:${library.id}/graph.json${issue.path ? `#${issue.path}` : ""}` });
        }
    }
    return { valid: !issues.some(issue => issue.severity === "error"), counts, issues };
}

export async function getManagedEntity(root: string, type: ManagedEntityType, id: string): Promise<ManagedEntity | undefined> { return (await listManagedEntities(root, type)).find(item => item.id === id); }
function invalid(message: string): EntityMutationResult { return { status: "invalid", code: "entity.invalid", message }; }
function conflict(message: string): EntityMutationResult { return { status: "conflict", code: "entity.revision-conflict", message }; }
function currentKindCatalogProblem(config: RecordJson, next: RecordJson): string | undefined {
    if (!usesCurrentEntitySchemas(config)) return undefined;
    try { assertCurrentKindCatalogs(next as unknown as SnlConfig); return undefined; }
    catch (error) { return error instanceof Error ? error.message : String(error); }
}
async function mutateConfigEntity(root: string, type: "entry-kind" | "macro-kind", operation: "create" | "update" | "delete", id: string | undefined, input: unknown, ifMatch?: string): Promise<EntityMutationResult> {
    return withWorkspaceDataLock(root, `${operation} ${type}`, async () => { const file = path.join(docRoot(root), "config.json"); const originalConfig = await readRegularText(file); const config = requireRecord(JSON.parse(originalConfig.text), "config.json"); if (!usesEntityStorage(config))
        throw new Error("snl-entity requires current workspace data 0.0.6 per-entity storage."); const field = type === "entry-kind" ? "entry_kinds" : "macro_kinds"; const values = config[field]; if (!Array.isArray(values))
        throw new Error(`config.json#${field} must be an array.`); const index = values.findIndex(v => isRecord(v) && v.id === id); if (operation === "create") {
        const value = requireRecord(input, type);
        const problem = await validationMessage(root, type, value);
        if (problem)
            return invalid(problem);
        const newId = requireId(value);
        if (values.some(v => isRecord(v) && v.id === newId))
            return { status: "conflict", code: "entity.already-exists", message: `${type} ${JSON.stringify(newId)} already exists.` };
        const next = { ...config, [field]: [...values, value] };
        const catalogProblem = currentKindCatalogProblem(config, next);
        if (catalogProblem) return invalid(catalogProblem);
        await replaceJsonIfUnchanged(file, originalConfig.text, next);
        return { status: "ok", operation, type, entity: managed(type, newId, value) };
    } if (index < 0)
        return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` }; const current = requireRecord(values[index], type); const currentEntity = managed(type, id!, current); if (!ifMatch || ifMatch !== currentEntity.revision)
        return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`); if (operation === "delete") {
        if (type === "entry-kind" && (await readEntries(root)).some(entry => entry.kind === id))
            return { status: "conflict", code: "entity.referenced", message: `Entry Kind ${JSON.stringify(id)} is still used by Entries.` };
        if (type === "macro-kind") {
            const packages = await readAllMacroPackages(root);
            if (Object.values(packages).some(pkg => Object.values(pkg.macros).some(macro => macro.kind === id)))
                return { status: "conflict", code: "entity.referenced", message: `Macro Kind ${JSON.stringify(id)} is still used by Macros.` };
        }
        const nextValues = values.filter((_, i) => i !== index);
        const next = { ...config, [field]: nextValues };
        const catalogProblem = currentKindCatalogProblem(config, next);
        if (catalogProblem) return invalid(catalogProblem);
        await replaceJsonIfUnchanged(file, originalConfig.text, next);
        return { status: "ok", operation, type, entity: currentEntity };
    } const value = requireRecord(input, type); const problem = await validationMessage(root, type, value, id); if (problem)
        return invalid(problem); if (requireId(value) !== id)
        return invalid(`${type} identity is immutable: payload id must equal ${JSON.stringify(id)}.`); const nextValues = [...values]; nextValues[index] = value; const next = { ...config, [field]: nextValues }; const catalogProblem = currentKindCatalogProblem(config, next); if (catalogProblem) return invalid(catalogProblem); await replaceJsonIfUnchanged(file, originalConfig.text, next); return { status: "ok", operation, type, entity: managed(type, id!, value) }; });
}
async function validationMessage(root: string, type: ManagedEntityType, value: RecordJson, currentId?: string): Promise<string | undefined> {
    const stringField = (field: string) => typeof value[field] === "string" && value[field] !== "";
    if (type === "entry-kind") {
        if (!stringField("id") || !(typeof value.name === "string" || isRecord(value.name)) || !isRecord(value.coloring) || typeof value.style !== "string")
            return "Entry Kind requires non-empty id/name, coloring object, and string style.";
    }
    else if (type === "macro-kind") {
        if (!stringField("id") || !stringField("name") || typeof value.description !== "string" || !isRecord(value.coloring))
            return "Macro Kind requires non-empty id/name, string description, and coloring object.";
    }
    else if (type === "entry-package" || type === "macro-package") {
        if (!stringField("id") || !stringField("name") || typeof value.description !== "string")
            return "Package requires non-empty id/name and string description.";
    }
    else if (type === "entry") {
        const issues = lintEntry(value, { entryKinds: await readEntryKinds(root), macros: await readActiveMacros(root), siblingEntries: (await readEntries(root)).filter(entry => entry.id !== currentId) }).issues.filter(issue => issue.severity === "error");
        if (issues.length)
            return issues.map(issue => `${issue.code}: ${issue.message}`).join("; ");
        const packages = await packageRows(root, "entry-package");
        if (!packages.some(pkg => pkg.id === value.package))
            return `Entry Package ${JSON.stringify(value.package)} does not exist.`;
    }
    else if (type === "macro") {
        const pkg = typeof value.package === "string" ? value.package : "";
        const name = typeof value.name === "string" ? value.name : "";
        const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package" && key !== "name"));
        const current = usesCurrentEntitySchemas(await readConfig(root));
        const report = lintPackage({ version: current ? "11" : "8", name: pkg, description: "", macros: name ? { [name]: body } : {} }, { checkKatex: false });
        const errors = report.issues.filter(issue => issue.severity === "error");
        if (!pkg || !name || errors.length)
            return !pkg || !name ? "Macro requires non-empty package and name." : errors.map(issue => `${issue.code}: ${issue.message}`).join("; ");
        if (!(await packageRows(root, "macro-package")).some(row => row.id === pkg))
            return `Macro Package ${JSON.stringify(pkg)} does not exist.`;
    }
    else if (type === "relationship") {
        if (!stringField("id") || !stringField("from") || !stringField("to") || !stringField("label"))
            return "Relationship requires non-empty id/from/to/label strings.";
        const entryIds = new Set((await readEntries(root)).map(entry => entry.id));
        if (!entryIds.has(value.from as string) || !entryIds.has(value.to as string))
            return `Relationship endpoints must resolve to existing Entries; got ${JSON.stringify(value.from)} -> ${JSON.stringify(value.to)}.`;
    }
    else if (type === "library") {
        if (!stringField("slug") || !isRecord(value.meta) || !isRecord(value.graph) || !Array.isArray((value.graph as RecordJson).nodes) || !Array.isArray((value.graph as RecordJson).relationships) || !isRecord(value.counters) || !Array.isArray((value.counters as RecordJson).counters))
            return "Library requires slug, meta, graph nodes/relationships, and counters.";
        const errors = lintGraph(value.graph, { poolEntries: await readEntries(root) }).issues.filter(issue => issue.severity === "error");
        if (errors.length) return errors.map(issue => `${issue.code}: ${issue.message}`).join("; ");
    }
    return undefined;
}
function identityFor(type: ManagedEntityType, value: RecordJson): string {
    if (type === "macro") {
        const pkg = typeof value.package === "string" ? value.package : "";
        return `${pkg}::${requireId(value, "name")}`;
    }
    if (type === "library")
        return requireId(value, "slug");
    return requireId(value);
}
async function createDirect(root: string, type: "relationship" | "library", input: unknown): Promise<EntityMutationResult> {
    const value = requireRecord(input, type);
    const problem = await validationMessage(root, type, value);
    if (problem)
        return invalid(problem);
    const id = identityFor(type, value);
    return withWorkspaceDataLock(root, `create ${type}`, async () => { if (await getManagedEntity(root, type, id))
        return { status: "conflict", code: "entity.already-exists", message: `${type} ${JSON.stringify(id)} already exists.` }; if (type === "relationship") {
        const file = path.join(docRoot(root), "relationships.json");
        let data: RecordJson = { version: 1, relationships: [] };
        let original: { text: string; mode: number } | undefined;
        try {
            original = await readRegularText(file);
            data = requireRecord(JSON.parse(original.text), "relationships.json");
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT")
                throw e;
        }
        if (!Array.isArray(data.relationships))
            throw new Error("relationships.json#relationships must be an array.");
        const next = { ...data, relationships: [...data.relationships, value] };
        if (original) await replaceJsonIfUnchanged(file, original.text, next);
        else await installNewJson(file, next);
    }
    else {
        const librariesDir = path.join(docRoot(root), "libraries");
        const dir = path.join(librariesDir, id);
        if (path.basename(id) !== id || id === "." || id === "..")
            return invalid("Library slug must be one safe path segment.");
        let createdLibrariesDir = false;
        const docDirectoryIdentity = await readDirectoryIdentity(docRoot(root));
        let librariesDirectoryIdentity: { dev: number; ino: number };
        try {
            await fs.mkdir(librariesDir);
            createdLibrariesDir = true;
            await syncDirectoryDurably(docRoot(root), undefined, docDirectoryIdentity);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
                if (createdLibrariesDir) await fs.rmdir(librariesDir).catch(() => undefined);
                throw error;
            }
            await readDirectoryIdentity(librariesDir);
        }
        librariesDirectoryIdentity = await readDirectoryIdentity(librariesDir);
        await fs.mkdir(dir, { recursive: false });
        const directoryIdentity = await readDirectoryIdentity(dir);
        const resources = [
            { file: path.join(dir, "meta.json"), value: requireRecord(value.meta, "Library meta") },
            { file: path.join(dir, "graph.json"), value: requireRecord(value.graph, "Library graph") },
            { file: path.join(dir, "counters.json"), value: requireRecord(value.counters, "Library counters") },
        ];
        const installed: typeof resources = [];
        try {
            for (const resource of resources) {
                await assertDirectoryIdentity(dir, directoryIdentity);
                await installNewJson(resource.file, resource.value);
                installed.push(resource);
            }
            await syncDirectoryDurably(librariesDir, undefined, librariesDirectoryIdentity);
        }
        catch (error) {
            const cleanupErrors: string[] = [];
            try { await assertDirectoryIdentity(dir, directoryIdentity); }
            catch (identityError) {
                throw new Error(
                    `${error instanceof Error ? error.message : String(error)} Library directory changed concurrently; cleanup refused to access the replacement directory: ${identityError instanceof Error ? identityError.message : String(identityError)}`,
                    { cause: error },
                );
            }
            for (const resource of installed.reverse()) {
                try { await removeJsonIfUnchanged(resource.file, jsonText(resource.value)); }
                catch (cleanup) { cleanupErrors.push(`${resource.file}: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`); }
            }
            try {
                await fs.rmdir(dir);
                await syncDirectoryDurably(librariesDir, undefined, librariesDirectoryIdentity);
                if (createdLibrariesDir) {
                    await fs.rmdir(librariesDir);
                    await syncDirectoryDurably(docRoot(root), undefined, docDirectoryIdentity);
                }
            }
            catch (cleanup) { cleanupErrors.push(`${dir}: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`); }
            if (cleanupErrors.length) {
                throw new Error(
                    `${error instanceof Error ? error.message : String(error)} Library creation cleanup preserved concurrent data: ${cleanupErrors.join("; ")}`,
                    { cause: error },
                );
            }
            throw error;
        }
    } const entity = await getManagedEntity(root, type, id); if (!entity)
        throw new Error(`Created ${type} could not be read back.`); return { status: "ok", operation: "create", type, entity }; });
}
export async function createManagedEntity(root: string, type: ManagedEntityType, input: unknown): Promise<EntityMutationResult> {
    root = await canonicalWriteWorkspace(root);
    await assertWorkspace(root);
    if (type === "entry-kind" || type === "macro-kind")
        return mutateConfigEntity(root, type, "create", undefined, input);
    if (type === "entry-package" || type === "macro-package") {
        const result = await addPackageEntity(root, input);
        if (result.status !== "created")
            return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map(i => `${i.code}: ${i.message}`).join("; "));
        const entity = await getManagedEntity(root, type, result.id);
        if (!entity)
            throw new Error("Created Package could not be read back.");
        return { status: "ok", operation: "create", type, entity };
    }
    if (type === "entry") {
        const result = await addEntryEntity(root, input);
        if (result.status !== "created")
            return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map(i => `${i.code}: ${i.message}`).join("; "));
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
            return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map(i => `${i.code}: ${i.message}`).join("; "));
        const id = `${pkg}::${result.name}`;
        const entity = await getManagedEntity(root, type, id);
        if (!entity)
            throw new Error("Created Macro could not be read back.");
        return { status: "ok", operation: "create", type, entity };
    }
    return createDirect(root, type, input);
}
async function locateFile(root: string, type: ManagedEntityType, entity: ManagedEntity): Promise<string> { const doc = docRoot(root); if (type === "entry-package" || type === "macro-package")
    return path.join(doc, packageManifestPath(entity.id)); if (type === "entry") {
    const pkg = typeof entity.value.package === "string" ? entity.value.package : "";
    return path.join(doc, entryEntityPath(pkg, entity.id));
} if (type === "macro") {
    const split = entity.id.indexOf("::");
    return path.join(doc, macroEntityPath(entity.id.slice(0, split), entity.id.slice(split + 2)));
} throw new Error(`No entity file for ${type}.`); }
type DirectMutationOptions = {
    afterRevisionCheck?: () => void | Promise<void>;
    beforeConfigInstall?: () => void | Promise<void>;
    beforeEntityInstall?: () => void | Promise<void>;
    beforeEntityDelete?: () => void | Promise<void>;
    beforeManifestDelete?: () => void | Promise<void>;
    beforeLibraryDirectoryRemove?: (capturedDirectory: string) => void | Promise<void>;
    beforeLibraryCaptureSync?: () => void | Promise<void>;
    beforeLibraryDeleteCommitSync?: () => void | Promise<void>;
    beforeLibraryRestoreInstall?: () => void | Promise<void>;
    afterLibraryRestoreReservationCheck?: () => void | Promise<void>;
};
async function mutateDirect(root: string, type: Exclude<ManagedEntityType, "entry-kind" | "macro-kind">, operation: "update" | "delete", id: string, input: unknown, ifMatch: string, options: DirectMutationOptions = {}): Promise<EntityMutationResult> {
    return withWorkspaceDataLock(root, `${operation} ${type}`, async () => { const current = await getManagedEntity(root, type, id); if (!current)
        return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` }; if (current.revision !== ifMatch)
        return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
    await options.afterRevisionCheck?.();
    if (operation === "update") {
        const value = requireRecord(input, type);
        const problem = await validationMessage(root, type, value, id);
        if (problem)
            return invalid(problem);
        if (identityFor(type, value) !== id)
            return invalid(`${type} identity is immutable: payload identity must equal ${JSON.stringify(id)}.`);
        if (type === "relationship") {
            const file = path.join(docRoot(root), "relationships.json");
            const original = await readRegularText(file);
            const data = requireRecord(JSON.parse(original.text), "relationships.json");
            const values = data.relationships;
            if (!Array.isArray(values))
                throw new Error("relationships.json#relationships must be an array.");
            const lockedRelationship = values.find(row => isRecord(row) && row.id === id);
            if (!isRecord(lockedRelationship) || sha(lockedRelationship) !== ifMatch)
                return conflict(`relationship ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
            await options.beforeEntityInstall?.();
            await replaceJsonIfUnchanged(file, original.text, {
                ...data,
                relationships: values.map(row => isRecord(row) && row.id === id ? value : row),
            });
        }
        else if (type === "library") {
            const dir = path.join(docRoot(root), "libraries", id);
            const directoryIdentity = await readDirectoryIdentity(dir);
            const resources = [
                { file: path.join(dir, "meta.json"), next: requireRecord(value.meta, "Library meta") },
                { file: path.join(dir, "graph.json"), next: requireRecord(value.graph, "Library graph") },
                { file: path.join(dir, "counters.json"), next: requireRecord(value.counters, "Library counters") },
            ];
            const originals = await Promise.all(resources.map(async resource => {
                try { return { ...resource, original: await readRegularText(resource.file) }; }
                catch (error) {
                    if (path.basename(resource.file) === "counters.json" && (error as NodeJS.ErrnoException).code === "ENOENT")
                        return { ...resource, original: undefined };
                    throw error;
                }
            }));
            const lockedLibrary = {
                slug: id,
                meta: JSON.parse(originals[0].original!.text),
                graph: JSON.parse(originals[1].original!.text),
                counters: originals[2].original ? JSON.parse(originals[2].original.text) : { counters: [] },
            };
            if (sha(lockedLibrary) !== ifMatch)
                return conflict(`library ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
            const installed: typeof originals = [];
            try {
                await options.beforeEntityInstall?.();
                await assertDirectoryIdentity(dir, directoryIdentity);
                for (const resource of originals) {
                    await assertDirectoryIdentity(dir, directoryIdentity);
                    if (resource.original) await replaceJsonIfUnchanged(resource.file, resource.original.text, resource.next);
                    else await installNewJson(resource.file, resource.next);
                    installed.push(resource);
                }
            }
            catch (error) {
                const rollbackErrors: string[] = [];
                try { await assertDirectoryIdentity(dir, directoryIdentity); }
                catch (identityError) {
                    throw new Error(
                        `${error instanceof Error ? error.message : String(error)} Library directory changed concurrently; rollback refused to access the replacement directory: ${identityError instanceof Error ? identityError.message : String(identityError)}`,
                        { cause: error },
                    );
                }
                for (const resource of installed.reverse()) {
                    try {
                        if (resource.original) {
                            await replaceJsonIfUnchanged(
                                resource.file,
                                jsonText(resource.next),
                                JSON.parse(resource.original.text),
                            );
                        }
                        else await removeJsonIfUnchanged(resource.file, jsonText(resource.next));
                    }
                    catch (rollbackError) {
                        rollbackErrors.push(`${resource.file}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
                    }
                }
                if (rollbackErrors.length) {
                    throw new Error(
                        `${error instanceof Error ? error.message : String(error)} Library rollback failed without overwriting concurrent replacements: ${rollbackErrors.join("; ")}`,
                        { cause: error },
                    );
                }
                throw error;
            }
        }
        else {
            const file = await locateFile(root, type, current);
            if (type === "entry-package" || type === "macro-package") {
                const originalManifest = await readRegularText(file);
                const lockedManifest = requireRecord(JSON.parse(originalManifest.text), "Package manifest");
                const lockedPackageValue = type === "macro-package"
                    ? { ...lockedManifest, macros: (await readAllMacroPackages(root))[id]?.macros }
                    : lockedManifest;
                if (sha(lockedPackageValue) !== ifMatch)
                    return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
                const currentSchema = usesCurrentEntitySchemas(await readConfig(root));
                if (currentSchema && JSON.stringify(value.entry_ids) !== JSON.stringify(current.value.entry_ids))
                    return invalid("Package entry_ids is derived from owned Entries and cannot be changed directly.");
                const manifest = {
                    ...value,
                    format: "snl-package",
                    version: PACKAGE_STORAGE_VERSION,
                    ...(currentSchema ? {
                        schema_version: CURRENT_PACKAGE_SCHEMA_VERSION,
                        entry_ids: current.value.entry_ids,
                    } : {}),
                };
                delete (manifest as RecordJson).macros;
                await options.beforeEntityInstall?.();
                await replaceJsonIfUnchanged(file, originalManifest.text, manifest);
            }
            else if (type === "entry") {
                const originalEntity = await readRegularText(file);
                if (sha(JSON.parse(originalEntity.text)) !== ifMatch)
                    return conflict(`entry ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
                const envelope = requireRecord(JSON.parse(originalEntity.text), "Entry envelope");
                const currentSchema = usesCurrentEntitySchemas(await readConfig(root));
                const nextEnvelope = {
                    ...envelope,
                    format: "snl-entry",
                    version: ENTRY_STORAGE_VERSION,
                    ...(currentSchema ? { schema_version: CURRENT_ENTRY_SCHEMA_VERSION } : {}),
                    package: value.package,
                    entry: value,
                };
                const oldPackage = typeof current.value.package === "string" ? current.value.package : "";
                const newPackage = typeof value.package === "string" ? value.package : "";
                if (oldPackage === newPackage) {
                    await options.beforeEntityInstall?.();
                    await replaceJsonIfUnchanged(file, originalEntity.text, nextEnvelope);
                }
                else {
                    const destinationFile = path.join(docRoot(root), entryEntityPath(newPackage, id));
                    if (!currentSchema) {
                        let installed = false;
                        try {
                            await installNewJson(destinationFile, nextEnvelope);
                            installed = true;
                            await removeJsonIfUnchanged(file, originalEntity.text);
                        }
                        catch (error) {
                            if (installed) {
                                try { await removeJsonIfUnchanged(destinationFile, jsonText(nextEnvelope)); }
                                catch (rollback) {
                                    throw new Error(`${error instanceof Error ? error.message : String(error)} Rollback of legacy destination Entry failed: ${rollback instanceof Error ? rollback.message : String(rollback)}.`, { cause: error });
                                }
                            }
                            throw error;
                        }
                    }
                    else {
                    const sourceManifestFile = path.join(docRoot(root), packageManifestPath(oldPackage));
                    const destinationManifestFile = path.join(docRoot(root), packageManifestPath(newPackage));
                    const sourceOriginal = await readRegularText(sourceManifestFile);
                    const destinationOriginal = await readRegularText(destinationManifestFile);
                    const sourceManifest = requireRecord(JSON.parse(sourceOriginal.text), "Source Package manifest");
                    const destinationManifest = requireRecord(JSON.parse(destinationOriginal.text), "Destination Package manifest");
                    if (!Array.isArray(sourceManifest.entry_ids) || sourceManifest.entry_ids.filter(v => v === id).length !== 1)
                        throw new Error(`Source Package ${JSON.stringify(oldPackage)} must contain Entry ${JSON.stringify(id)} exactly once.`);
                    if (!Array.isArray(destinationManifest.entry_ids) || destinationManifest.entry_ids.includes(id))
                        throw new Error(`Destination Package ${JSON.stringify(newPackage)} already contains Entry ${JSON.stringify(id)}.`);
                    const sourceNext = { ...sourceManifest, entry_ids: sourceManifest.entry_ids.filter(v => v !== id) };
                    const destinationNext = {
                        ...destinationManifest,
                        entry_ids: [...destinationManifest.entry_ids, id].sort((left, right) =>
                            String(left).localeCompare(String(right))),
                    };
                    let installed = false;
                    let destinationUpdated = false;
                    let sourceUpdated = false;
                    try {
                        await installNewJson(destinationFile, nextEnvelope);
                        installed = true;
                        await replaceJsonIfUnchanged(destinationManifestFile, destinationOriginal.text, destinationNext);
                        destinationUpdated = true;
                        await replaceJsonIfUnchanged(sourceManifestFile, sourceOriginal.text, sourceNext);
                        sourceUpdated = true;
                        await removeJsonIfUnchanged(file, originalEntity.text);
                    }
                    catch (error) {
                        const rollbackErrors: string[] = [];
                        if (sourceUpdated) {
                            try { await replaceJsonIfUnchanged(sourceManifestFile, jsonText(sourceNext), sourceManifest); }
                            catch (rollback) { rollbackErrors.push(`source membership: ${rollback instanceof Error ? rollback.message : String(rollback)}`); }
                        }
                        if (destinationUpdated) {
                            try { await replaceJsonIfUnchanged(destinationManifestFile, jsonText(destinationNext), destinationManifest); }
                            catch (rollback) { rollbackErrors.push(`destination membership: ${rollback instanceof Error ? rollback.message : String(rollback)}`); }
                        }
                        if (installed) {
                            try { await removeJsonIfUnchanged(destinationFile, jsonText(nextEnvelope)); }
                            catch (rollback) { rollbackErrors.push(`destination Entry: ${rollback instanceof Error ? rollback.message : String(rollback)}`); }
                        }
                        if (rollbackErrors.length)
                            throw new Error(`${error instanceof Error ? error.message : String(error)} Rollback failed: ${rollbackErrors.join("; ")}.`, { cause: error });
                        throw error;
                    }
                    }
                }
            }
            else {
                const split = id.indexOf("::");
                const pkg = id.slice(0, split);
                const macro = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package"));
                const originalMacro = await readRegularText(file);
                if (sha(JSON.parse(originalMacro.text)) !== ifMatch)
                    return conflict(`macro ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
                const envelope = requireRecord(JSON.parse(originalMacro.text), "Macro envelope");
                const currentSchema = usesCurrentEntitySchemas(await readConfig(root));
                const nextEnvelope = {
                    ...envelope,
                    format: "snl-macro",
                    version: MACRO_STORAGE_VERSION,
                    ...(currentSchema ? { schema_version: CURRENT_MACRO_SCHEMA_VERSION } : {}),
                    package: pkg,
                    macro,
                };
                await options.beforeEntityInstall?.();
                await replaceJsonIfUnchanged(file, originalMacro.text, nextEnvelope);
            }
        }
        const entity = await getManagedEntity(root, type, id);
        if (!entity)
            throw new Error(`Updated ${type} could not be read back.`);
        return { status: "ok", operation, type, entity };
    } if (type === "entry") {
        const references = (await findEntityReferences(root, "entry", id)).filter(occurrence =>
            occurrence.role === "reference" && occurrence.category !== "package-membership");
        if (references.length)
            return { status: "conflict", code: "entity.referenced", message: `Entry ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
        const entityFile = await locateFile(root, type, current);
        const originalEntity = await readRegularText(entityFile);
        if (sha(JSON.parse(originalEntity.text)) !== ifMatch)
            return conflict(`entry ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
        if (!usesCurrentEntitySchemas(await readConfig(root))) {
            await removeJsonIfUnchanged(entityFile, originalEntity.text);
            return { status: "ok", operation, type, entity: current };
        }
        const packageId = typeof current.value.package === "string" ? current.value.package : "";
        const manifestFile = path.join(docRoot(root), packageManifestPath(packageId));
        const originalManifest = await readRegularText(manifestFile);
        const manifest = requireRecord(JSON.parse(originalManifest.text), "Package manifest");
        const entryIds = manifest.entry_ids;
        if (!Array.isArray(entryIds) || entryIds.filter(value => value === id).length !== 1)
            throw new Error(`Package ${JSON.stringify(packageId)} does not contain Entry ${JSON.stringify(id)} exactly once.`);
        const nextManifest = { ...manifest, entry_ids: entryIds.filter(value => value !== id) };
        await replaceJsonIfUnchanged(manifestFile, originalManifest.text, nextManifest);
        try {
            await removeJsonIfUnchanged(entityFile, originalEntity.text);
        }
        catch (error) {
            try {
                await replaceJsonIfUnchanged(manifestFile, jsonText(nextManifest), manifest);
            }
            catch (rollbackError) {
                throw new Error(`${error instanceof Error ? error.message : String(error)} Rollback of Package membership failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}.`, { cause: error });
            }
            throw error;
        }
    }
    else if (type === "macro") {
        const name = id.slice(id.indexOf("::") + 2);
        const references = (await findEntityReferences(root, "macro", name)).filter(occurrence => occurrence.role === "reference");
        if (references.length)
            return { status: "conflict", code: "entity.referenced", message: `Macro ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
        const file = await locateFile(root, type, current);
        const original = await readRegularText(file);
        if (sha(JSON.parse(original.text)) !== ifMatch)
            return conflict(`macro ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
        await options.beforeEntityDelete?.();
        await removeJsonIfUnchanged(file, original.text);
    }
    else if (type === "relationship") {
        const file = path.join(docRoot(root), "relationships.json");
        const original = await readRegularText(file);
        const data = requireRecord(JSON.parse(original.text), "relationships.json");
        const values = data.relationships;
        if (!Array.isArray(values))
            throw new Error("relationships.json#relationships must be an array.");
        const lockedRelationship = values.find(row => isRecord(row) && row.id === id);
        if (!isRecord(lockedRelationship) || sha(lockedRelationship) !== ifMatch)
            return conflict(`relationship ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
        await options.beforeEntityDelete?.();
        await replaceJsonIfUnchanged(file, original.text, {
            ...data,
            relationships: values.filter(row => !(isRecord(row) && row.id === id)),
        });
    }
    else if (type === "library") {
        const dir = path.join(docRoot(root), "libraries", id);
        const librariesDirectoryIdentity = await readDirectoryIdentity(path.dirname(dir));
        const originalDirectoryIdentity = await readDirectoryIdentity(dir);
        const extras = await libraryExtraNames(dir);
        if (extras.length) {
            return { status: "conflict", code: "library.not-empty", message: `Library ${JSON.stringify(id)} still contains unmanaged data: ${extras.join(", ")}.` };
        }
        const tomb = path.join(path.dirname(dir), `.${id}.snl-entity-${randomUUID()}.deleted`);
        await options.beforeEntityDelete?.();
        await fs.rename(dir, tomb);
        try { await syncDirectoryDurably(path.dirname(dir), options.beforeLibraryCaptureSync, librariesDirectoryIdentity); }
        catch (error) {
            try { await restoreCapturedDirectory(tomb, dir, { beforeInstall: options.beforeLibraryRestoreInstall, afterReservationCheckBeforeCopy: options.afterLibraryRestoreReservationCheck }); }
            catch (restoreError) {
                throw new Error(`Library delete could not durably capture ${dir}, and rollback failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`, { cause: error });
            }
            throw error;
        }
        const capturedDirectoryIdentity = await readDirectoryIdentity(tomb);
        if (capturedDirectoryIdentity.dev !== originalDirectoryIdentity.dev || capturedDirectoryIdentity.ino !== originalDirectoryIdentity.ino) {
            await restoreCapturedDirectory(tomb, dir, { beforeInstall: options.beforeLibraryRestoreInstall, afterReservationCheckBeforeCopy: options.afterLibraryRestoreReservationCheck });
            throw new Error(`${dir} was replaced while deletion was in flight; the replacement directory was restored.`);
        }
        let captured: RecordJson;
        try {
            captured = await readLibraryDirectoryValue(tomb, id);
        }
        catch (error) {
            await restoreCapturedDirectory(tomb, dir, { beforeInstall: options.beforeLibraryRestoreInstall, afterReservationCheckBeforeCopy: options.afterLibraryRestoreReservationCheck });
            throw new Error(
                `${dir} changed while deletion was in flight; its captured directory was restored: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
            );
        }
        const capturedExtras = await libraryExtraNames(tomb);
        if (sha(captured) !== current.revision || capturedExtras.length) {
            await restoreCapturedDirectory(tomb, dir, { beforeInstall: options.beforeLibraryRestoreInstall, afterReservationCheckBeforeCopy: options.afterLibraryRestoreReservationCheck });
            throw new Error(`${dir} changed while deletion was in flight; its captured directory was restored.`);
        }
        await options.beforeLibraryDirectoryRemove?.(tomb);
        const fileCaptures: Array<{ name: string; captured: string; identity: { dev: number; ino: number } }> = [];
        try {
            for (const name of ["meta.json", "graph.json", "counters.json"]) {
                const source = path.join(tomb, name);
                let identity: { dev: number; ino: number };
                try {
                    const original = await readRegularText(source);
                    identity = { dev: original.dev, ino: original.ino };
                }
                catch (error) {
                    if (name === "counters.json" && (error as NodeJS.ErrnoException).code === "ENOENT") continue;
                    throw error;
                }
                const capturedFile = path.join(path.dirname(tomb), `${path.basename(tomb)}.${name}.${randomUUID()}.captured`);
                await fs.rename(source, capturedFile);
                fileCaptures.push({ name, captured: capturedFile, identity });
                const observed = await readRegularText(capturedFile);
                if (observed.dev !== identity.dev || observed.ino !== identity.ino)
                    throw new Error(`${source} changed while Library deletion was in flight.`);
            }
            // Never recurse: an unmanaged file arriving after the earlier check
            // makes rmdir fail and is restored with the Library instead of lost.
            await fs.rmdir(tomb);
            await syncDirectoryDurably(path.dirname(tomb), options.beforeLibraryDeleteCommitSync, librariesDirectoryIdentity);
        }
        catch (error) {
            const recoveryErrors: string[] = [];
            try { await fs.mkdir(tomb); }
            catch (mkdirError) {
                if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST")
                    recoveryErrors.push(`recreate tomb: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
            }
            for (const item of fileCaptures.reverse()) {
                try { await fs.rename(item.captured, path.join(tomb, item.name)); }
                catch (restoreError) { recoveryErrors.push(`${item.name}: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`); }
            }
            try { await restoreCapturedDirectory(tomb, dir, { beforeInstall: options.beforeLibraryRestoreInstall, afterReservationCheckBeforeCopy: options.afterLibraryRestoreReservationCheck }); }
            catch (restoreError) { recoveryErrors.push(`directory: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`); }
            if (recoveryErrors.length)
                throw new Error(`${error instanceof Error ? error.message : String(error)} Library deletion recovery failed without overwriting concurrent data: ${recoveryErrors.join("; ")}`, { cause: error });
            throw new Error(`${dir} changed while deletion was in flight; its directory was restored.`, { cause: error });
        }
        for (const item of fileCaptures) await fs.rm(item.captured).catch(() => undefined);
    }
    else if (type === "entry-package" || type === "macro-package") {
        if (id === "_unpackaged")
            return invalid("The system _unpackaged Package cannot be deleted.");
        const entries = await entryRows(root);
        const macros = await macroRows(root);
        if (entries.some(e => e.value.package === id) || macros.some(m => m.value.package === id))
            return { status: "conflict", code: "package.not-empty", message: `Package ${JSON.stringify(id)} still contains entities.` };
        const file = await locateFile(root, type, current);
        const originalManifest = await readRegularText(file);
        const lockedManifest = requireRecord(JSON.parse(originalManifest.text), "Package manifest");
        const lockedPackageValue = type === "macro-package"
            ? { ...lockedManifest, macros: (await readAllMacroPackages(root))[id]?.macros }
            : lockedManifest;
        if (sha(lockedPackageValue) !== ifMatch)
            return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
        const configFile = path.join(docRoot(root), "config.json");
        const originalConfig = await readRegularText(configFile);
        const config = requireRecord(JSON.parse(originalConfig.text), "config.json");
        const active = Array.isArray(config.active_macro_packages)
            ? config.active_macro_packages.filter((value): value is string => typeof value === "string")
            : (await packageRows(root, "entry-package"))
                .map(row => row.id)
                .filter(packageId => packageId !== "_unpackaged");
        const nextConfig = {
            ...config,
            active_macro_packages: [...new Set(active.filter(value => value !== id))]
                .sort((left, right) => left.localeCompare(right)),
        };
        await options.beforeConfigInstall?.();
        await replaceJsonIfUnchanged(configFile, originalConfig.text, nextConfig);
        try {
            await options.beforeManifestDelete?.();
            await removeJsonIfUnchanged(file, originalManifest.text);
        }
        catch (error) {
            try {
                await replaceJsonIfUnchanged(configFile, jsonText(nextConfig), config);
            }
            catch (rollbackError) {
                throw new Error(`${error instanceof Error ? error.message : String(error)} Rollback of config failed without overwriting a concurrent replacement: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}.`, { cause: error });
            }
            throw error;
        }
    }
    else
        await fs.unlink(await locateFile(root, type, current)); return { status: "ok", operation, type, entity: current }; });
}
export async function updateManagedEntity(root: string, type: ManagedEntityType, id: string, input: unknown, ifMatch: string, options: DirectMutationOptions = {}): Promise<EntityMutationResult> { root = await canonicalWriteWorkspace(root); await assertWorkspace(root); if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "update", id, input, ifMatch); return mutateDirect(root, type, "update", id, input, ifMatch, options); }
export async function deleteManagedEntity(root: string, type: ManagedEntityType, id: string, ifMatch: string, options: DirectMutationOptions = {}): Promise<EntityMutationResult> { root = await canonicalWriteWorkspace(root); await assertWorkspace(root); if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "delete", id, undefined, ifMatch); return mutateDirect(root, type, "delete", id, undefined, ifMatch, options); }
