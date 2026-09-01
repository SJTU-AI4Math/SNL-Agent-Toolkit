import { computeEntryBareLatex, EntryAnalysisError } from '../lib/entry-analysis.ts';
import {
  createManagedEntity,
  deleteManagedEntity,
  getManagedEntity,
  isManagedEntityType,
  listManagedEntities,
  updateManagedEntity,
  validateManagedWorkspace,
  type ManagedEntityType,
} from '../lib/entity-crud.ts';
import { renderLibraryEntryTree, LibraryEntryTreeError } from '../lib/library-entry-tree.ts';
import { executeOperation } from '../src/cli/operation.ts';
import type {
  EntityAdapter,
  EntityApplyRequest,
  EntityGetRequest,
  EntityListRequest,
  EntryLatexRequest,
  LibraryEntryTreeRequest,
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

    async renderEntry(request: EntryLatexRequest) {
      try {
        const rendered = await computeEntryBareLatex(request.root, request.id);
        return { entryId: request.id, latex: rendered.output, notes: rendered.notes };
      } catch (error) {
        if (error instanceof EntryAnalysisError) {
          return {
            status: error.code === 'entry.not-found' ? 'not-found' : 'invalid',
            code: error.code,
            message: error.message,
          };
        }
        throw error;
      }
    },

    async renderLibraryTree(request: LibraryEntryTreeRequest) {
      try {
        return await renderLibraryEntryTree(request.root, request.librarySlug, {
          ...(request.language !== undefined ? { language: request.language } : {}),
          ...(request.includeEntryKind !== undefined ? { includeEntryKind: request.includeEntryKind } : {}),
          ...(request.includeNumber !== undefined ? { includeNumber: request.includeNumber } : {}),
          ...(request.includeTitle !== undefined ? { includeTitle: request.includeTitle } : {}),
          ...(request.includeEntryId !== undefined ? { includeEntryId: request.includeEntryId } : {}),
          ...(request.includeCounterId !== undefined ? { includeCounterId: request.includeCounterId } : {}),
        });
      } catch (error) {
        if (error instanceof LibraryEntryTreeError) {
          return {
            status: error.code === 'library.not-found' ? 'not-found' : 'invalid',
            code: error.code,
            message: error.message,
          };
        }
        throw error;
      }
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
      return validateManagedWorkspace(root);
    },

    async executeOperation(request) {
      return (await executeOperation(request)).response;
    },
  };
}

export default createEntityAdapter;
