// lib/relationship-generation.ts
import { isDeepStrictEqual } from "node:util";
var AUTO_GENERATOR_TAG = "macro-source-scan";
var AUTO_LABEL = "depends";
var AUTO_LABELS = ["depends", "uses_context"];
var AUTO_LABEL_USES_CONTEXT = "uses_context";
function extractSnlReferences(snl) {
  const macros = /* @__PURE__ */ new Set();
  const contextSrcs = /* @__PURE__ */ new Set();
  if (!snl) return { macros: [], contextSrcs: [] };
  let i = 0;
  const n = snl.length;
  const isIdStart = (c) => /[A-Za-z_.]/.test(c);
  const isIdCont = (c) => /[A-Za-z0-9_.]/.test(c);
  while (i < n) {
    const c = snl[i];
    if (/\s|[(),\[\]]/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "%") {
      i += 1;
      while (i < n && snl[i] !== "%") i += 1;
      i += 1;
      continue;
    }
    if (c === "$") {
      const isDisplay = snl[i + 1] === "$";
      const delim = isDisplay ? "$$" : "$";
      i += delim.length;
      while (i < n && snl.substr(i, delim.length) !== delim) i += 1;
      i += delim.length;
      continue;
    }
    if (c === "@") {
      i += 1;
      if (i < n && (snl[i] === "%" || snl[i] === "$")) continue;
      while (i < n && isIdCont(snl[i])) i += 1;
      continue;
    }
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdCont(snl[j])) j += 1;
      macros.add(snl.slice(i, j));
      i = j;
      if (i < n && snl[i] === "[") {
        while (i < n && snl[i] !== "]") i += 1;
        if (i < n) i += 1;
      }
      if (i < n && snl[i] === "@") {
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
function reconcileDependencyRelationships(entries, macros, existing, scope) {
  const poolIds = new Set(entries.map((entry) => entry.id));
  const isSystemAutoRow = (relationship) => AUTO_LABELS.includes(relationship.label) && relationship.metadata !== null && typeof relationship.metadata === "object" && relationship.metadata.generator === AUTO_GENERATOR_TAG;
  const isManagedDependencyRow = (relationship) => relationship.label === AUTO_LABEL && isSystemAutoRow(relationship);
  const preservedRows = [];
  const inScopeAuto = /* @__PURE__ */ new Map();
  for (const relationship of existing) {
    const inScope = scope.entryIds === null || scope.entryIds.has(relationship.from);
    if (isManagedDependencyRow(relationship) && inScope) {
      inScopeAuto.set(JSON.stringify([relationship.label, relationship.from, relationship.to]), relationship);
    } else {
      preservedRows.push(relationship);
    }
  }
  const preservedUser = preservedRows.filter(
    (relationship) => !isSystemAutoRow(relationship)
  ).length;
  const generated = /* @__PURE__ */ new Map();
  const idPrefix = {
    [AUTO_LABEL]: "dep",
    [AUTO_LABEL_USES_CONTEXT]: "ctx"
  };
  const witnessField = {
    [AUTO_LABEL]: "macros",
    [AUTO_LABEL_USES_CONTEXT]: "postfixes"
  };
  const allocatedIds = new Set(preservedRows.map(({ id }) => id));
  const allocateGeneratedId = (label, from, to, previous) => {
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
  const upsert = (label, from, to, witness) => {
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
            [witnessField[label]]: [],
            isAtomic: true
          }
        },
        witnesses: /* @__PURE__ */ new Set()
      };
      generated.set(key, bucket);
    }
    bucket.witnesses.add(witness);
  };
  for (const entry of entries) {
    if (scope.entryIds !== null && !scope.entryIds.has(entry.id)) continue;
    const snl = entry.content?.snl ?? "";
    if (!snl.trim()) continue;
    const references = extractSnlReferences(snl);
    for (const name of references.macros) {
      const macro = Object.hasOwn(macros, name) ? macros[name] : void 0;
      if (!macro || !Array.isArray(macro.source?.entries)) continue;
      for (const source of macro.source.entries) upsert(AUTO_LABEL, entry.id, source, name);
    }
  }
  for (const bucket of generated.values()) {
    const metadata = bucket.rel.metadata;
    metadata[witnessField[bucket.rel.label]] = Array.from(bucket.witnesses).sort();
  }
  const relationships = [...preservedRows, ...Array.from(generated.values(), ({ rel }) => rel)];
  const generatedRows = new Set(Array.from(generated.values(), ({ rel }) => rel));
  computeAtomicityInPlace(relationships, (relationship) => generatedRows.has(relationship));
  relationships.sort(
    (left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0
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
      atomicCount: relationships.filter(
        (relationship) => AUTO_LABELS.includes(relationship.label) && relationship.metadata !== null && typeof relationship.metadata === "object" && relationship.metadata.isAtomic === true
      ).length
    }
  };
}
function computeAtomicityInPlace(rels, shouldUpdate = () => true) {
  for (const label of AUTO_LABELS) {
    const bucket = rels.filter((rel) => rel.label === label);
    const selected = bucket.map((rel) => shouldUpdate(rel));
    if (!selected.some(Boolean)) continue;
    const ids = /* @__PURE__ */ new Map();
    const vertex = (id) => {
      let index = ids.get(id);
      if (index === void 0) {
        index = ids.size;
        ids.set(id, index);
      }
      return index;
    };
    const edges = bucket.map((rel) => ({ from: vertex(rel.from), to: vertex(rel.to) }));
    const adjacency = Array.from({ length: ids.size }, () => []);
    const indegree = new Uint32Array(ids.size);
    edges.forEach(({ from, to }, index) => {
      adjacency[from].push(index);
      indegree[to] += 1;
    });
    const order = [];
    indegree.forEach((degree, index) => {
      if (degree === 0) order.push(index);
    });
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
      order.forEach((id, index) => {
        rank[id] = index;
      });
      const reachable = new Uint32Array(ids.size * words);
      for (let cursor = order.length - 1; cursor >= 0; cursor -= 1) {
        const from = order[cursor];
        const offset = from * words;
        const outgoing = adjacency[from].sort((a, b) => rank[edges[a].to] - rank[edges[b].to]);
        for (let i = 0; i < outgoing.length; ) {
          const to = edges[outgoing[i]].to;
          let end = i + 1;
          while (end < outgoing.length && edges[outgoing[end]].to === to) end += 1;
          const word = to >>> 5;
          const bit = 1 << (to & 31);
          const covered = (reachable[offset + word] & bit) !== 0;
          if (!covered) for (let j = i; j < end; j += 1) atomic[outgoing[j]] = 1;
          if (!covered) {
            const targetOffset = to * words;
            for (let w = 0; w < words; w += 1) reachable[offset + w] |= reachable[targetOffset + w];
            reachable[offset + word] |= bit;
          }
          i = end;
        }
      }
    } else {
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
            if (next === to) {
              hit = true;
              break;
            }
            if (seen[next] !== stamp) {
              seen[next] = stamp;
              queue.push(next);
            }
          }
        }
        atomic[thisIndex] = hit ? 0 : 1;
      });
    }
    bucket.forEach((rel, index) => {
      if (!selected[index]) return;
      const md = rel.metadata ?? {};
      md.isAtomic = atomic[index] === 1;
      rel.metadata = md;
    });
  }
}
var RELATIONSHIP_GENERATION_PROVENANCE = Object.freeze({
  generator: "macro-source-scan",
  repository: "https://github.com/SJTU-AI4Math/SNL-Doc-Extension",
  revision: "76acedbc05f0523b8ad2a2e99ebfeb01591f4647",
  path: "src/dependencyCache.ts",
  sourceSha256: "8461a3392fec9de81110c1c5ccefb019e329df2ea75add404fe594a410c95792",
  tokenizerPath: "src/snlReferences.ts",
  tokenizerSha256: "c656d5bcc5bdfb61c42c351e7480cc8de1e15a48ae5b23968d4f43aa6bce6827",
  functions: Object.freeze(["extractSnlReferences", "reconcileDependencyRelationships", "computeAtomicityInPlace"]),
  atomicity: "exact-direct-endpoint-exclusion/dag-bitset-or-traversal"
});
function planDependencyRelationships(entries, activeMacros, existing, scope) {
  const result = reconcileDependencyRelationships(entries, activeMacros, existing, scope);
  const before = new Map(existing.map((rel) => [rel.id, rel]));
  const after = new Map(result.relationships.map((rel) => [rel.id, rel]));
  const changes = { added: [], removed: [], updated: [] };
  for (const rel of result.relationships) {
    const previous = before.get(rel.id);
    if (!previous) changes.added.push(rel);
    else if (!isDeepStrictEqual(previous, rel)) changes.updated.push({ before: previous, after: rel });
  }
  for (const rel of existing) if (!after.has(rel.id)) changes.removed.push(rel);
  changes.removed.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { ...result, changes, provenance: RELATIONSHIP_GENERATION_PROVENANCE };
}
function isAutomaticDependency(relationship) {
  return relationship.label === "depends" && relationship.metadata !== null && typeof relationship.metadata === "object" && relationship.metadata.generator === AUTO_GENERATOR_TAG;
}
function planComposedDependencyRelationships(entries, activeMacros, authored) {
  const seen = /* @__PURE__ */ new Set();
  if (!Array.isArray(authored)) throw new TypeError("Authored relationships must be an array.");
  for (const row of authored) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new TypeError("Relationship must be an object.");
    for (const key of ["id", "from", "to", "label"]) {
      if (typeof row[key] !== "string" || !row[key] || row[key].trim() !== row[key]) throw new TypeError(`Relationship ${key} must be a canonical non-empty string.`);
    }
    if (seen.has(row.id)) throw new TypeError(`Duplicate relationship id ${JSON.stringify(row.id)}.`);
    seen.add(row.id);
  }
  const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const input = JSON.parse(JSON.stringify({
    entries: entries.map((e) => ({ id: e.id, content: { snl: e.content?.snl ?? "" } })).sort(compareId),
    macros: Object.fromEntries(Object.keys(activeMacros).sort().map((name) => [name, { source: { entries: activeMacros[name].source?.entries ?? [] } }])),
    relationships: [...authored].sort(compareId)
  }));
  const plan = planDependencyRelationships(input.entries, input.macros, input.relationships, { entryIds: null });
  const generated = plan.relationships.filter(isAutomaticDependency);
  return { ...plan, generated, destination: "memory-only", publicationSupported: false };
}
export {
  RELATIONSHIP_GENERATION_PROVENANCE,
  computeAtomicityInPlace,
  extractSnlReferences,
  isAutomaticDependency,
  planComposedDependencyRelationships,
  planDependencyRelationships,
  reconcileDependencyRelationships
};
