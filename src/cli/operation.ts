import path from 'node:path';
import {
  createManagedEntity,
  deleteManagedEntity,
  getManagedEntity,
  listManagedEntities,
  updateManagedEntity,
  validateManagedWorkspace,
  type ManagedEntityType,
} from '../../lib/entity-crud.ts';
import { readConfig } from '../../lib/snl-doc.ts';
import { querySnoogl } from '../../lib/snoogle-query.ts';
import { computeEntryBareLatex, EntryAnalysisError } from '../../lib/entry-analysis.ts';
import { findEntityReferences } from '../../lib/entity-references.ts';
import { macroEntityPath } from '../../lib/entity-storage.ts';

export const OPERATION_PROTOCOL = 'snl.operation/v1' as const;
export const RESULT_PROTOCOL = 'snl.result/v1' as const;
export type JsonObject = Record<string, unknown>;
export interface OperationRequest { protocol: typeof OPERATION_PROTOCOL; command: string; root: string; arguments: JsonObject }
type Success = { protocol: typeof RESULT_PROTOCOL; ok: true; command: string; data: unknown; diagnostics: unknown[] };
type Failure = { protocol: typeof RESULT_PROTOCOL; ok: false; command: string; error: { code: string; message: string; details?: unknown; retryable: boolean } };
export type OperationResponse = Success | Failure;
export interface ExecutedOperation { exitCode: 0 | 1 | 2; response: OperationResponse }

const ENTITY_DOMAINS: Readonly<Record<string, ManagedEntityType>> = Object.freeze({
  entry: 'entry', macro: 'macro', 'entry-kind': 'entry-kind', 'macro-kind': 'macro-kind',
  'entry-package': 'entry-package', 'macro-package': 'macro-package', relationship: 'relationship', library: 'library',
});
const ENTITY_ACTIONS = ['list', 'get', 'create', 'update', 'delete'] as const;
export const COMMAND_PATHS = Object.freeze([
  'help', 'info', 'validate',
  ...Object.keys(ENTITY_DOMAINS).flatMap(domain => [domain, ...ENTITY_ACTIONS.map(action => `${domain}/${action}`)]),
  'snoogl', 'entry/latex', 'entry/references', 'macro/usages',
]);
type CommandDescriptor = { command: string; access: 'read' | 'write'; arguments: Record<string, { type: string; required: boolean }>; summary: string };
const field = (type: string, required: boolean) => ({ type, required });
function describeCommand(command: string): CommandDescriptor {
  const action = command.split('/').at(-1);
  if (action === 'list') return { command, access: 'read', arguments: { query: field('string|null', false), limit: field('integer', false), cursor: field('string|null', false) }, summary: 'List one managed entity family with stable pagination.' };
  if (action === 'get') return { command, access: 'read', arguments: { id: field('string', true) }, summary: 'Read one exact managed entity and its revision.' };
  if (action === 'create') return { command, access: 'write', arguments: { value: field('object', true) }, summary: 'Create one validated managed entity.' };
  if (action === 'update') return { command, access: 'write', arguments: { id: field('string', true), value: field('object', true), expectedRevision: field('string', true) }, summary: 'Replace one managed entity under revision control.' };
  if (action === 'delete') return { command, access: 'write', arguments: { id: field('string', true), expectedRevision: field('string', true) }, summary: 'Delete one managed entity under revision control.' };
  if (command === 'entry/latex') return { command, access: 'read', arguments: { id: field('string', true) }, summary: 'Render one Entry as bare LaTeX.' };
  if (command === 'entry/references' || command === 'macro/usages') return { command, access: 'read', arguments: { id: field('string', true) }, summary: 'Find structured references to one existing identity.' };
  return { command, access: 'read', arguments: {}, summary: 'Discover this command namespace.' };
}
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isUnsupportedSchemaMessage = (message: string) => /unsupported (?:future )?(?:workspace|schema)|newer than this Toolkit supports|no registered migration/i.test(message);
export const operationFailure = (command: string, exitCode: 1 | 2, code: string, message: string, details?: unknown): ExecutedOperation => ({
  exitCode,
  response: { protocol: RESULT_PROTOCOL, ok: false, command, error: { code, message, ...(details === undefined ? {} : { details }), retryable: code.endsWith('locked') } },
});
const succeed = (command: string, data: unknown): ExecutedOperation => ({ exitCode: 0, response: { protocol: RESULT_PROTOCOL, ok: true, command, data, diagnostics: [] } });
function stringArg(args: JsonObject, name: string, required = true): string | undefined {
  const value = args[name];
  if ((value === undefined || value === null) && !required) return undefined;
  if (typeof value !== 'string' || (required && value.length === 0)) throw new TypeError(`${name} must be ${required ? 'a non-empty' : 'a'} string.`);
  return value;
}
function exactArguments(args: JsonObject, allowed: readonly string[]): void {
  const unknown = Object.keys(args).filter(key => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`Unknown argument key(s): ${unknown.join(', ')}.`);
}

export async function executeOperation(request: OperationRequest): Promise<ExecutedOperation> {
  const command = request && typeof request.command === 'string' ? request.command : 'unknown';
  try {
    if (!request || request.protocol !== OPERATION_PROTOCOL || typeof request.root !== 'string' || !request.root || !request.arguments || typeof request.arguments !== 'object' || Array.isArray(request.arguments))
      return operationFailure(command || 'unknown', 2, 'operation.invalid-request', 'Expected protocol snl.operation/v1, an absolute workspace root, and an arguments object.');
    if (!path.isAbsolute(request.root)) return operationFailure(command, 2, 'workspace.root-not-absolute', 'root must be an absolute path.');
    const tokens = command.split('/');
    if (tokens.length === 1 && command === 'help') {
      exactArguments(request.arguments, []);
      return succeed(command, { operationProtocol: OPERATION_PROTOCOL, resultProtocol: RESULT_PROTOCOL, commands: COMMAND_PATHS.filter(path => path !== 'help') });
    }
    if (tokens.length === 1 && command === 'validate') {
      exactArguments(request.arguments, ['scope']);
      const scope = stringArg(request.arguments, 'scope');
      if (scope !== 'workspace') throw new TypeError('scope must be workspace.');
      const validation = await validateManagedWorkspace(request.root);
      if (validation.issues.some(issue => isUnsupportedSchemaMessage(issue.message))) return operationFailure(command, 2, 'workspace.unsupported-schema', 'Workspace or entity schema is not supported by this Toolkit.', validation);
      return validation.valid ? succeed(command, validation) : operationFailure(command, 1, 'workspace.invalid', 'Workspace validation reported errors.', validation);
    }
    if (tokens.length === 1 && command === 'info') {
      exactArguments(request.arguments, []);
      const [config, validation] = await Promise.all([readConfig(request.root), validateManagedWorkspace(request.root)]);
      if (validation.issues.some(issue => isUnsupportedSchemaMessage(issue.message))) return operationFailure(command, 2, 'workspace.unsupported-schema', 'Workspace or entity schema is not supported by this Toolkit.', validation);
      if (!validation.valid) return operationFailure(command, 1, 'workspace.invalid', 'Workspace validation reported errors.', validation);
      return succeed(command, {
        root: path.resolve(request.root),
        version: config.version,
        versions: { workspace: config.version, entitySchema: 1, libraryTopology: 1, operationProtocol: OPERATION_PROTOCOL, resultProtocol: RESULT_PROTOCOL },
        counts: validation.counts,
        valid: true,
        capabilities: COMMAND_PATHS.filter(item => item !== 'help'),
        commandRegistryVersion: 1,
      });
    }
    if (command === 'snoogl') {
      exactArguments(request.arguments, ['mode', 'query']);
      const mode = stringArg(request.arguments, 'mode');
      if (mode !== 'entry' && mode !== 'macro') throw new TypeError('mode must be entry or macro.');
      return succeed(command, await querySnoogl(request.root, mode, stringArg(request.arguments, 'query')!));
    }
    if (command === 'entry/latex') {
      exactArguments(request.arguments, ['id']);
      const id = stringArg(request.arguments, 'id')!;
      try {
        const rendered = await computeEntryBareLatex(request.root, id);
        return succeed(command, { entryId: id, latex: rendered.output, notes: rendered.notes });
      } catch (error) {
        if (error instanceof EntryAnalysisError) return operationFailure(command, 1, error.code, error.message);
        throw error;
      }
    }
    if (command === 'entry/references' || command === 'macro/usages') {
      exactArguments(request.arguments, ['id']);
      const entityType = command.startsWith('entry/') ? 'entry' : 'macro';
      const id = stringArg(request.arguments, 'id')!;
      const entity = await getManagedEntity(request.root, entityType, id);
      if (!entity) return operationFailure(command, 1, 'entity.not-found', `${entityType} ${JSON.stringify(id)} does not exist.`);
      if (entityType === 'entry') return succeed(command, { items: await findEntityReferences(request.root, entityType, id) });
      const packageId = entity.value.package;
      const macroName = entity.value.name;
      if (typeof packageId !== 'string' || typeof macroName !== 'string') return operationFailure(command, 1, 'entity.invalid', `Macro ${JSON.stringify(id)} has no canonical package/name identity.`);
      const [config, macros, occurrences] = await Promise.all([
        readConfig(request.root),
        listManagedEntities(request.root, 'macro'),
        findEntityReferences(request.root, 'macro', macroName),
      ]);
      const active = config.active_macro_packages === undefined ? null : new Set(config.active_macro_packages);
      const winner = macros
        .filter(candidate => candidate.value.name === macroName && typeof candidate.value.package === 'string' && (!active || active.has(candidate.value.package)))
        .sort((left, right) => `${String(left.value.package)}.json`.localeCompare(`${String(right.value.package)}.json`))
        .at(-1);
      const definitionFile = macroEntityPath(packageId, macroName);
      const items = occurrences
        .filter(item => item.role === 'definition' ? item.file === definitionFile : winner?.id === id)
        .map(item => ({ ...item, id }));
      return succeed(command, { items });
    }
    const type = ENTITY_DOMAINS[tokens[0]];
    if (!type || tokens.length > 2) return operationFailure(command, 2, 'command.unknown', `Unknown command ${JSON.stringify(command)}.`);
    if (tokens.length === 1) {
      exactArguments(request.arguments, []);
      return succeed(command, COMMAND_PATHS.filter(item => item.startsWith(`${command}/`)).map(describeCommand));
    }
    const action = tokens[1];
    const args = request.arguments;
    if (action === 'list') {
      exactArguments(args, ['query', 'limit', 'cursor']);
      const query = stringArg(args, 'query', false)?.toLocaleLowerCase();
      const cursor = stringArg(args, 'cursor', false);
      const rawLimit = own(args, 'limit') ? args.limit : 100;
      if (!Number.isInteger(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 1000) throw new TypeError('limit must be an integer from 1 to 1000.');
      let entities = await listManagedEntities(request.root, type);
      if (query) entities = entities.filter(entity => entity.id.toLocaleLowerCase().includes(query) || JSON.stringify(entity.value).toLocaleLowerCase().includes(query));
      if (cursor) entities = entities.filter(entity => entity.id.localeCompare(cursor) > 0);
      const page = entities.slice(0, Number(rawLimit));
      return succeed(command, { entities: page, nextCursor: entities.length > page.length ? page.at(-1)?.id ?? null : null });
    }
    if (action === 'get') {
      exactArguments(args, ['id']); const id = stringArg(args, 'id')!;
      const entity = await getManagedEntity(request.root, type, id);
      return entity ? succeed(command, { entity }) : operationFailure(command, 1, 'entity.not-found', `${type} ${JSON.stringify(id)} does not exist.`);
    }
    if (action === 'create') {
      exactArguments(args, ['value']); if (!own(args, 'value')) throw new TypeError('value is required.');
      if (!isRecord(args.value)) return operationFailure(command, 1, 'entity.invalid', 'value must be an object.');
      try {
        const result = await createManagedEntity(request.root, type, args.value);
        return result.status === 'ok' ? succeed(command, { entity: result.entity }) : operationFailure(command, 1, result.code, result.message);
      } catch (error) {
        if (error instanceof TypeError) return operationFailure(command, 1, 'entity.invalid', error.message);
        throw error;
      }
    }
    if (action === 'update') {
      exactArguments(args, ['id', 'value', 'expectedRevision']); const id = stringArg(args, 'id')!; const revision = stringArg(args, 'expectedRevision')!;
      if (!own(args, 'value')) throw new TypeError('value is required.');
      if (!isRecord(args.value)) return operationFailure(command, 1, 'entity.invalid', 'value must be an object.');
      try {
        const result = await updateManagedEntity(request.root, type, id, args.value, revision);
        return result.status === 'ok' ? succeed(command, { entity: result.entity }) : operationFailure(command, 1, result.code, result.message);
      } catch (error) {
        if (error instanceof TypeError) return operationFailure(command, 1, 'entity.invalid', error.message);
        throw error;
      }
    }
    if (action === 'delete') {
      exactArguments(args, ['id', 'expectedRevision']); const id = stringArg(args, 'id')!; const revision = stringArg(args, 'expectedRevision')!;
      const result = await deleteManagedEntity(request.root, type, id, revision);
      return result.status === 'ok' ? succeed(command, { deleted: { type, id, revision: result.entity.revision } }) : operationFailure(command, 1, result.code, result.message);
    }
    return operationFailure(command, 2, 'command.unknown', `Unknown command ${JSON.stringify(command)}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isUnsupportedSchemaMessage(message)) return operationFailure(command, 2, 'workspace.unsupported-schema', message);
    if (error instanceof TypeError) return operationFailure(command, 2, 'operation.invalid-arguments', message);
    return operationFailure(command, 2, 'workspace.operation-failed', message);
  }
}
