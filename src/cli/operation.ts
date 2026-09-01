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
import { computeEntryBareLatex } from '../../lib/entry-analysis.ts';
import { findEntityReferences } from '../../lib/entity-references.ts';

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
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
export const operationFailure = (command: string, exitCode: 1 | 2, code: string, message: string, details?: unknown): ExecutedOperation => ({
  exitCode,
  response: { protocol: RESULT_PROTOCOL, ok: false, command, error: { code, message, ...(details === undefined ? {} : { details }), retryable: code.endsWith('revision-conflict') || code.endsWith('locked') } },
});
const succeed = (command: string, data: unknown): ExecutedOperation => ({ exitCode: 0, response: { protocol: RESULT_PROTOCOL, ok: true, command, data, diagnostics: [] } });
function stringArg(args: JsonObject, name: string, required = true): string | undefined {
  const value = args[name];
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && value.length === 0)) throw new TypeError(`${name} must be ${required ? 'a non-empty' : 'a'} string.`);
  return value;
}
function exactArguments(args: JsonObject, allowed: readonly string[]): void {
  const unknown = Object.keys(args).filter(key => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`Unknown argument key(s): ${unknown.join(', ')}.`);
}

export async function executeOperation(request: OperationRequest): Promise<ExecutedOperation> {
  const command = request.command;
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
      exactArguments(request.arguments, []);
      const validation = await validateManagedWorkspace(request.root);
      return validation.valid ? succeed(command, validation) : operationFailure(command, 1, 'workspace.invalid', 'Workspace validation reported errors.', validation);
    }
    if (tokens.length === 1 && command === 'info') {
      exactArguments(request.arguments, []);
      const [config, validation] = await Promise.all([readConfig(request.root), validateManagedWorkspace(request.root)]);
      return succeed(command, { root: path.resolve(request.root), version: config.version, counts: validation.counts, valid: validation.valid, protocol: OPERATION_PROTOCOL });
    }
    if (command === 'snoogl') {
      exactArguments(request.arguments, ['mode', 'query']);
      const mode = stringArg(request.arguments, 'mode');
      if (mode !== 'entry' && mode !== 'macro') throw new TypeError('mode must be entry or macro.');
      return succeed(command, await querySnoogl(request.root, mode, stringArg(request.arguments, 'query')!));
    }
    if (command === 'entry/latex') {
      exactArguments(request.arguments, ['id']);
      const rendered = await computeEntryBareLatex(request.root, stringArg(request.arguments, 'id')!);
      return succeed(command, { latex: rendered.output, notes: rendered.notes });
    }
    if (command === 'entry/references' || command === 'macro/usages') {
      exactArguments(request.arguments, ['id']);
      const entityType = command.startsWith('entry/') ? 'entry' : 'macro';
      return succeed(command, { items: await findEntityReferences(request.root, entityType, stringArg(request.arguments, 'id')!) });
    }
    const type = ENTITY_DOMAINS[tokens[0]];
    if (!type || tokens.length > 2) return operationFailure(command, 2, 'command.unknown', `Unknown command ${JSON.stringify(command)}.`);
    if (tokens.length === 1) {
      exactArguments(request.arguments, []);
      return succeed(command, { commands: ['list', 'get', 'create', 'update', 'delete'].map(action => `${command}/${action}`) });
    }
    const action = tokens[1];
    const args = request.arguments;
    if (action === 'list') {
      exactArguments(args, ['query', 'limit', 'cursor']);
      const query = stringArg(args, 'query', false)?.toLocaleLowerCase();
      const cursor = stringArg(args, 'cursor', false);
      const rawLimit = args.limit ?? 100;
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
      const result = await createManagedEntity(request.root, type, args.value);
      return result.status === 'ok' ? succeed(command, { entity: result.entity }) : operationFailure(command, 1, result.code, result.message);
    }
    if (action === 'update') {
      exactArguments(args, ['id', 'value', 'expectedRevision']); const id = stringArg(args, 'id')!; const revision = stringArg(args, 'expectedRevision')!;
      if (!own(args, 'value')) throw new TypeError('value is required.');
      const result = await updateManagedEntity(request.root, type, id, args.value, revision);
      return result.status === 'ok' ? succeed(command, { entity: result.entity }) : operationFailure(command, 1, result.code, result.message);
    }
    if (action === 'delete') {
      exactArguments(args, ['id', 'expectedRevision']); const id = stringArg(args, 'id')!; const revision = stringArg(args, 'expectedRevision')!;
      const result = await deleteManagedEntity(request.root, type, id, revision);
      return result.status === 'ok' ? succeed(command, { deleted: { type, id, revision: result.entity.revision } }) : operationFailure(command, 1, result.code, result.message);
    }
    return operationFailure(command, 2, 'command.unknown', `Unknown command ${JSON.stringify(command)}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof TypeError) return operationFailure(command, 2, 'operation.invalid-arguments', message);
    return operationFailure(command, 2, 'workspace.operation-failed', message);
  }
}
