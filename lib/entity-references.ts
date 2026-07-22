import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { assertSnlDoc, snlDocRoot } from './snl-doc.ts';
import { parseSnlSyntaxTree } from './snl-parser.ts';

export type EntityType = 'entry' | 'macro';
export type OccurrenceRole = 'definition' | 'reference';

export interface EntityOccurrence {
  entityType: EntityType;
  id: string;
  role: OccurrenceRole;
  file: string;
  path: string;
  offset?: number;
  snlLine?: number;
  snlColumn?: number;
}

export interface RenamePlan {
  entityType: EntityType;
  oldId: string;
  newId: string;
  occurrences: EntityOccurrence[];
  changedFiles: string[];
}

interface LoadedJson {
  absPath: string;
  relPath: string;
  raw: string;
  data: unknown;
}

interface SnlToken {
  type: 'ident' | 'at' | 'lparen' | 'rparen' | 'lbracket' | 'rbracket' | 'comma' | 'eq' | 'delimited';
  value: string;
  start: number;
  end: number;
}

interface SnlReference {
  entityType: EntityType;
  id: string;
  start: number;
  end: number;
}

/** Find definitions and structured references to one Entry or Macro identity. */
export async function findEntityReferences(
  workspaceRoot: string,
  entityType: EntityType,
  id: string,
): Promise<EntityOccurrence[]> {
  await assertSnlDoc(workspaceRoot);
  validateNonEmptyIdentity(id);
  const files = await loadWorkspaceJson(workspaceRoot);
  return collectOccurrences(files, entityType, id).sort(compareOccurrence);
}

/**
 * Rename one identity and every structured reference to it.
 *
 * All files are parsed and mutated in memory first. The function refuses a
 * missing/ambiguous source identity or a destination collision. Writes use
 * same-directory temp files; if any rename fails, already-replaced files are
 * restored from their original text before the error is rethrown.
 */
export async function renameEntityId(
  workspaceRoot: string,
  entityType: EntityType,
  oldId: string,
  newId: string,
  options: { dryRun?: boolean } = {},
): Promise<RenamePlan> {
  await assertSnlDoc(workspaceRoot);
  validateNonEmptyIdentity(oldId);
  validateNonEmptyIdentity(newId);
  if (entityType === 'macro' && /[@#$%\s()[\]{}]/u.test(newId)) {
    throw new Error(
      `Macro id '${newId}' contains a character forbidden by the SNL-Doc macro schema.`,
    );
  }
  if (oldId === newId) throw new Error('Old and new ids are identical.');

  const files = await loadWorkspaceJson(workspaceRoot);
  const occurrences = collectOccurrences(files, entityType, oldId).sort(compareOccurrence);
  const definitions = occurrences.filter((o) => o.role === 'definition');
  if (definitions.length === 0) {
    throw new Error(`No ${entityType} definition found for '${oldId}'.`);
  }
  if (definitions.length !== 1) {
    throw new Error(
      `Expected one ${entityType} definition for '${oldId}', found ${definitions.length}; resolve the identity collision before renaming.`,
    );
  }
  if (
    occurrences.some((o) => o.path.endsWith('.content.snl')) &&
    !isSnlIdentifier(newId)
  ) {
    throw new Error(
      `${entityType} id '${newId}' is not representable as an SNL identifier, but '${oldId}' has SNL references.`,
    );
  }
  const destinationOccurrences = collectOccurrences(files, entityType, newId);
  if (destinationOccurrences.length > 0) {
    throw new Error(
      `${entityType} id '${newId}' already appears in ${destinationOccurrences.length} structured location(s); refusing to merge two identities.`,
    );
  }

  const changed = new Map<string, LoadedJson>();
  for (const file of files) {
    if (mutateStructuredJson(file, entityType, oldId, newId)) {
      changed.set(file.absPath, file);
    }
  }

  const plan: RenamePlan = {
    entityType,
    oldId,
    newId,
    occurrences,
    changedFiles: [...changed.values()].map((f) => f.relPath).sort(),
  };
  if (options.dryRun || changed.size === 0) return plan;

  const replacements = [...changed.values()].map((file) => ({
    ...file,
    next: stringifyLike(file.raw, file.data),
    temp: `${file.absPath}.snl-rename-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`,
  }));
  try {
    await Promise.all(replacements.map((f) => fs.writeFile(f.temp, f.next, 'utf8')));
    const installed: typeof replacements = [];
    try {
      for (const file of replacements) {
        await fs.rename(file.temp, file.absPath);
        installed.push(file);
      }
    } catch (error) {
      await Promise.all(installed.map((f) => fs.writeFile(f.absPath, f.raw, 'utf8')));
      throw error;
    }
  } finally {
    await Promise.all(replacements.map((f) => fs.rm(f.temp, { force: true })));
  }
  return plan;
}

function collectOccurrences(
  files: LoadedJson[],
  entityType: EntityType,
  id: string,
): EntityOccurrence[] {
  const out: EntityOccurrence[] = [];
  for (const file of files) collectFileOccurrences(file, entityType, id, out);
  return out;
}

function collectFileOccurrences(
  file: LoadedJson,
  entityType: EntityType,
  id: string,
  out: EntityOccurrence[],
): void {
  const data = file.data as any;
  if (file.relPath === 'entries.json' && Array.isArray(data)) {
    data.forEach((entry: any, index: number) => {
      if (entityType === 'entry' && entry?.id === id) {
        out.push(occurrence(file, entityType, id, 'definition', `[${index}].id`));
      }
      const snl = entry?.content?.snl;
      if (typeof snl === 'string' && snl.trim() !== '') {
        for (const ref of scanSnlReferences(snl)) {
          if (ref.entityType !== entityType || ref.id !== id) continue;
          const pos = offsetPosition(snl, ref.start);
          out.push({
            ...occurrence(file, entityType, id, 'reference', `[${index}].content.snl`),
            offset: ref.start,
            snlLine: pos.line,
            snlColumn: pos.column,
          });
        }
      }
    });
    return;
  }

  if (file.relPath.startsWith('term_macros/')) {
    const macros = data?.macros;
    if (!macros || typeof macros !== 'object' || Array.isArray(macros)) return;
    for (const [macroId, macro] of Object.entries(macros) as Array<[string, any]>) {
      if (entityType === 'macro' && macroId === id) {
        out.push(occurrence(file, entityType, id, 'definition', `macros[${JSON.stringify(macroId)}]`));
      }
      if (entityType === 'entry' && Array.isArray(macro?.source?.entries)) {
        macro.source.entries.forEach((entryId: unknown, index: number) => {
          if (entryId === id) {
            out.push(
              occurrence(
                file,
                entityType,
                id,
                'reference',
                `macros[${JSON.stringify(macroId)}].source.entries[${index}]`,
              ),
            );
          }
        });
      }
    }
    return;
  }

  if (entityType !== 'entry') return;
  if (/^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node: any, index: number) => {
      if (node?.props?.entryId === id) {
        out.push(occurrence(file, entityType, id, 'reference', `nodes[${index}].props.entryId`));
      }
    });
  } else if (file.relPath === 'relationships.json' && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel: any, index: number) => {
      if (rel?.from === id) out.push(occurrence(file, entityType, id, 'reference', `relationships[${index}].from`));
      if (rel?.to === id) out.push(occurrence(file, entityType, id, 'reference', `relationships[${index}].to`));
    });
  }
}

function mutateStructuredJson(
  file: LoadedJson,
  entityType: EntityType,
  oldId: string,
  newId: string,
): boolean {
  let changed = false;
  const data = file.data as any;
  if (file.relPath === 'entries.json' && Array.isArray(data)) {
    for (const entry of data) {
      if (entityType === 'entry' && entry?.id === oldId) {
        entry.id = newId;
        changed = true;
      }
      if (typeof entry?.content?.snl === 'string' && entry.content.snl.trim() !== '') {
        const next = replaceSnlReferences(entry.content.snl, entityType, oldId, newId);
        if (next !== entry.content.snl) {
          entry.content.snl = next;
          changed = true;
        }
      }
    }
    return changed;
  }

  if (file.relPath.startsWith('term_macros/')) {
    const macros = data?.macros;
    if (!macros || typeof macros !== 'object' || Array.isArray(macros)) return false;
    if (entityType === 'macro' && Object.prototype.hasOwnProperty.call(macros, oldId)) {
      const renamed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(macros)) renamed[key === oldId ? newId : key] = value;
      data.macros = renamed;
      changed = true;
    }
    if (entityType === 'entry') {
      for (const macro of Object.values(data.macros) as any[]) {
        if (!Array.isArray(macro?.source?.entries)) continue;
        macro.source.entries = macro.source.entries.map((value: unknown) => {
          if (value === oldId) {
            changed = true;
            return newId;
          }
          return value;
        });
      }
    }
    return changed;
  }

  if (entityType !== 'entry') return false;
  if (/^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    for (const node of data.nodes) {
      if (node?.props?.entryId === oldId) {
        node.props.entryId = newId;
        changed = true;
      }
    }
  } else if (file.relPath === 'relationships.json' && Array.isArray(data?.relationships)) {
    for (const rel of data.relationships) {
      if (rel?.from === oldId) {
        rel.from = newId;
        changed = true;
      }
      if (rel?.to === oldId) {
        rel.to = newId;
        changed = true;
      }
    }
  }
  return changed;
}

export function scanSnlReferences(source: string): SnlReference[] {
  // Use the authority parser as the syntax gate. The source-preserving scanner
  // below exists only because the current AST does not retain token offsets.
  parseSnlSyntaxTree(source);
  const tokens = tokenizeSnl(source);
  const refs: SnlReference[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'ident') continue;
    const prev = tokens[i - 1];
    if (prev?.type === 'lbracket') continue; // style tag
    if (prev?.type === 'at' && isPostfixAt(tokens[i - 2])) {
      refs.push({ entityType: 'entry', id: token.value, start: token.start, end: token.end });
      continue;
    }
    if (/^\d+(?:\.\d+)*$/.test(token.value)) continue; // numeral literal
    refs.push({ entityType: 'macro', id: token.value, start: token.start, end: token.end });
  }
  return refs;
}

function replaceSnlReferences(
  source: string,
  entityType: EntityType,
  oldId: string,
  newId: string,
): string {
  const matches = scanSnlReferences(source).filter((r) => r.entityType === entityType && r.id === oldId);
  let next = source;
  for (const match of matches.reverse()) {
    next = next.slice(0, match.start) + newId + next.slice(match.end);
  }
  return next;
}

function isPostfixAt(previous: SnlToken | undefined): boolean {
  return previous !== undefined && ['ident', 'delimited', 'rparen', 'rbracket'].includes(previous.type);
}

function tokenizeSnl(source: string): SnlToken[] {
  const tokens: SnlToken[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '$' || ch === '%') {
      const delimiter = ch === '$' && source[i + 1] === '$' ? '$$' : ch;
      const close = source.indexOf(delimiter, i + delimiter.length);
      if (close < 0) throw new Error(`Malformed SNL: unclosed ${delimiter} delimiter at offset ${i}.`);
      tokens.push({ type: 'delimited', value: source.slice(i, close + delimiter.length), start: i, end: close + delimiter.length });
      i = close + delimiter.length;
      continue;
    }
    if (/[A-Za-z0-9_\\]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[A-Za-z0-9_.\-]/.test(source[i])) i++;
      tokens.push({ type: 'ident', value: source.slice(start, i), start, end: i });
      continue;
    }
    const punctuation: Record<string, SnlToken['type']> = {
      '@': 'at', '(': 'lparen', ')': 'rparen', '[': 'lbracket', ']': 'rbracket', ',': 'comma', '=': 'eq',
    };
    const type = punctuation[ch];
    if (!type) throw new Error(`Malformed SNL: unexpected character ${JSON.stringify(ch)} at offset ${i}.`);
    tokens.push({ type, value: ch, start: i, end: i + 1 });
    i++;
  }
  return tokens;
}

async function loadWorkspaceJson(workspaceRoot: string): Promise<LoadedJson[]> {
  const root = snlDocRoot(workspaceRoot);
  const candidates = ['entries.json', 'relationships.json'];

  const macroDir = path.join(root, 'term_macros');
  try {
    const macroFiles = await fs.readdir(macroDir, { withFileTypes: true });
    for (const entry of macroFiles) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        candidates.push(path.join('term_macros', entry.name));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const libraryRoot = path.join(root, 'libraries');
  try {
    const libraries = await fs.readdir(libraryRoot, { withFileTypes: true });
    for (const entry of libraries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        candidates.push(path.join('libraries', entry.name, 'graph.json'));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const unique = [...new Set(candidates)].sort();
  const loaded: LoadedJson[] = [];
  for (const relPath of unique) {
    const absPath = path.join(root, relPath);
    let raw: string;
    try {
      raw = await fs.readFile(absPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    try {
      loaded.push({ absPath, relPath: relPath.split(path.sep).join('/'), raw, data: JSON.parse(raw) });
    } catch (error) {
      throw new Error(`Failed to parse ${absPath}: ${(error as Error).message}`);
    }
  }
  return loaded;
}

function validateNonEmptyIdentity(id: string): void {
  if (id.trim() === '') throw new Error('Identity must be a non-empty string.');
}

function isSnlIdentifier(id: string): boolean {
  return /^[A-Za-z0-9_\\][A-Za-z0-9_.\-]*$/.test(id);
}

function occurrence(
  file: LoadedJson,
  entityType: EntityType,
  id: string,
  role: OccurrenceRole,
  jsonPath: string,
): EntityOccurrence {
  return { entityType, id, role, file: file.relPath, path: jsonPath };
}

function offsetPosition(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset).split('\n');
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

function stringifyLike(raw: string, data: unknown): string {
  const indentMatch = /\n([ \t]+)\S/.exec(raw);
  const indent = indentMatch?.[1] ?? '  ';
  return JSON.stringify(data, null, indent) + (raw.endsWith('\n') ? '\n' : '');
}

function compareOccurrence(a: EntityOccurrence, b: EntityOccurrence): number {
  return a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || (a.offset ?? -1) - (b.offset ?? -1);
}
