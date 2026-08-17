import path from "node:path";
import { promises as fs } from "node:fs";
import { formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG, type FlagSpec } from "../../lib/cli-args.ts";
import { createManagedEntity, deleteManagedEntity, getManagedEntity, isManagedEntityType, listManagedEntities, updateManagedEntity } from "../../lib/entity-crud.ts";
const TYPE: FlagSpec = { name: "type", short: "t", hasValue: true, help: "Entity type enum." };
const INPUT: FlagSpec = { name: "input", short: "i", hasValue: true, help: "JSON payload file for create/update." };
const MATCH: FlagSpec = { name: "if-match", hasValue: true, help: "Exact revision returned by get/list; required for update/delete." };
const SPECS = [ROOT_FLAG, TYPE, INPUT, MATCH, JSON_FLAG, HELP_FLAG];
const usage = () => formatUsage("snl-entity", "[options] <list|get|create|update|delete> [exact-id]", SPECS);
function emit(value: unknown, json: boolean) { process.stdout.write(`${json ? JSON.stringify(value, null, 2) : typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`); }
function usageFailure(message: string, json: boolean) { emit({ status: "error", code: "usage", message }, json); return 2; }
async function main(): Promise<number> {
    let parsed;
    const asJson = process.argv.includes("--json");
    try {
        parsed = parseArgs(process.argv.slice(2), SPECS);
    }
    catch (e) {
        return usageFailure((e as Error).message, asJson);
    }
    if (parsed.flags.help === true) {
        emit(asJson ? { status: "help", usage: usage() } : usage(), asJson);
        return 0;
    }
    const [operation, id, ...extra] = parsed.positional;
    const rawType = String(parsed.flags.type ?? "");
    if (!isManagedEntityType(rawType))
        return usageFailure(`Unknown or missing entity type ${JSON.stringify(rawType)}.`, asJson);
    if (extra.length || !["list", "get", "create", "update", "delete"].includes(operation))
        return usageFailure("Expected list, get, create, update, or delete.", asJson);
    if ((operation === "get" || operation === "update" || operation === "delete") && !id || operation === "list" && id || operation === "create" && id)
        return usageFailure("Wrong number of exact identity arguments.", asJson);
    const needsInput = operation === "create" || operation === "update";
    if (needsInput !== (typeof parsed.flags.input === "string"))
        return usageFailure(`${operation} ${needsInput ? "requires" : "does not accept"} --input.`, asJson);
    if ((operation === "update" || operation === "delete") && typeof parsed.flags["if-match"] !== "string")
        return usageFailure(`${operation} requires --if-match.`, asJson);
    try {
        const root = path.resolve(String(parsed.flags.root));
        let input: unknown;
        if (needsInput) {
            let text;
            try {
                text = await fs.readFile(path.resolve(String(parsed.flags.input)), "utf8");
            }
            catch (e) {
                emit({ status: "error", code: "input.read-failed", message: e instanceof Error ? e.message : String(e) }, asJson);
                return 2;
            }
            try {
                input = JSON.parse(text);
            }
            catch (e) {
                emit({ status: "error", code: "input.invalid-json", message: e instanceof Error ? e.message : String(e) }, asJson);
                return 2;
            }
        }
        if (operation === "list") {
            emit({ status: "ok", operation, type: rawType, entities: await listManagedEntities(root, rawType) }, asJson);
            return 0;
        }
        if (operation === "get") {
            const entity = await getManagedEntity(root, rawType, id!);
            if (!entity) {
                emit({ status: "not-found", code: "entity.not-found", message: `${rawType} ${JSON.stringify(id)} was not found.` }, asJson);
                return 1;
            }
            emit({ status: "ok", operation, type: rawType, entity }, asJson);
            return 0;
        }
        const result = operation === "create" ? await createManagedEntity(root, rawType, input) : operation === "update" ? await updateManagedEntity(root, rawType, id!, input, String(parsed.flags["if-match"])) : await deleteManagedEntity(root, rawType, id!, String(parsed.flags["if-match"]));
        emit(result, asJson);
        return result.status === "ok" ? 0 : 1;
    }
    catch (e) {
        emit({ status: "error", code: "workspace.operation-failed", message: e instanceof Error ? e.message : String(e) }, asJson);
        return 2;
    }
}
main().then(code => { process.exitCode = code; });

