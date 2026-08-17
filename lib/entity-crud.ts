import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { packageManifestPath, entryEntityPath, macroEntityPath } from "./entity-storage.ts";
import { readActiveMacros, readConfig, readEntries, readEntryKinds, usesEntityStorage } from "./snl-doc.ts";
import { lintEntry } from "./lint-entry.ts";
import { lintPackage } from "./lint-package.ts";
import { findEntityReferences } from "./entity-references.ts";
import { withWorkspaceDataLock } from "./workspace-data-lock.ts";
import { addEntryEntity, addMacroEntity, addPackageEntity } from "./entity-writes.ts";
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
function managed(type: ManagedEntityType, id: string, value: RecordJson): ManagedEntity { return { type, id, revision: sha(value), value }; }
function requireRecord(value: unknown, label: string): RecordJson { if (!isRecord(value))
    throw new Error(`${label} must be a JSON object.`); return value; }
function requireId(value: RecordJson, field = "id"): string { if (typeof value[field] !== "string" || !value[field])
    throw new Error(`${field} must be a non-empty string.`); return value[field] as string; }
async function packageRows(root: string, type: "entry-package" | "macro-package"): Promise<ManagedEntity[]> {
    const rows: ManagedEntity[] = [];
    const doc = docRoot(root);
    for (const file of await jsonFiles(path.join(doc, "packages"))) {
        const manifest = requireRecord(await readJson(file), "Package manifest");
        if (manifest.format !== "snl-package" || manifest.version !== 1)
            throw new Error(`${file} is not a Package v1 manifest.`);
        const id = requireId(manifest);
        if (path.relative(doc, file) !== packageManifestPath(id))
            throw new Error(`${file} does not match Package identity ${id}.`);
        if (type === "entry-package")
            rows.push(managed(type, id, manifest));
        else {
            const macros: RecordJson = Object.create(null);
            for (const macroFile of await jsonFiles(path.join(doc, "macros"))) {
                const envelope = requireRecord(await readJson(macroFile), "Macro envelope");
                if (envelope.package !== id)
                    continue;
                const macro = requireRecord(envelope.macro, "Macro payload");
                const name = requireId(macro, "name");
                macros[name] = Object.fromEntries(Object.entries(macro).filter(([key]) => key !== "name"));
            }
            rows.push(managed(type, id, { ...manifest, macros }));
        }
    }
    return rows.sort(compare);
}
async function entryRows(root: string): Promise<ManagedEntity[]> { const rows: ManagedEntity[] = []; const doc = docRoot(root); for (const file of await jsonFiles(path.join(doc, "entries"))) {
    const env = requireRecord(await readJson(file), "Entry envelope");
    const value = requireRecord(env.entry, "Entry payload");
    const id = requireId(value);
    const pkg = typeof env.package === "string" ? env.package : "";
    if (path.relative(doc, file) !== entryEntityPath(pkg, id))
        throw new Error(`${file} does not match Entry identity ${id}.`);
    rows.push(managed("entry", id, value));
} return rows.sort(compare); }
async function macroRows(root: string): Promise<ManagedEntity[]> { const rows: ManagedEntity[] = []; const doc = docRoot(root); for (const file of await jsonFiles(path.join(doc, "macros"))) {
    const env = requireRecord(await readJson(file), "Macro envelope");
    const value = requireRecord(env.macro, "Macro payload");
    const name = requireId(value, "name");
    const pkg = typeof env.package === "string" ? env.package : "";
    if (path.relative(doc, file) !== macroEntityPath(pkg, name))
        throw new Error(`${file} does not match Macro identity ${name}.`);
    rows.push(managed("macro", `${pkg}::${name}`, { package: pkg, ...value }));
} return rows.sort(compare); }
async function relationshipRows(root: string): Promise<ManagedEntity[]> { const file = path.join(docRoot(root), "relationships.json"); try {
    const data = requireRecord(await readJson(file), "Relationships file");
    if (!Array.isArray(data.relationships))
        throw new Error("relationships.json#relationships must be an array.");
    return data.relationships.map(v => { const value = requireRecord(v, "Relationship"); return managed("relationship", requireId(value), value); }).sort(compare);
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return [];
    throw e;
} }
async function libraryRows(root: string): Promise<ManagedEntity[]> { const base = path.join(docRoot(root), "libraries"); const rows: ManagedEntity[] = []; let entries; try {
    entries = await fs.readdir(base, { withFileTypes: true });
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return [];
    throw e;
} for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory())
        continue;
    const dir = path.join(base, entry.name);
    const meta = requireRecord(await readJson(path.join(dir, "meta.json")), "Library meta");
    const graph = requireRecord(await readJson(path.join(dir, "graph.json")), "Library graph");
    let counters: RecordJson = { counters: [] };
    try {
        counters = requireRecord(await readJson(path.join(dir, "counters.json")), "Library counters");
    }
    catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT")
            throw e;
    }
    rows.push(managed("library", entry.name, { slug: entry.name, meta, graph, counters }));
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
async function atomicWriteJson(file: string, value: unknown): Promise<void> {
    const directory = path.dirname(file);
    const temp = path.join(directory, `.${path.basename(file)}.snl-entity-${process.pid}-${randomUUID()}.tmp`);
    let handle;
    let mode = 0o644;
    try {
        mode = (await fs.stat(file)).mode & 0o777;
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
            throw error;
    }
    try {
        handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, mode);
        await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
        await handle.sync();
        await handle.close();
        handle = undefined;
        await fs.rename(temp, file);
        const dir = await fs.open(directory, constants.O_RDONLY);
        try {
            await dir.sync();
        }
        finally {
            await dir.close();
        }
    }
    finally {
        await handle?.close();
        await fs.rm(temp, { force: true });
    }
}
function invalid(message: string): EntityMutationResult { return { status: "invalid", code: "entity.invalid", message }; }
function conflict(message: string): EntityMutationResult { return { status: "conflict", code: "entity.revision-conflict", message }; }
async function mutateConfigEntity(root: string, type: "entry-kind" | "macro-kind", operation: "create" | "update" | "delete", id: string | undefined, input: unknown, ifMatch?: string): Promise<EntityMutationResult> {
    return withWorkspaceDataLock(root, `${operation} ${type}`, async () => { const file = path.join(docRoot(root), "config.json"); const config = requireRecord(await readJson(file), "config.json"); if (!usesEntityStorage(config))
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
        await atomicWriteJson(file, next);
        return { status: "ok", operation, type, entity: managed(type, newId, value) };
    } if (index < 0)
        return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` }; const current = requireRecord(values[index], type); const currentEntity = managed(type, id!, current); if (!ifMatch || ifMatch !== currentEntity.revision)
        return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`); if (operation === "delete") {
        const nextValues = values.filter((_, i) => i !== index);
        await atomicWriteJson(file, { ...config, [field]: nextValues });
        return { status: "ok", operation, type, entity: currentEntity };
    } const value = requireRecord(input, type); const problem = await validationMessage(root, type, value, id); if (problem)
        return invalid(problem); if (requireId(value) !== id)
        return invalid(`${type} identity is immutable: payload id must equal ${JSON.stringify(id)}.`); const nextValues = [...values]; nextValues[index] = value; await atomicWriteJson(file, { ...config, [field]: nextValues }); return { status: "ok", operation, type, entity: managed(type, id!, value) }; });
}
async function validationMessage(root: string, type: ManagedEntityType, value: RecordJson, currentId?: string): Promise<string | undefined> {
    const stringField = (field: string) => typeof value[field] === "string" && value[field] !== "";
    if (type === "entry-kind") {
        if (!stringField("id") || !stringField("name") || !isRecord(value.coloring) || typeof value.style !== "string")
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
        const report = lintPackage({ version: "8", name: pkg, description: "", macros: name ? { [name]: body } : {} }, { checkKatex: false });
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
        try {
            data = requireRecord(await readJson(file), "relationships.json");
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT")
                throw e;
        }
        if (!Array.isArray(data.relationships))
            throw new Error("relationships.json#relationships must be an array.");
        await atomicWriteJson(file, { ...data, relationships: [...data.relationships, value] });
    }
    else {
        const dir = path.join(docRoot(root), "libraries", id);
        if (path.basename(id) !== id || id === "." || id === "..")
            return invalid("Library slug must be one safe path segment.");
        await fs.mkdir(dir, { recursive: false });
        try {
            await atomicWriteJson(path.join(dir, "meta.json"), requireRecord(value.meta, "Library meta"));
            await atomicWriteJson(path.join(dir, "graph.json"), requireRecord(value.graph, "Library graph"));
            await atomicWriteJson(path.join(dir, "counters.json"), requireRecord(value.counters, "Library counters"));
        }
        catch (e) {
            await fs.rm(dir, { recursive: true, force: true });
            throw e;
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
async function mutateDirect(root: string, type: Exclude<ManagedEntityType, "entry-kind" | "macro-kind">, operation: "update" | "delete", id: string, input: unknown, ifMatch: string): Promise<EntityMutationResult> {
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
            const data = requireRecord(await readJson(file), "relationships.json");
            const values = data.relationships;
            if (!Array.isArray(values))
                throw new Error("relationships.json#relationships must be an array.");
            await atomicWriteJson(file, { ...data, relationships: values.map(row => isRecord(row) && row.id === id ? value : row) });
        }
        else if (type === "library") {
            const dir = path.join(docRoot(root), "libraries", id);
            await atomicWriteJson(path.join(dir, "meta.json"), requireRecord(value.meta, "Library meta"));
            await atomicWriteJson(path.join(dir, "graph.json"), requireRecord(value.graph, "Library graph"));
            await atomicWriteJson(path.join(dir, "counters.json"), requireRecord(value.counters, "Library counters"));
        }
        else {
            const file = await locateFile(root, type, current);
            if (type === "entry-package" || type === "macro-package") {
                const manifest = { ...value, format: "snl-package", version: 1 };
                delete (manifest as RecordJson).macros;
                await atomicWriteJson(file, manifest);
            }
            else if (type === "entry") {
                await atomicWriteJson(file, { format: "snl-entry", version: 1, package: value.package, entry: value });
            }
            else {
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
    } if (type === "entry") {
        const references = (await findEntityReferences(root, "entry", id)).filter(occurrence => occurrence.role === "reference");
        if (references.length)
            return { status: "conflict", code: "entity.referenced", message: `Entry ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
        await fs.unlink(await locateFile(root, type, current));
    }
    else if (type === "macro") {
        const name = id.slice(id.indexOf("::") + 2);
        const references = (await findEntityReferences(root, "macro", name)).filter(occurrence => occurrence.role === "reference");
        if (references.length)
            return { status: "conflict", code: "entity.referenced", message: `Macro ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
        await fs.unlink(await locateFile(root, type, current));
    }
    else if (type === "relationship") {
        const file = path.join(docRoot(root), "relationships.json");
        const data = requireRecord(await readJson(file), "relationships.json");
        const values = data.relationships;
        if (!Array.isArray(values))
            throw new Error("relationships.json#relationships must be an array.");
        await atomicWriteJson(file, { ...data, relationships: values.filter(row => !(isRecord(row) && row.id === id)) });
    }
    else if (type === "library") {
        const dir = path.join(docRoot(root), "libraries", id);
        const tomb = path.join(path.dirname(dir), `.${id}.snl-entity-${randomUUID()}.deleted`);
        await fs.rename(dir, tomb);
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
        await fs.unlink(file);
        const configFile = path.join(docRoot(root), "config.json");
        const config = requireRecord(await readJson(configFile), "config.json");
        if (Array.isArray(config.active_macro_packages))
            await atomicWriteJson(configFile, { ...config, active_macro_packages: config.active_macro_packages.filter(v => v !== id) });
    }
    else
        await fs.unlink(await locateFile(root, type, current)); return { status: "ok", operation, type, entity: current }; });
}
export async function updateManagedEntity(root: string, type: ManagedEntityType, id: string, input: unknown, ifMatch: string): Promise<EntityMutationResult> { root = await canonicalWriteWorkspace(root); await assertWorkspace(root); if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "update", id, input, ifMatch); return mutateDirect(root, type, "update", id, input, ifMatch); }
export async function deleteManagedEntity(root: string, type: ManagedEntityType, id: string, ifMatch: string): Promise<EntityMutationResult> { root = await canonicalWriteWorkspace(root); await assertWorkspace(root); if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "delete", id, undefined, ifMatch); return mutateDirect(root, type, "delete", id, undefined, ifMatch); }

