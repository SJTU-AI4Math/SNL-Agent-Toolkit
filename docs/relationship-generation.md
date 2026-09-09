# Dependency relationship generation

`lib/relationship-generation.ts` is a **pure plan**, not a second canonical
writer. It implements the derivation behind the normative
`.SNL_Doc` Entry `CLI.snl-relationship-generate`; transport registration and
transaction publication belong to the operation core.

## Integration

```ts
import { planDependencyRelationships } from '../lib/relationship-generation.ts';
const plan = planDependencyRelationships(entries, activeMacros, existing, {
  entryIds: null, // Set<string> restricts source Entries; empty Set scans none
});
// plan.relationships: complete merged replacement rows, sorted by id
// plan.report: exact Extension counters
// plan.changes: added[], removed[], updated[{before, after}] (actual differences)
// plan.provenance: immutable source revision and algorithm identity
```

Inputs must be a validated, canonically ordered **complete** Entry pool, the
active macro catalog (`readActiveMacros`, not `readAllMacroPackages`), and all
existing relationships. Package activation is a set, not a precedence list;
missing activation means all, empty means none, and canonical Package filename
order resolves duplicate Macro names, exactly as Extension's snapshot reader.
Resolve public scope selectors and reject unknown IDs/keys in the operation
core. Do not mutate returned rows: preserved objects are shared with inputs.
`reconcileDependencyRelationships` also exports the exact Extension-shaped
`{ relationships, report }` seam.

For apply, acquire `withWorkspaceDataLock` **once**, capture the authoritative
snapshot and workspace revision (including Entries, Macros, Package/config
activation and relationships), compare `expectedWorkspaceRevision`, derive,
and bind/recheck that snapshot before guarded publication. Use the shared
transaction's `replaceJsonIfUnchanged`/`installNewJson`; preserve unknown
relationships-file envelope fields. Never run per-row CRUD/locks or write a
raw JSON file. Dry-run only derives. The caller owns rollback, canonical
readback, whole-workspace validation and the resulting opaque revision.

## Exact Extension semantics

- Only `label === 'depends'` plus `metadata.generator === 'macro-source-scan'`
  is managed, and only when its `from` Entry is in scope.
- Scan SNL with the builtin lightweight tokenizer, not a different parser.
  Look up used Macro names via own properties and read `macro.source.entries`.
  Deduplicate/sort witnesses; skip missing targets and self references.
- Preserve manual, foreign-generator, out-of-scope and **all `uses_context`**
  rows including their metadata. Context postfixes do not generate rows.
- Recompute `isAtomic` only on newly regenerated rows, using **all** same-label
  merged edges as evidence. Keep transitive edges; mark them non-atomic.
  Cycles are allowed. Removing one edge instance and still reaching its target
  means non-atomic; even a parallel direct manual edge counts. This is the
  executable Extension behavior, more precise than its “length >= 2” prose.
- Keep prior managed IDs; allocate readable `dep.from.to`, suffixing collisions
  `.1`, `.2`, etc. Input order is the canonical snapshot order, as upstream.
- Upstream `report.updated` counts regenerated endpoint keys even on a no-op;
  `changes.updated` instead lists actual value differences. Reports retain
  upstream treatment of existing `uses_context` rows.

## Source and optimization

Source: [SNL-Doc-Extension](https://github.com/SJTU-AI4Math/SNL-Doc-Extension/blob/704b007877174f62649fcd3e8b97af4a43f9ad71/src/snlDoc.ts),
commit **`704b007877174f62649fcd3e8b97af4a43f9ad71`**, `src/snlDoc.ts`:
`extractSnlReferences` (7563–7622), `reconcileDependencyRelationships`
(7641–7773), `computeAtomicityInPlace` (7841–7873).
Full file SHA-256:
`26c09e16c5f72efd2bba5f2e2bf7f5cb0a1867e34d0cc34f91c7b99f509cee5a`.
Tokenizer/reconciliation are extracted **verbatim**, with original MIT notice.
The fetched main generation section also matched the dirty local Extension
checkout exactly; unrelated local edits were not touched.

Atomicity has an exact DAG fast path: reverse-topological bitset closure;
scan each vertex's neighbors in topological order, grouping parallel edges.
A previously covered neighbor is transitively reachable via a different first
edge. A parallel group is non-atomic even without a longer route. Closure
costs `O((V+E) ceil(V/32) + E log E)` time and
`O(V ceil(V/32) + E)` space. At 10,000 vertices the closure is about 12 MiB.
Cycles or closure storage above 64 MiB use exact edge-exclusion traversal
with an indexed queue. No recursion, approximate reduction, or edge deletion.
The exported atomicity helper expects a pure `shouldUpdate` predicate.

Local-only verification extracts/transpiles the exact hash-pinned upstream
pure functions as an independent oracle: preservation, scope, tokenizer,
activation, witnesses, collisions, cyclic/self/parallel edges, random graphs,
all 4-vertex directed graphs, multi-word bitsets, memory-cap fallback, actual
plan differences and 10,000 Entry / 50,000 edge generation. Tests are not part
of the commit, per task scope.
