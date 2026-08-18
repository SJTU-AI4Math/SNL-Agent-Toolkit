import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CURRENT_ENTRY_SCHEMA_VERSION, CURRENT_MACRO_SCHEMA_VERSION, CURRENT_PACKAGE_SCHEMA_VERSION, ENTRY_STORAGE_VERSION, MACRO_STORAGE_VERSION, PACKAGE_STORAGE_VERSION, packageManifestPath, entryEntityPath, macroEntityPath } from "./entity-storage.ts";
import { assertCurrentKindCatalogs, readActiveMacros, readAllMacroPackages, readConfig, readEntries, readEntryKinds, usesCurrentEntitySchemas, usesEntityStorage } from "./snl-doc.ts";
import type { SnlConfig } from "./snl-doc-schema.ts";
import { lintEntry } from "./lint-entry.ts";
import { lintPackage } from "./lint-package.ts";
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
async function entryRows(root: string): Promise<ManagedEntity[]> {
    const rows: ManagedEntity[] = [];
    const doc = docRoot(root);
    for (const value of await readEntries(root)) {
        const envelope = requireRecord(await readJson(path.join(doc, entryEntityPath(value.package ?? "", value.id))), "Entry envelope");
        rows.push(managed("entry", value.id, value as unknown as RecordJson, envelope));
    }
    return rows.sort(compare);
}
async function macroRows(root: string): Promise<ManagedEntity[]> {
    const rows: ManagedEntity[] = [];
    const doc = docRoot(root);
    for (const [pkg, macroPackage] of Object.entries(await readAllMacroPackages(root))) {
        for (const [name, body] of Object.entries(macroPackage.macros)) {
            const envelope = requireRecord(await readJson(path.join(doc, macroEntityPath(pkg, name))), "Macro envelope");
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
export async function listManagedEntities(root: string, type: ManagedEntityType): Promise<ManagedEntity[]> {
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
        return entryRows(root);
    if (type === "macro")
        return macroRows(root);
    if (type === "relationship")
        return relationshipRows(root);
    return libraryRows(root);
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
        if (!(await packageRows(root, "entry-package")).some(row => row.id === pkg))
            return `Macro Package ${JSON.stringify(pkg)} does not exist.`;
    }
    else if (type === "relationship") {
        if (!stringField("id") || !stringField("from") || !stringField("to") || !stringField("label"))
            return "Relationship requires non-empty id/from/to/label strings.";
    }
    else if (type === "library") {
        if (!stringField("slug") || !isRecord(value.meta) || !isRecord(value.graph) || !Array.isArray((value.graph as RecordJson).nodes) || !Array.isArray((value.graph as RecordJson).relationships) || !isRecord(value.counters) || !Array.isArray((value.counters as RecordJson).counters))
            return "Library requires slug, meta, graph nodes/relationships, and counters.";
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
        const dir = path.join(docRoot(root), "libraries", id);
        if (path.basename(id) !== id || id === "." || id === "..")
            return invalid("Library slug must be one safe path segment.");
        await fs.mkdir(dir, { recursive: false });
        const resources = [
            { file: path.join(dir, "meta.json"), value: requireRecord(value.meta, "Library meta") },
            { file: path.join(dir, "graph.json"), value: requireRecord(value.graph, "Library graph") },
            { file: path.join(dir, "counters.json"), value: requireRecord(value.counters, "Library counters") },
        ];
        const installed: typeof resources = [];
        try {
            for (const resource of resources) {
                await installNewJson(resource.file, resource.value);
                installed.push(resource);
            }
        }
        catch (error) {
            const cleanupErrors: string[] = [];
            for (const resource of installed.reverse()) {
                try { await removeJsonIfUnchanged(resource.file, jsonText(resource.value)); }
                catch (cleanup) { cleanupErrors.push(`${resource.file}: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`); }
            }
            try { await fs.rmdir(dir); }
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
    beforeConfigInstall?: () => void | Promise<void>;
    beforeEntityInstall?: () => void | Promise<void>;
    beforeEntityDelete?: () => void | Promise<void>;
    beforeManifestDelete?: () => void | Promise<void>;
};
async function mutateDirect(root: string, type: Exclude<ManagedEntityType, "entry-kind" | "macro-kind">, operation: "update" | "delete", id: string, input: unknown, ifMatch: string, options: DirectMutationOptions = {}): Promise<EntityMutationResult> {
    return withWorkspaceDataLock(root, `${operation} ${type}`, async () => { const current = await getManagedEntity(root, type, id); if (!current)
        return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` }; if (current.revision !== ifMatch)
        return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`); if (operation === "update") {
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
            await options.beforeEntityInstall?.();
            await replaceJsonIfUnchanged(file, original.text, {
                ...data,
                relationships: values.map(row => isRecord(row) && row.id === id ? value : row),
            });
        }
        else if (type === "library") {
            const dir = path.join(docRoot(root), "libraries", id);
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
            const installed: typeof originals = [];
            try {
                await options.beforeEntityInstall?.();
                for (const resource of originals) {
                    if (resource.original) await replaceJsonIfUnchanged(resource.file, resource.original.text, resource.next);
                    else await installNewJson(resource.file, resource.next);
                    installed.push(resource);
                }
            }
            catch (error) {
                const rollbackErrors: string[] = [];
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
        await options.beforeEntityDelete?.();
        await replaceJsonIfUnchanged(file, original.text, {
            ...data,
            relationships: values.filter(row => !(isRecord(row) && row.id === id)),
        });
    }
    else if (type === "library") {
        const dir = path.join(docRoot(root), "libraries", id);
        const extras = await libraryExtraNames(dir);
        if (extras.length) {
            return { status: "conflict", code: "library.not-empty", message: `Library ${JSON.stringify(id)} still contains unmanaged data: ${extras.join(", ")}.` };
        }
        const tomb = path.join(path.dirname(dir), `.${id}.snl-entity-${randomUUID()}.deleted`);
        await options.beforeEntityDelete?.();
        await fs.rename(dir, tomb);
        let captured: RecordJson;
        try {
            captured = await readLibraryDirectoryValue(tomb, id);
        }
        catch (error) {
            throw new Error(
                `${dir} changed while deletion was in flight; its captured directory was preserved at ${tomb}: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
            );
        }
        const capturedExtras = await libraryExtraNames(tomb);
        if (sha(captured) !== current.revision || capturedExtras.length) {
            throw new Error(`${dir} changed while deletion was in flight; its captured directory was preserved at ${tomb}.`);
        }
        await fs.rm(tomb, { recursive: true });
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
