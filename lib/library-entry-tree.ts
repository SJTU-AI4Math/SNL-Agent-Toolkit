import {
  readEntries,
  readEntryKinds,
  readLibraryCounters,
  readLibraryGraph,
  readLibraryMeta,
} from './snl-doc.ts';
export type { CounterNode } from './snl-doc-schema.ts';

import type {
  EntryData,
  CounterNode,
  EntryKind,
  GraphNode,
  LibraryGraph,
  LocalizedString,
} from './snl-doc-schema.ts';

export interface LibraryEntryTreeOptions {
  includeEntryKind?: boolean;
  includeNumber?: boolean;
  includeTitle?: boolean;
  includeEntryId?: boolean;
  includeCounterId?: boolean;
  /** Preferred language for localized Entry Kind names and Entry titles. */
  language?: string;
}

export interface FormatLibraryEntryTreeInput {
  graph: LibraryGraph;
  entries: EntryData[];
  kinds: EntryKind[];
  counters: CounterNode[];
  options?: LibraryEntryTreeOptions;
}

type ResolvedOptions = Required<Omit<LibraryEntryTreeOptions, 'language'>> & { language?: string };
type GraphIndex = {
  nodesById: Map<string, GraphNode>;
  childrenOf: Map<string, string[]>;
  roots: string[];
  readingOrder: string[];
};

const DEFAULT_OPTIONS: ResolvedOptions = {
  includeEntryKind: true,
  includeNumber: true,
  includeTitle: true,
  includeEntryId: true,
  includeCounterId: true,
};

const SLOT_CHARS = new Set(['1', 'A', 'a', 'I', 'i']);

export class LibraryEntryTreeError extends Error {
  public constructor(public readonly code: 'library.not-found' | 'library.invalid', message: string) {
    super(message);
    this.name = 'LibraryEntryTreeError';
  }
}

export interface LibraryEntryTreeResult {
  librarySlug: string;
  title: string;
  tree: string;
  lineCount: number;
}

export async function renderLibraryEntryTree(
  root: string,
  librarySlug: string,
  options?: LibraryEntryTreeOptions,
): Promise<LibraryEntryTreeResult> {
  if (!librarySlug || librarySlug === '.' || librarySlug === '..' || /[\\/]/.test(librarySlug)) {
    throw new LibraryEntryTreeError('library.invalid', 'Library slug must be one safe path segment.');
  }
  try {
    const [graph, counters, entries, kinds, meta] = await Promise.all([
      readLibraryGraph(root, librarySlug),
      readLibraryCounters(root, librarySlug),
      readEntries(root),
      readEntryKinds(root),
      readLibraryMeta(root, librarySlug),
    ]);
    if (!graph) {
      throw new LibraryEntryTreeError('library.not-found', `Library not found: ${librarySlug}`);
    }
    const tree = formatLibraryEntryTree({ graph, entries, kinds, counters, options });
    return {
      librarySlug,
      title: meta?.title ?? librarySlug,
      tree,
      lineCount: tree ? tree.split('\n').length : 0,
    };
  } catch (error) {
    if (error instanceof LibraryEntryTreeError) throw error;
    throw new LibraryEntryTreeError(
      'library.invalid',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function formatLibraryEntryTree(input: FormatLibraryEntryTreeInput): string {
  const options: ResolvedOptions = {
    includeEntryKind: input.options?.includeEntryKind ?? DEFAULT_OPTIONS.includeEntryKind,
    includeNumber: input.options?.includeNumber ?? DEFAULT_OPTIONS.includeNumber,
    includeTitle: input.options?.includeTitle ?? DEFAULT_OPTIONS.includeTitle,
    includeEntryId: input.options?.includeEntryId ?? DEFAULT_OPTIONS.includeEntryId,
    includeCounterId: input.options?.includeCounterId ?? DEFAULT_OPTIONS.includeCounterId,
    ...(input.options?.language !== undefined ? { language: input.options.language } : {}),
  };
  const enabledFields = [
    options.includeEntryKind, options.includeNumber, options.includeTitle,
    options.includeEntryId, options.includeCounterId,
  ];
  if (!enabledFields.some(Boolean)) {
    throw new Error('Enable at least one Library Entry tree field.');
  }
  if (options.language !== undefined && !options.language.trim()) {
    throw new Error('language must be a non-empty language tag when provided.');
  }

  const index = indexGraph(input.graph);
  const entries = uniqueMap(input.entries, 'Entry', (entry) => entry.id);
  const kinds = uniqueMap(input.kinds, 'Entry Kind', (kind) => kind.id);
  const counterPaths = indexCounterPaths(input.counters);
  const numbers = numberNodes(index, entries, kinds, input.counters, counterPaths);
  const activeCounters = new Map<string, CounterNode | null>();
  for (const nodeId of index.readingOrder) {
    const node = index.nodesById.get(nodeId)!;
    activeCounters.set(nodeId, resolveCounter(node, entries, kinds, input.counters));
  }

  const lines: string[] = [];
  const render = (nodeId: string, prefix: string, last: boolean): void => {
    const node = index.nodesById.get(nodeId)!;
    const entryId = typeof node.props.entryId === 'string' ? node.props.entryId : '';
    const entry = entryId ? entries.get(entryId) : undefined;
    if (entryId && !entry) throw new Error(`Library graph node ${JSON.stringify(nodeId)} references missing Entry ${JSON.stringify(entryId)}.`);
    const kind = entry ? kinds.get(entry.kind) : undefined;
    const counter = activeCounters.get(nodeId) ?? null;
    const fields: string[] = [];
    if (options.includeEntryKind) {
      fields.push(entry ? `[${kind ? localized(kind.name, options.language) : singleLine(entry.kind)}]` : '[Placeholder]');
    }
    const number = numbers.get(nodeId) ?? null;
    if (options.includeNumber && number) {
      const label = singleLine(number);
      fields.push(label.endsWith('.') ? label : `${label}.`);
    }
    if (options.includeTitle) fields.push(entry ? localized(entry.title, options.language) || '<untitled>' : '<placeholder>');
    if (options.includeEntryId) fields.push(entry ? `<${singleLine(entry.id)}>` : '<none>');
    if (options.includeCounterId) fields.push(`(counter id: ${counter ? singleLine(counter.id) : 'none'})`);
    lines.push(`${prefix}${last ? '└── ' : '├── '}${fields.join(' ')}`);

    const children = index.childrenOf.get(nodeId) ?? [];
    const childPrefix = `${prefix}${last ? '    ' : '│   '}`;
    children.forEach((child, childIndex) => render(child, childPrefix, childIndex === children.length - 1));
  };
  index.roots.forEach((root, rootIndex) => render(root, '', rootIndex === index.roots.length - 1));
  return lines.join('\n');
}

function uniqueMap<T>(values: T[], label: string, idOf: (value: T) => string): Map<string, T> {
  const out = new Map<string, T>();
  for (const value of values) {
    const id = idOf(value);
    if (out.has(id)) throw new Error(`Duplicate ${label} id ${JSON.stringify(id)}.`);
    out.set(id, value);
  }
  return out;
}

function indexGraph(graph: LibraryGraph): GraphIndex {
  const nodesById = uniqueMap(graph.nodes, 'Library graph node', (node) => node.id);
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  for (const relationship of graph.relationships) {
    if (relationship.label !== 'branch') continue;
    if (!nodesById.has(relationship.from) || !nodesById.has(relationship.to)) {
      throw new Error(`Library branch ${JSON.stringify(relationship.from)} -> ${JSON.stringify(relationship.to)} has a missing endpoint.`);
    }
    if (parentOf.has(relationship.to)) {
      throw new Error(`Library graph node ${JSON.stringify(relationship.to)} has multiple branch parents.`);
    }
    parentOf.set(relationship.to, relationship.from);
    const children = childrenOf.get(relationship.from) ?? [];
    children.push(relationship.to);
    childrenOf.set(relationship.from, children);
  }
  const roots = graph.nodes.filter((node) => !parentOf.has(node.id)).map((node) => node.id);
  const state = new Map<string, 'visiting' | 'done'>();
  const readingOrder: string[] = [];
  const visit = (nodeId: string): void => {
    if (state.get(nodeId) === 'visiting') throw new Error(`Library graph contains a branch cycle at ${JSON.stringify(nodeId)}.`);
    if (state.get(nodeId) === 'done') return;
    state.set(nodeId, 'visiting');
    readingOrder.push(nodeId);
    for (const child of childrenOf.get(nodeId) ?? []) visit(child);
    state.set(nodeId, 'done');
  };
  for (const root of roots) visit(root);
  for (const node of graph.nodes) {
    if (!state.has(node.id)) visit(node.id);
  }
  const completeRoots = [...roots, ...graph.nodes.map((node) => node.id).filter((id) => !roots.includes(id) && !parentOf.has(id))];
  if (completeRoots.length === 0 && graph.nodes.length > 0) {
    throw new Error('Library graph has no branch root.');
  }
  return { nodesById, childrenOf, roots: completeRoots, readingOrder };
}

function indexCounterPaths(counters: CounterNode[]): Map<CounterNode, CounterNode[]> {
  const paths = new Map<CounterNode, CounterNode[]>();
  const ids = new Set<string>();
  const names = new Set<string>();
  const visiting = new Set<CounterNode>();
  const visit = (counter: CounterNode, parents: CounterNode[]): void => {
    if (!counter.id || ids.has(counter.id)) throw new Error(`Duplicate or empty Counter id ${JSON.stringify(counter.id)}.`);
    if (typeof counter.name !== 'string' || !counter.name.trim()) {
      throw new Error(`Counter ${JSON.stringify(counter.id)} has an empty or invalid name.`);
    }
    if (names.has(counter.name)) throw new Error(`Duplicate Counter name ${JSON.stringify(counter.name)} is ambiguous.`);
    if (visiting.has(counter)) throw new Error(`Counter tree contains a cycle at ${JSON.stringify(counter.id)}.`);
    ids.add(counter.id);
    names.add(counter.name);
    visiting.add(counter);
    const path = [...parents, counter];
    paths.set(counter, path);
    for (const child of counter.children) visit(child, path);
    visiting.delete(counter);
  };
  for (const counter of counters) visit(counter, []);
  return paths;
}

function findCounterById(counters: CounterNode[], id: string): CounterNode | null {
  for (const counter of counters) {
    if (counter.id === id) return counter;
    const nested = findCounterById(counter.children, id);
    if (nested) return nested;
  }
  return null;
}

function findCounterByName(counters: CounterNode[], name: string): CounterNode | null {
  for (const counter of counters) {
    if (counter.name === name) return counter;
    const nested = findCounterByName(counter.children, name);
    if (nested) return nested;
  }
  return null;
}

function resolveCounter(
  node: GraphNode,
  entries: Map<string, EntryData>,
  kinds: Map<string, EntryKind>,
  counters: CounterNode[],
): CounterNode | null {
  const explicit = node.props.counterId;
  if (explicit !== undefined) {
    if (typeof explicit !== 'string' || !explicit) {
      throw new Error(`Library graph node ${JSON.stringify(node.id)} has an invalid explicit counterId.`);
    }
    const counter = findCounterById(counters, explicit);
    if (!counter) {
      throw new Error(
        `Library graph node ${JSON.stringify(node.id)} explicit counterId ${JSON.stringify(explicit)} does not exist.`,
      );
    }
    return counter;
  }
  const entryId = typeof node.props.entryId === 'string' ? node.props.entryId : '';
  const entry = entries.get(entryId);
  const name = entry ? kinds.get(entry.kind)?.defaultCounterName?.trim() : '';
  return name ? findCounterByName(counters, name) : null;
}

function numberNodes(
  index: GraphIndex,
  entries: Map<string, EntryData>,
  kinds: Map<string, EntryKind>,
  counters: CounterNode[],
  paths: Map<CounterNode, CounterNode[]>,
): Map<string, string | null> {
  const values = new Map<CounterNode, number>();
  const numbers = new Map<string, string | null>();
  const resetDescendants = (counter: CounterNode): void => {
    for (const child of counter.children) {
      values.delete(child);
      resetDescendants(child);
    }
  };
  for (const nodeId of index.readingOrder) {
    const node = index.nodesById.get(nodeId)!;
    const counter = resolveCounter(node, entries, kinds, counters);
    const path = counter ? paths.get(counter) : undefined;
    if (!counter || !path) {
      numbers.set(nodeId, null);
      continue;
    }
    values.set(counter, (values.get(counter) ?? 0) + 1);
    resetDescendants(counter);
    const segments: string[] = [];
    for (const level of path) {
      const value = values.get(level);
      if (value === undefined) {
        segments.length = 0;
        break;
      }
      segments.push(formatNumbering(level.numbering, value));
    }
    numbers.set(nodeId, segments.length ? segments.join('') : null);
  }
  return numbers;
}

function formatNumbering(template: string, ordinal: number): string {
  let index = -1;
  for (let i = 0; i < template.length; i += 1) {
    if (SLOT_CHARS.has(template[i])) {
      index = i;
      break;
    }
  }
  if (index < 0) return template;
  const slot = template[index];
  return template.slice(0, index) + renderOrdinal(slot, ordinal) + template.slice(index + 1);
}

function renderOrdinal(slot: string, ordinal: number): string {
  if (slot === '1') return String(ordinal);
  if (slot === 'A' || slot === 'a') {
    let n = ordinal;
    let out = '';
    while (n > 0) {
      n -= 1;
      out = String.fromCharCode((slot === 'A' ? 65 : 97) + (n % 26)) + out;
      n = Math.floor(n / 26);
    }
    return out;
  }
  const roman = toRoman(ordinal);
  return slot === 'i' ? roman.toLowerCase() : roman;
}

function toRoman(value: number): string {
  const pairs: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let remaining = value;
  let out = '';
  for (const [amount, glyph] of pairs) {
    while (remaining >= amount) {
      out += glyph;
      remaining -= amount;
    }
  }
  return out;
}

function localized(value: LocalizedString, language?: string): string {
  const selected = typeof value === 'string'
    ? value
    : (language ? value.values[language] : undefined) ??
      value.values[value.default_language] ?? value.values.en ?? Object.values(value.values)[0] ?? '';
  return singleLine(selected);
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}
