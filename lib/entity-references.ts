import { constants } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  findNodeAtLocation,
  parseTree,
  printParseErrorCode,
  type JSONPath,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser';
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
  tree: JsonNode;
  mode: number;
  device: number;
  inode: number;
}

interface TextEdit {
  offset: number;
  length: number;
  content: string;
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
 * All schema-owned files are parsed and source-range edits are planned before
 * any write. The function refuses a missing/ambiguous source identity, a
 * destination collision, malformed schema/SNL, symlinked files, or concurrent
 * source changes. Writes use same-directory temp files; if a replacement
 * fails, already-installed files are restored before the error is rethrown.
 * This rollback protocol is not crash-atomic across multiple files.
 */
export async function renameEntityId(
  workspaceRoot: string,
  entityType: EntityType,
  oldId: string,
  newId: string,
  options: { dryRun?: boolean; beforeInstall?: () => void | Promise<void> } = {},
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
    !isTraceableSnlIdentity(entityType, newId)
  ) {
    throw new Error(
      `${entityType} id '${newId}' is not representable as an SNL identifier, but '${oldId}' has SNL references.`,
    );
  }
  const destinationOccurrences = collectOccurrences(files, entityType, newId, {
    includeUnresolvedMacroTokens: entityType === 'macro',
  });
  if (destinationOccurrences.length > 0) {
    throw new Error(
      `${entityType} id '${newId}' already appears in ${destinationOccurrences.length} structured location(s); refusing to merge two identities.`,
    );
  }

  const rewriteSnlMacroTokens = entityType !== 'macro' || macroIsActive(files, oldId);
  const changed = new Map<string, LoadedJson & { next: string }>();
  for (const file of files) {
    const edits = buildStructuredEdits(
      file, entityType, oldId, newId, rewriteSnlMacroTokens,
    );
    if (edits.length > 0) {
      changed.set(file.absPath, { ...file, next: applyTextEdits(file.raw, edits) });
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
    temp: `${file.absPath}.snl-rename-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`,
  }));
  try {
    await Promise.all(
      replacements.map(async (file) => {
        await fs.writeFile(file.temp, file.next, {
          encoding: 'utf8', mode: file.mode, flag: 'wx',
        });
        await fs.chmod(file.temp, file.mode);
      }),
    );
    if (options.beforeInstall) await options.beforeInstall();
    // Optimistic concurrency + symlink defense: refuse to install if any
    // source changed since planning. This cannot make a multi-file commit
    // crash-atomic, but it prevents silently overwriting cooperative edits.
    for (const file of replacements) await assertUnchangedRegularFile(file);

    const installed: typeof replacements = [];
    try {
      for (const file of replacements) {
        await fs.rename(file.temp, file.absPath);
        installed.push(file);
      }
      const verifiedFiles = await loadWorkspaceJson(workspaceRoot);
      const stale = collectOccurrences(verifiedFiles, entityType, oldId);
      const current = collectOccurrences(verifiedFiles, entityType, newId);
      const currentDefinitions = current.filter((o) => o.role === 'definition');
      if (stale.length !== 0 || current.length !== occurrences.length || currentDefinitions.length !== 1) {
        throw new Error(
          `Post-write verification failed: old=${stale.length}, new=${current.length}, definitions=${currentDefinitions.length}, expected=${occurrences.length}.`,
        );
      }
    } catch (error) {
      await Promise.all(installed.map((f) => fs.writeFile(f.absPath, f.raw, { encoding: 'utf8', mode: f.mode })));
      throw error;
    }
  } finally {
    await Promise.all(replacements.map((f) => fs.rm(f.temp, { force: true })));
  }
  return plan;
}

function macroIsActive(files: LoadedJson[], id: string): boolean {
  const config = files.find((file) => file.relPath === 'config.json')?.data as any;
  const active = Array.isArray(config?.active_macro_packages)
    ? new Set<string>(config.active_macro_packages)
    : null;
  return files.some((file) => {
    if (!file.relPath.startsWith('term_macros/')) return false;
    const bare = path.posix.basename(file.relPath, '.json');
    if (active && !active.has(bare)) return false;
    const macros = (file.data as any)?.macros;
    return isRecord(macros) && Object.prototype.hasOwnProperty.call(macros, id);
  });
}

function collectOccurrences(
  files: LoadedJson[],
  entityType: EntityType,
  id: string,
  options: { includeUnresolvedMacroTokens?: boolean } = {},
): EntityOccurrence[] {
  const out: EntityOccurrence[] = [];
  const includeSnlMacroTokens =
    entityType !== 'macro' ||
    options.includeUnresolvedMacroTokens === true ||
    macroIsActive(files, id);
  for (const file of files) {
    collectFileOccurrences(file, entityType, id, out, includeSnlMacroTokens);
  }
  return out;
}

function collectFileOccurrences(
  file: LoadedJson,
  entityType: EntityType,
  id: string,
  out: EntityOccurrence[],
  includeSnlMacroTokens: boolean,
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
          if (entityType === 'macro' && !includeSnlMacroTokens) continue;
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

  if (entityType === 'entry' && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node: any, index: number) => {
      if (node?.props?.entryId === id) {
        out.push(occurrence(file, entityType, id, 'reference', `nodes[${index}].props.entryId`));
      }
    });
  } else if (file.relPath === 'relationships.json' && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel: any, index: number) => {
      if (entityType === 'entry' && rel?.from === id) {
        out.push(occurrence(file, entityType, id, 'reference', `relationships[${index}].from`));
      }
      if (entityType === 'entry' && rel?.to === id) {
        out.push(occurrence(file, entityType, id, 'reference', `relationships[${index}].to`));
      }
      if (rel?.metadata?.generator !== 'macro-source-scan') return;
      const witnessField = entityType === 'macro' ? 'macros' : 'postfixes';
      const witnesses = rel.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value: unknown, witnessIndex: number) => {
        if (value === id) {
          out.push(
            occurrence(
              file,
              entityType,
              id,
              'reference',
              `relationships[${index}].metadata.${witnessField}[${witnessIndex}]`,
            ),
          );
        }
      });
    });
  }
}

function buildStructuredEdits(
  file: LoadedJson,
  entityType: EntityType,
  oldId: string,
  newId: string,
  rewriteSnlMacroTokens: boolean,
): TextEdit[] {
  const edits: TextEdit[] = [];
  const data = file.data as any;
  if (file.relPath === 'entries.json' && Array.isArray(data)) {
    data.forEach((entry: any, index: number) => {
      if (entityType === 'entry' && entry?.id === oldId) {
        edits.push(stringValueEdit(file, [index, 'id'], newId));
      }
      if (
        typeof entry?.content?.snl === 'string' &&
        entry.content.snl.trim() !== '' &&
        (entityType !== 'macro' || rewriteSnlMacroTokens)
      ) {
        const next = replaceSnlReferences(entry.content.snl, entityType, oldId, newId);
        if (next !== entry.content.snl) {
          edits.push(stringValueEdit(file, [index, 'content', 'snl'], next));
        }
      }
    });
    return edits;
  }

  if (file.relPath.startsWith('term_macros/')) {
    const macros = data?.macros;
    if (!macros || typeof macros !== 'object' || Array.isArray(macros)) return edits;
    if (entityType === 'macro' && Object.prototype.hasOwnProperty.call(macros, oldId)) {
      edits.push(propertyKeyEdit(file, ['macros', oldId], newId));
    }
    if (entityType === 'entry') {
      for (const [macroId, macro] of Object.entries(macros) as Array<[string, any]>) {
        if (!Array.isArray(macro?.source?.entries)) continue;
        macro.source.entries.forEach((value: unknown, index: number) => {
          if (value === oldId) {
            edits.push(stringValueEdit(file, ['macros', macroId, 'source', 'entries', index], newId));
          }
        });
      }
    }
    return edits;
  }

  if (entityType === 'entry' && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node: any, index: number) => {
      if (node?.props?.entryId === oldId) {
        edits.push(stringValueEdit(file, ['nodes', index, 'props', 'entryId'], newId));
      }
    });
  } else if (file.relPath === 'relationships.json' && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel: any, index: number) => {
      if (entityType === 'entry' && rel?.from === oldId) {
        edits.push(stringValueEdit(file, ['relationships', index, 'from'], newId));
      }
      if (entityType === 'entry' && rel?.to === oldId) {
        edits.push(stringValueEdit(file, ['relationships', index, 'to'], newId));
      }
      if (rel?.metadata?.generator !== 'macro-source-scan') return;
      const witnessField = entityType === 'macro' ? 'macros' : 'postfixes';
      const witnesses = rel.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value: unknown, witnessIndex: number) => {
        if (value === oldId) {
          edits.push(
            stringValueEdit(
              file,
              ['relationships', index, 'metadata', witnessField, witnessIndex],
              newId,
            ),
          );
        }
      });
    });
  }
  return edits;
}

function stringValueEdit(file: LoadedJson, jsonPath: JSONPath, value: string): TextEdit {
  const node = findNodeAtLocation(file.tree, jsonPath);
  if (!node || node.type !== 'string') {
    throw new Error(`${file.absPath}: expected string at ${JSON.stringify(jsonPath)}.`);
  }
  return { offset: node.offset, length: node.length, content: JSON.stringify(value) };
}

function propertyKeyEdit(file: LoadedJson, valuePath: JSONPath, key: string): TextEdit {
  const valueNode = findNodeAtLocation(file.tree, valuePath);
  const keyNode = valueNode?.parent?.children?.[0];
  if (!valueNode || valueNode.parent?.type !== 'property' || !keyNode || keyNode.type !== 'string') {
    throw new Error(`${file.absPath}: expected property at ${JSON.stringify(valuePath)}.`);
  }
  return { offset: keyNode.offset, length: keyNode.length, content: JSON.stringify(key) };
}

function applyTextEdits(raw: string, edits: TextEdit[]): string {
  const ordered = [...edits].sort((a, b) => b.offset - a.offset);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i - 1].offset < ordered[i].offset + ordered[i].length) {
      throw new Error('Internal error: overlapping JSON source edits.');
    }
  }
  let next = raw;
  for (const edit of ordered) {
    next = next.slice(0, edit.offset) + edit.content + next.slice(edit.offset + edit.length);
  }
  return next;
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
  const candidates = ['config.json', 'entries.json', 'relationships.json'];

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
    let stat;
    let handle;
    try {
      handle = await fs.open(absPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      stat = await handle.stat();
      if (!stat.isFile()) {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      raw = await handle.readFile('utf8');
    } catch (error) {
      if (handle) await handle.close();
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      throw error;
    }
    await handle.close();
    const errors: ParseError[] = [];
    const tree = parseTree(raw, errors, { disallowComments: true, allowTrailingComma: false });
    if (!tree || errors.length > 0) {
      const detail = errors.map((e) => `${printParseErrorCode(e.error)}@${e.offset}`).join(', ');
      throw new Error(`Failed to parse ${absPath}: ${detail || 'empty JSON document'}`);
    }
    validateNoDuplicateKeys(tree, absPath);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse ${absPath}: ${(error as Error).message}`);
    }
    const rel = relPath.split(path.sep).join('/');
    validateSchemaShape(absPath, rel, data);
    loaded.push({
      absPath,
      relPath: rel,
      raw,
      data,
      tree,
      mode: stat.mode,
      device: stat.dev,
      inode: stat.ino,
    });
  }
  return loaded;
}

function validateNoDuplicateKeys(node: JsonNode, absPath: string): void {
  if (node.type === 'object') {
    const seen = new Set<string>();
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
      if (typeof key !== 'string') continue;
      if (seen.has(key)) {
        throw new Error(`${absPath}: duplicate JSON property ${JSON.stringify(key)} is not safe to migrate.`);
      }
      seen.add(key);
    }
  }
  for (const child of node.children ?? []) validateNoDuplicateKeys(child, absPath);
}

function validateSchemaShape(absPath: string, relPath: string, data: unknown): void {
  const value = data as any;
  const fail = (message: string): never => {
    throw new Error(`${absPath}: ${message}`);
  };
  if (relPath === 'config.json') {
    if (!isRecord(value)) fail('config.json must be an object.');
    if (
      value.active_macro_packages !== undefined &&
      (!Array.isArray(value.active_macro_packages) ||
        !value.active_macro_packages.every((item: unknown) => typeof item === 'string'))
    ) {
      fail('config.active_macro_packages must be a string array when present.');
    }
    return;
  }
  if (relPath === 'entries.json') {
    if (!Array.isArray(value)) fail('entries.json must be an array.');
    value.forEach((entry: any, index: number) => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !isRecord(entry.content)) {
        fail(`entry ${index} must contain string id and object content.`);
      }
      if (entry.content.snl !== undefined && typeof entry.content.snl !== 'string') {
        fail(`entry ${index} content.snl must be a string when present.`);
      }
    });
    return;
  }
  if (relPath.startsWith('term_macros/')) {
    if (!isRecord(value) || !isRecord(value.macros)) fail('macro package must contain an object macros map.');
    for (const [name, macro] of Object.entries(value.macros) as Array<[string, any]>) {
      if (!isRecord(macro) || !isRecord(macro.source) || !Array.isArray(macro.source.entries)) {
        fail(`macro ${JSON.stringify(name)} must contain source.entries[].`);
      }
      if (!macro.source.entries.every((item: unknown) => typeof item === 'string')) {
        fail(`macro ${JSON.stringify(name)} source.entries must contain only strings.`);
      }
    }
    return;
  }
  if (/^libraries\/[^/]+\/graph\.json$/.test(relPath)) {
    if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.relationships)) {
      fail('Library graph must contain nodes[] and relationships[].');
    }
    value.nodes.forEach((node: any, index: number) => {
      if (!isRecord(node) || !isRecord(node.props)) fail(`graph node ${index} must contain object props.`);
      if (node.props.entryId !== undefined && typeof node.props.entryId !== 'string') {
        fail(`graph node ${index} props.entryId must be a string when present.`);
      }
    });
    return;
  }
  if (relPath === 'relationships.json') {
    if (!isRecord(value) || !Array.isArray(value.relationships)) {
      fail('relationships.json must contain relationships[].');
    }
    value.relationships.forEach((rel: any, index: number) => {
      if (!isRecord(rel) || typeof rel.from !== 'string' || typeof rel.to !== 'string') {
        fail(`relationship ${index} must contain string from/to.`);
      }
      if (isRecord(rel.metadata) && rel.metadata.generator === 'macro-source-scan') {
        for (const field of ['macros', 'postfixes']) {
          const values = rel.metadata[field];
          if (values !== undefined && (!Array.isArray(values) || !values.every((v) => typeof v === 'string'))) {
            fail(`relationship ${index} metadata.${field} must be a string array when present.`);
          }
        }
      }
    });
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function assertUnchangedRegularFile(
  file: Pick<LoadedJson, 'absPath' | 'raw' | 'device' | 'inode'>,
): Promise<void> {
  const stat = await fs.lstat(file.absPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== file.device || stat.ino !== file.inode) {
    throw new Error(`${file.absPath} changed identity or became a symlink during rename planning.`);
  }
  if ((await fs.readFile(file.absPath, 'utf8')) !== file.raw) {
    throw new Error(`${file.absPath} changed during rename planning; refusing to overwrite it.`);
  }
}

function validateNonEmptyIdentity(id: string): void {
  if (id.trim() === '') throw new Error('Identity must be a non-empty string.');
}

function isTraceableSnlIdentity(entityType: EntityType, id: string): boolean {
  const pattern = entityType === 'macro'
    ? /^[A-Za-z_\\][A-Za-z0-9_.\-]*$/
    : /^[A-Za-z0-9_\\][A-Za-z0-9_.\-]*$/;
  return pattern.test(id);
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

function compareOccurrence(a: EntityOccurrence, b: EntityOccurrence): number {
  return a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || (a.offset ?? -1) - (b.offset ?? -1);
}
