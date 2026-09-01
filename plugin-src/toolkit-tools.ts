export const ENTITY_TYPES = [
  'entry-kind',
  'macro-kind',
  'entry-package',
  'macro-package',
  'entry',
  'macro',
  'relationship',
  'library',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type JsonObject = Record<string, unknown>;

export interface EntityListRequest {
  root: string;
  entityType: EntityType;
  query?: string;
  cursor?: string;
  limit?: number;
}

export interface EntityGetRequest {
  root: string;
  entityType: EntityType;
  id: string;
}

export interface EntryLatexRequest {
  root: string;
  id: string;
}

export interface LibraryEntryTreeRequest {
  root: string;
  librarySlug: string;
  language?: string;
  includeEntryKind?: boolean;
  includeNumber?: boolean;
  includeTitle?: boolean;
  includeEntryId?: boolean;
  includeCounterId?: boolean;
}

export interface EntityApplyRequest {
  root: string;
  entityType: EntityType;
  action: 'create' | 'update' | 'delete';
  id?: string;
  value?: JsonObject;
  expectedRevision?: string;
}

export interface StructuredOperationRequest {
  protocol: 'snl.operation/v1';
  root: string;
  command: string;
  arguments: JsonObject;
}

export interface EntityAdapter {
  list(request: EntityListRequest): Promise<unknown>;
  get(request: EntityGetRequest): Promise<unknown>;
  renderEntry?(request: EntryLatexRequest): Promise<unknown>;
  renderLibraryTree?(request: LibraryEntryTreeRequest): Promise<unknown>;
  apply(request: EntityApplyRequest): Promise<unknown>;
  validate(request: { root: string }): Promise<unknown>;
  executeOperation?(request: StructuredOperationRequest): Promise<unknown>;
}

export interface ToolkitTool {
  name: string;
  description: string;
  inputSchema: JsonObject;
  execute(input: unknown): Promise<unknown>;
}

function object(input: unknown): JsonObject {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('tool input must be an object');
  }
  return input as JsonObject;
}

function exactToolKeys(input: JsonObject, allowed: readonly string[]): void {
  const unknown = Object.keys(input).filter(key => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`unknown tool input key(s): ${unknown.join(', ')}`);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean`);
  return value;
}

function entityType(value: unknown): EntityType {
  if (!ENTITY_TYPES.includes(value as EntityType)) {
    throw new TypeError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
  }
  return value as EntityType;
}

const entityTypeSchema = { type: 'string', enum: [...ENTITY_TYPES] };
const baseProperties = { root: { type: 'string', description: 'Absolute path to the workspace root.' }, entityType: entityTypeSchema };

export function createToolkitTools(adapter: EntityAdapter): ToolkitTool[] {
  return [
    {
      name: 'snl_entities_list',
      description: 'List or search one kind of SNL entity in a workspace.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['root', 'entityType'],
        properties: { ...baseProperties, query: { type: 'string' }, cursor: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 200 } },
      },
      async execute(raw) {
        const input = object(raw);
        const request: EntityListRequest = {
          root: requiredString(input.root, 'root'), entityType: entityType(input.entityType),
          ...(input.query !== undefined ? { query: requiredString(input.query, 'query') } : {}),
          ...(input.cursor !== undefined ? { cursor: requiredString(input.cursor, 'cursor') } : {}),
          ...(input.limit !== undefined ? { limit: input.limit as number } : {}),
        };
        if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 200)) {
          throw new TypeError('limit must be an integer from 1 through 200');
        }
        return adapter.list(request);
      },
    },
    {
      name: 'snl_entity_get',
      description: 'Read one SNL entity and its revision token.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['root', 'entityType', 'id'],
        properties: { ...baseProperties, id: { type: 'string' } },
      },
      async execute(raw) {
        const input = object(raw);
        return adapter.get({
          root: requiredString(input.root, 'root'), entityType: entityType(input.entityType),
          id: requiredString(input.id, 'id'),
        });
      },
    },
    {
      name: 'snl_entry_latex',
      description: 'Render one Entry as directly assembled bare LaTeX without htmlData wrappers; block macros become macro-name(rendered subtrees) placeholders.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['root', 'id'],
        properties: { root: baseProperties.root, id: { type: 'string', description: 'Canonical Entry id.' } },
      },
      async execute(raw) {
        const input = object(raw);
        if (!adapter.renderEntry) {
          return {
            status: 'unsupported', code: 'entry.render-unsupported',
            message: 'This SNL entity adapter does not implement Entry LaTeX rendering.',
          };
        }
        return adapter.renderEntry({
          root: requiredString(input.root, 'root'), id: requiredString(input.id, 'id'),
        });
      },
    },
    {
      name: 'snl_library_entry_tree',
      description: 'Print one Library hierarchy as a folder-style multiline Entry tree with configurable fields and language.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['root', 'librarySlug'],
        properties: {
          root: baseProperties.root,
          librarySlug: { type: 'string', description: 'Canonical Library slug.' },
          language: { type: 'string', description: 'Preferred language tag for localized Entry Kind names and titles.' },
          includeEntryKind: { type: 'boolean', description: 'Include [Entry Kind]. Default true.' },
          includeNumber: { type: 'boolean', description: 'Include the resolved Library counter number. Default true.' },
          includeTitle: { type: 'boolean', description: 'Include the localized Entry title. Default true.' },
          includeEntryId: { type: 'boolean', description: 'Include <entry id>. Default true.' },
          includeCounterId: { type: 'boolean', description: 'Include (counter id: ...). Default true.' },
        },
      },
      async execute(raw) {
        const input = object(raw);
        if (!adapter.renderLibraryTree) {
          return {
            status: 'unsupported', code: 'library.tree-unsupported',
            message: 'This SNL entity adapter does not implement Library Entry tree rendering.',
          };
        }
        const request: LibraryEntryTreeRequest = {
          root: requiredString(input.root, 'root'),
          librarySlug: requiredString(input.librarySlug, 'librarySlug'),
          ...(input.language !== undefined ? { language: requiredString(input.language, 'language') } : {}),
        };
        for (const name of ['includeEntryKind', 'includeNumber', 'includeTitle', 'includeEntryId', 'includeCounterId'] as const) {
          const value = optionalBoolean(input[name], name);
          if (value !== undefined) request[name] = value;
        }
        return adapter.renderLibraryTree(request);
      },
    },
    {
      name: 'snl_entity_apply',
      description: 'Create, update, or delete one SNL entity through the authoritative entity adapter.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['root', 'entityType', 'action'],
        properties: {
          ...baseProperties,
          action: { type: 'string', enum: ['create', 'update', 'delete'] },
          id: { type: 'string' }, value: { type: 'object' }, expectedRevision: { type: 'string' },
        },
      },
      async execute(raw) {
        const input = object(raw);
        if (!['create', 'update', 'delete'].includes(input.action as string)) {
          throw new TypeError('action must be create, update, or delete');
        }
        return adapter.apply({
          root: requiredString(input.root, 'root'), entityType: entityType(input.entityType),
          action: input.action as EntityApplyRequest['action'],
          ...(input.id !== undefined ? { id: requiredString(input.id, 'id') } : {}),
          ...(input.value !== undefined ? { value: object(input.value) } : {}),
          ...(input.expectedRevision !== undefined ? { expectedRevision: requiredString(input.expectedRevision, 'expectedRevision') } : {}),
        });
      },
    },
    {
      name: 'snl_workspace_validate',
      description: 'Validate an SNL workspace and return structured issues without modifying it.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['root'],
        properties: { root: baseProperties.root },
      },
      async execute(raw) {
        const input = object(raw);
        return adapter.validate({ root: requiredString(input.root, 'root') });
      },
    },
    {
      name: 'snl_execute',
      description: 'Execute one canonical SNL operation through the same strict request/result protocol as the unified snl CLI.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['root', 'command', 'arguments'],
        properties: {
          root: baseProperties.root,
          command: { type: 'string', description: 'Canonical command path such as entry/get or validate.' },
          arguments: { type: 'object', additionalProperties: true, description: 'Command-specific argument object.' },
        },
      },
      async execute(raw) {
        const input = object(raw);
        exactToolKeys(input, ['root', 'command', 'arguments']);
        const request: StructuredOperationRequest = {
          protocol: 'snl.operation/v1',
          root: requiredString(input.root, 'root'),
          command: requiredString(input.command, 'command'),
          arguments: object(input.arguments),
        };
        if (!adapter.executeOperation) {
          return {
            protocol: 'snl.result/v1', ok: false, command: request.command,
            error: { code: 'operation.unsupported', message: 'This adapter does not implement the unified operation protocol.', retryable: false },
          };
        }
        return adapter.executeOperation(request);
      },
    },
  ];
}
