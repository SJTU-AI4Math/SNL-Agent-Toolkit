import {
  ENTITY_TYPES,
  createManagedEntity,
  deleteManagedEntity,
  getManagedEntity,
  isManagedEntityType,
  listManagedEntities,
  updateManagedEntity,
  type ManagedEntityType,
} from '../lib/entity-crud.ts';
import type {
  EntityAdapter,
  EntityApplyRequest,
  EntityGetRequest,
  EntityListRequest,
} from './toolkit-tools.ts';

function typeOf(value: string): ManagedEntityType {
  if (!isManagedEntityType(value)) throw new TypeError(`Unsupported SNL entity type: ${value}`);
  return value;
}

function queryText(value: unknown): string {
  return JSON.stringify(value).toLocaleLowerCase();
}

export function createEntityAdapter(): EntityAdapter {
  return {
    async list(request: EntityListRequest) {
      const type = typeOf(request.entityType);
      let entities = await listManagedEntities(request.root, type);
      if (request.query) {
        const needle = request.query.toLocaleLowerCase();
        entities = entities.filter((entity) => entity.id.toLocaleLowerCase().includes(needle) || queryText(entity.value).includes(needle));
      }
      if (request.cursor) entities = entities.filter((entity) => entity.id.localeCompare(request.cursor!) > 0);
      const limit = request.limit ?? 100;
      const page = entities.slice(0, limit);
      return {
        entities: page,
        nextCursor: entities.length > page.length ? page.at(-1)?.id ?? null : null,
      };
    },

    async get(request: EntityGetRequest) {
      const entity = await getManagedEntity(request.root, typeOf(request.entityType), request.id);
      if (!entity) return { status: 'not-found', code: 'entity.not-found', message: `${request.entityType} ${JSON.stringify(request.id)} does not exist.` };
      return { entity, revision: entity.revision };
    },

    async apply(request: EntityApplyRequest) {
      const type = typeOf(request.entityType);
      if (request.action === 'create') {
        if (!request.value) return { status: 'invalid', code: 'entity.value-required', message: 'create requires value.' };
        return createManagedEntity(request.root, type, request.value);
      }
      if (!request.id) return { status: 'invalid', code: 'entity.id-required', message: `${request.action} requires id.` };
      if (!request.expectedRevision) {
        return { status: 'invalid', code: 'entity.revision-required', message: `${request.action} requires expectedRevision from snl_entity_get.` };
      }
      return request.action === 'update'
        ? updateManagedEntity(request.root, type, request.id, request.value, request.expectedRevision)
        : deleteManagedEntity(request.root, type, request.id, request.expectedRevision);
    },

    async validate({ root }: { root: string }) {
      const counts: Record<string, number> = Object.create(null) as Record<string, number>;
      for (const type of ENTITY_TYPES) counts[type] = (await listManagedEntities(root, type)).length;
      return { valid: true, counts, issues: [] };
    },
  };
}

export default createEntityAdapter;
