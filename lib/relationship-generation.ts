/**
 * Copyright (c) 2026 SJTU AI4Math
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Extension dependency generator, ported from SNL-Doc-Extension
 * 76acedbc05f0523b8ad2a2e99ebfeb01591f4647 src/dependencyCache.ts (MIT).
 * The tokenizer and reconciler below are extracted verbatim; atomicity has
 * an equivalent DAG fast path and an endpoint-exclusion traversal fallback.
 * See docs/relationship-generation.md for provenance and transaction boundary.
 */
import { isDeepStrictEqual } from 'node:util';
/** Minimal structural inputs keep the installed pure SDK independent of host
 * schema/build-only dependencies. Callers still validate their complete pools. */
export interface DependencyEntry { id: string; content?: { snl?: string } }
export interface DependencyMacro { source?: { entries?: string[] } }
type EntryData = DependencyEntry;
type MacroPackageEntry = DependencyMacro;

/** Structural equivalent of Extension RelationshipData. Extra fields survive. */
export interface RelationshipData {
  id: string;
  from: string;
  to: string;
  label: string;
  metadata: unknown;
}

const AUTO_GENERATOR_TAG = 'macro-source-scan';
const AUTO_LABEL = 'depends';
/** Labels that {@link regenerateDependencyRelationships} manages. Both
 *  are (label, generator) tuples on the metadata side; treat this list
 *  as the source of truth for "is this row auto-managed?". */
const AUTO_LABELS: readonly string[] = ['depends', 'uses_context'];
const AUTO_LABEL_USES_CONTEXT = 'uses_context';

/**
 * Extract macro identifiers AND `x@foo` context-src target entry ids from
 * an SNL string. The scanner is a lightweight tokenizer that mirrors the
 * parser's identifier recognition without pulling the parser itself into
 * the host bundle.
 *
 * `macros`: bare identifiers used as macro references (used to look up
 *   `source.entries[]` for the "depends" auto-edge).
 * `contextSrcs`: the `<name>` in `x@<name>` postfixes — a direct
 *   entry-id reference (Stage 1 §src-postfix), used for the
 *   "uses_context" auto-edge (cat 2026-07-10).
 */
export function extractSnlReferences(
  snl: string
): { macros: string[]; contextSrcs: string[] } {
  const macros = new Set<string>();
  const contextSrcs = new Set<string>();
  if (!snl) return { macros: [], contextSrcs: [] };
  let i = 0;
  const n = snl.length;
  const isIdStart = (c: string): boolean => /[A-Za-z_.]/.test(c);
  const isIdCont = (c: string): boolean => /[A-Za-z0-9_.]/.test(c);
  while (i < n) {
    const c = snl[i];
    if (/\s|[(),\[\]]/.test(c)) { i += 1; continue; }
    if (c === '%') {
      i += 1;
      while (i < n && snl[i] !== '%') i += 1;
      i += 1;
      continue;
    }
    if (c === '$') {
      const isDisplay = snl[i + 1] === '$';
      const delim = isDisplay ? '$$' : '$';
      i += delim.length;
      while (i < n && snl.substr(i, delim.length) !== delim) i += 1;
      i += delim.length;
      continue;
    }
    if (c === '@') {
      // Bare `@foo` = binder introduction. Skip the following name — it's
      // a binding site, not a use.
      i += 1;
      if (i < n && (snl[i] === '%' || snl[i] === '$')) continue;
      while (i < n && isIdCont(snl[i])) i += 1;
      continue;
    }
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdCont(snl[j])) j += 1;
      macros.add(snl.slice(i, j));
      i = j;
      if (i < n && snl[i] === '[') {
        while (i < n && snl[i] !== ']') i += 1;
        if (i < n) i += 1;
      }
      // `x@foo` src postfix: `x` was just collected as a macro name (a
      // false positive we accept — unregistered names produce no edge),
      // but the `@foo` chunk names a context-entry id and IS the
      // uses_context source ref.
      if (i < n && snl[i] === '@') {
        i += 1;
        const start = i;
        while (i < n && isIdCont(snl[i])) i += 1;
        if (i > start) contextSrcs.add(snl.slice(start, i));
      }
      continue;
    }
    i += 1;
  }
  return { macros: Array.from(macros), contextSrcs: Array.from(contextSrcs) };
}

/** Report from {@link regenerateDependencyRelationships}. */
export interface DependencyGenReport {
  added: number;
  removed: number;
  updated: number;
  preservedUser: number;
  totalDepends: number;
  totalUsesContext: number;
  atomicCount: number;
}

export interface DependencyScope {
  /** Restrict scan to a subset of entry ids. `null` = every entry. */
  entryIds: Set<string> | null;
}

/** Pure snapshot reconciliation used by the writer and focused tests. */
export function reconcileDependencyRelationships(
  entries: readonly Pick<EntryData, 'id' | 'content'>[],
  macros: Readonly<Record<string, Pick<MacroPackageEntry, 'source'>>>,
  existing: readonly RelationshipData[],
  scope: DependencyScope
): { relationships: RelationshipData[]; report: DependencyGenReport } {
  const poolIds = new Set(entries.map((entry) => entry.id));
  const isSystemAutoRow = (relationship: RelationshipData): boolean =>
    AUTO_LABELS.includes(relationship.label) &&
    relationship.metadata !== null &&
    typeof relationship.metadata === 'object' &&
    (relationship.metadata as { generator?: unknown }).generator === AUTO_GENERATOR_TAG;
  const isManagedDependencyRow = (relationship: RelationshipData): boolean =>
    relationship.label === AUTO_LABEL && isSystemAutoRow(relationship);

  const preservedRows: RelationshipData[] = [];
  const inScopeAuto = new Map<string, RelationshipData>();
  for (const relationship of existing) {
    const inScope = scope.entryIds === null || scope.entryIds.has(relationship.from);
    if (isManagedDependencyRow(relationship) && inScope) {
      inScopeAuto.set(JSON.stringify([relationship.label, relationship.from, relationship.to]), relationship);
    } else {
      preservedRows.push(relationship);
    }
  }
  const preservedUser = preservedRows.filter((relationship) =>
    !isSystemAutoRow(relationship)
  ).length;

  const generated = new Map<string, { rel: RelationshipData; witnesses: Set<string> }>();
  const idPrefix: Record<string, string> = {
    [AUTO_LABEL]: 'dep',
    [AUTO_LABEL_USES_CONTEXT]: 'ctx'
  };
  const witnessField: Record<string, string> = {
    [AUTO_LABEL]: 'macros',
    [AUTO_LABEL_USES_CONTEXT]: 'postfixes'
  };
  const allocatedIds = new Set(preservedRows.map(({ id }) => id));
  const allocateGeneratedId = (
    label: string,
    from: string,
    to: string,
    previous: RelationshipData | undefined
  ): string => {
    if (previous && !allocatedIds.has(previous.id)) {
      allocatedIds.add(previous.id);
      return previous.id;
    }
    const base = `${idPrefix[label]}.${from}.${to}`;
    let candidate = base;
    let suffix = 1;
    while (allocatedIds.has(candidate)) candidate = `${base}.${suffix++}`;
    allocatedIds.add(candidate);
    return candidate;
  };
  const upsert = (label: string, from: string, to: string, witness: string): void => {
    if (!to || from === to || !poolIds.has(to)) return;
    const key = JSON.stringify([label, from, to]);
    let bucket = generated.get(key);
    if (!bucket) {
      const previous = inScopeAuto.get(key);
      bucket = {
        rel: {
          id: allocateGeneratedId(label, from, to, previous),
          from,
          to,
          label,
          metadata: {
            generator: AUTO_GENERATOR_TAG,
            [witnessField[label]]: [] as string[],
            isAtomic: true
          }
        },
        witnesses: new Set<string>()
      };
      generated.set(key, bucket);
    }
    bucket.witnesses.add(witness);
  };

  for (const entry of entries) {
    if (scope.entryIds !== null && !scope.entryIds.has(entry.id)) continue;
    const snl = entry.content?.snl ?? '';
    if (!snl.trim()) continue;
    const references = extractSnlReferences(snl);
    for (const name of references.macros) {
      const macro = Object.hasOwn(macros, name) ? macros[name] : undefined;
      if (!macro || !Array.isArray(macro.source?.entries)) continue;
      for (const source of macro.source.entries) upsert(AUTO_LABEL, entry.id, source, name);
    }
  }

  for (const bucket of generated.values()) {
    const metadata = bucket.rel.metadata as Record<string, unknown>;
    metadata[witnessField[bucket.rel.label]] = Array.from(bucket.witnesses).sort();
  }

  const relationships = [...preservedRows, ...Array.from(generated.values(), ({ rel }) => rel)];
  const generatedRows = new Set(Array.from(generated.values(), ({ rel }) => rel));
  computeAtomicityInPlace(relationships, (relationship) => generatedRows.has(relationship));
  relationships.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  );

  let added = 0;
  let updated = 0;
  for (const key of generated.keys()) {
    if (inScopeAuto.has(key)) updated += 1;
    else added += 1;
  }
  let removed = 0;
  for (const key of inScopeAuto.keys()) {
    if (!generated.has(key)) removed += 1;
  }
  return {
    relationships,
    report: {
      added,
      removed,
      updated,
      preservedUser,
      totalDepends: relationships.filter(({ label }) => label === AUTO_LABEL).length,
      totalUsesContext: relationships.filter(({ label }) => label === AUTO_LABEL_USES_CONTEXT).length,
      atomicCount: relationships.filter((relationship) =>
        AUTO_LABELS.includes(relationship.label) &&
        relationship.metadata !== null &&
        typeof relationship.metadata === 'object' &&
        (relationship.metadata as { isAtomic?: unknown }).isAtomic === true
      ).length
    }
  };
}

/**
 * Exact Extension endpoint-exclusion semantics: parallel direct edges are
 * not composites and do not make each other non-atomic.
 * DAGs use topological bitset closure, O((V+E) ceil(V/32) + E log E)
 * time and O(V ceil(V/32) + E) space. At 10k vertices the bitset is ~12 MiB.
 * Cycles (or a closure above 64 MiB) fall back to the original traversal,
 * using a queue cursor rather than shift. No recursion / call-stack limit.
 * Only shouldUpdate rows are mutated; all same-label rows are graph evidence.
 */
export function computeAtomicityInPlace(
  rels: RelationshipData[],
  shouldUpdate: (relationship: RelationshipData) => boolean = () => true
): void {
  for (const label of AUTO_LABELS) {
    const bucket = rels.filter((rel) => rel.label === label);
    // shouldUpdate is a pure row-selection predicate (as in the reconciler).
    const selected = bucket.map((rel) => shouldUpdate(rel));
    if (!selected.some(Boolean)) continue;
    const ids = new Map<string, number>();
    const vertex = (id: string): number => {
      let index = ids.get(id);
      if (index === undefined) { index = ids.size; ids.set(id, index); }
      return index;
    };
    const edges = bucket.map((rel) => ({ from: vertex(rel.from), to: vertex(rel.to) }));
    const adjacency: number[][] = Array.from({ length: ids.size }, () => []);
    const indegree = new Uint32Array(ids.size);
    edges.forEach(({ from, to }, index) => {
      adjacency[from].push(index);
      indegree[to] += 1;
    });
    const order: number[] = [];
    indegree.forEach((degree, index) => { if (degree === 0) order.push(index); });
    for (let cursor = 0; cursor < order.length; cursor += 1) {
      for (const index of adjacency[order[cursor]]) {
        const to = edges[index].to;
        indegree[to] -= 1;
        if (indegree[to] === 0) order.push(to);
      }
    }
    const atomic = new Uint8Array(edges.length);
    const words = Math.ceil(ids.size / 32);
    if (order.length === ids.size && ids.size * words * 4 <= 64 * 1024 * 1024) {
      const rank = new Uint32Array(ids.size);
      order.forEach((id, index) => { rank[id] = index; });
      const reachable = new Uint32Array(ids.size * words);
      for (let cursor = order.length - 1; cursor >= 0; cursor -= 1) {
        const from = order[cursor];
        const offset = from * words;
        // A neighbor can reach only neighbors later in topological order.
        // Thus prior-neighbor closure contains every alternate route to to.
        const outgoing = adjacency[from].sort((a, b) => rank[edges[a].to] - rank[edges[b].to]);
        for (let i = 0; i < outgoing.length;) {
          const to = edges[outgoing[i]].to;
          let end = i + 1;
          while (end < outgoing.length && edges[outgoing[end]].to === to) end += 1;
          const word = to >>> 5;
          const bit = 1 << (to & 31);
          const covered = (reachable[offset + word] & bit) !== 0;
          if (!covered) for (let j = i; j < end; j += 1) atomic[outgoing[j]] = 1;
          // If already covered, its full descendant closure is already here.
          if (!covered) {
            const targetOffset = to * words;
            for (let w = 0; w < words; w += 1) reachable[offset + w] |= reachable[targetOffset + w];
            reachable[offset + word] |= bit;
          }
          i = end;
        }
      }
    } else {
      // Exact mainline fallback: exclude ALL matching direct endpoints.
      // This also matches upstream behavior with self edges and cyclic paths.
      const seen = new Uint32Array(ids.size);
      edges.forEach(({ from, to }, thisIndex) => {
        if (!selected[thisIndex]) return;
        const stamp = thisIndex + 1;
        const queue = [from];
        seen[from] = stamp;
        let hit = false;
        for (let cursor = 0; cursor < queue.length && !hit; cursor += 1) {
          const current = queue[cursor];
          for (const index of adjacency[current]) {
            if (current === from && edges[index].to === to) continue;
            const next = edges[index].to;
            if (next === to) { hit = true; break; }
            if (seen[next] !== stamp) { seen[next] = stamp; queue.push(next); }
          }
        }
        atomic[thisIndex] = hit ? 0 : 1;
      });
    }
    bucket.forEach((rel, index) => {
      if (!selected[index]) return;
      const md = (rel.metadata ?? {}) as Record<string, unknown>;
      md.isAtomic = atomic[index] === 1;
      rel.metadata = md;
    });
  }
}

export const RELATIONSHIP_GENERATION_PROVENANCE = Object.freeze({
  generator: 'macro-source-scan',
  repository: 'https://github.com/SJTU-AI4Math/SNL-Doc-Extension',
  revision: '76acedbc05f0523b8ad2a2e99ebfeb01591f4647',
  path: 'src/dependencyCache.ts',
  sourceSha256: '8461a3392fec9de81110c1c5ccefb019e329df2ea75add404fe594a410c95792',
  tokenizerPath: 'src/snlReferences.ts',
  tokenizerSha256: 'c656d5bcc5bdfb61c42c351e7480cc8de1e15a48ae5b23968d4f43aa6bce6827',
  functions: Object.freeze(['extractSnlReferences', 'reconcileDependencyRelationships', 'computeAtomicityInPlace']),
  atomicity: 'exact-direct-endpoint-exclusion/dag-bitset-or-traversal',
});

export interface DependencyRelationshipPlan {
  relationships: RelationshipData[];
  report: DependencyGenReport;
  changes: {
    added: RelationshipData[];
    removed: RelationshipData[];
    updated: { before: RelationshipData; after: RelationshipData }[];
  };
  provenance: typeof RELATIONSHIP_GENERATION_PROVENANCE;
}

/**
 * Pure SCOPED algorithm plan over a validated, canonically ordered snapshot.
 * This is not a publication plan. Current Extension cache generation is global;
 * use planComposedDependencyRelationships for its consumer view instead.
 * activeMacros must come from readActiveMacros (not all Package catalogs).
 * Caller owns public scope validation, one workspace lock/revision, guarded
 * transaction publication and validation. This module never writes files.
 * Preserved row objects are shared with the input: do not mutate the plan.
 */
export function planDependencyRelationships(
  entries: readonly Pick<EntryData, 'id' | 'content'>[],
  activeMacros: Readonly<Record<string, Pick<MacroPackageEntry, 'source'>>>,
  existing: readonly RelationshipData[],
  scope: DependencyScope
): DependencyRelationshipPlan {
  const result = reconcileDependencyRelationships(entries, activeMacros, existing, scope);
  const before = new Map(existing.map((rel) => [rel.id, rel]));
  const after = new Map(result.relationships.map((rel) => [rel.id, rel]));
  const changes: DependencyRelationshipPlan['changes'] = { added: [], removed: [], updated: [] };
  for (const rel of result.relationships) {
    const previous = before.get(rel.id);
    if (!previous) changes.added.push(rel);
    else if (!isDeepStrictEqual(previous, rel)) changes.updated.push({ before: previous, after: rel });
  }
  for (const rel of existing) if (!after.has(rel.id)) changes.removed.push(rel);
  changes.removed.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { ...result, changes, provenance: RELATIONSHIP_GENERATION_PROVENANCE };
}

/** Exactly the pinned Extension generator's ownership predicate. */
export function isAutomaticDependency(relationship: Pick<RelationshipData, 'label' | 'metadata'>): boolean {
  return relationship.label === 'depends' && relationship.metadata !== null &&
    typeof relationship.metadata === 'object' &&
    (relationship.metadata as { generator?: unknown }).generator === AUTO_GENERATOR_TAG;
}

/**
 * Global, detached, memory-only consumer view matching readDependencyCache.
 * Complete validated Entry/ACTIVE Macro pools are required. This never opens a
 * workspace, locks, repairs Authoring, writes a cache, or authorizes publication.
 * `changes` compares the saved pool to this view, NOT a proposed Authoring edit.
 * The low-level scoped planner above is NOT the current cache invalidation API.
 */
export function planComposedDependencyRelationships(
  entries: readonly Pick<EntryData, 'id' | 'content'>[],
  activeMacros: Readonly<Record<string, Pick<MacroPackageEntry, 'source'>>>,
  authored: readonly RelationshipData[],
) {
  const seen = new Set<string>();
  if (!Array.isArray(authored)) throw new TypeError('Authored relationships must be an array.');
  for (const row of authored) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('Relationship must be an object.');
    for (const key of ['id', 'from', 'to', 'label'] as const) {
      if (typeof row[key] !== 'string' || !row[key] || row[key].trim() !== row[key]) throw new TypeError(`Relationship ${key} must be a canonical non-empty string.`);
    }
    if (seen.has(row.id)) throw new TypeError(`Duplicate relationship id ${JSON.stringify(row.id)}.`);
    seen.add(row.id);
  }
  const compareId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  // Same semantic input projection and JSON detach as pinned readDependencyCache.
  const input = JSON.parse(JSON.stringify({
    entries: entries.map(e => ({ id: e.id, content: { snl: e.content?.snl ?? '' } })).sort(compareId),
    macros: Object.fromEntries(Object.keys(activeMacros).sort().map(name => [name, { source: { entries: activeMacros[name].source?.entries ?? [] } }])),
    relationships: [...authored].sort(compareId),
  })) as { entries: Pick<EntryData, 'id' | 'content'>[]; macros: Record<string, Pick<MacroPackageEntry, 'source'>>; relationships: RelationshipData[] };
  const plan = planDependencyRelationships(input.entries, input.macros, input.relationships, { entryIds: null });
  const generated = plan.relationships.filter(isAutomaticDependency);
  return { ...plan, generated, destination: 'memory-only' as const, publicationSupported: false as const };
}