# Relationship generation: pinned pure-plan port (not a publisher)

## Supported surface

```js
import { planComposedDependencyRelationships } from '@snl-doc/agent-toolkit/relationship-generation';
const plan = planComposedDependencyRelationships(allEntries, activeMacros, authoredRelationships);
// plan.generated: derived rows only
// plan.relationships: current composed view
// plan.destination === 'memory-only'; plan.publicationSupported === false
```

The SDK accepts complete validated Entry and ACTIVE Macro pools. It does not read a workspace or resolve Package activation. Toolkit callers should use the existing `readActiveMacros`, not merge all Packages; that reader is not newly promoted to a public SDK export. The input must be JSON-compatible canonical data. Relationship shape/duplicate IDs are checked; this is not a replacement for whole-workspace validation. Missing/self Macro sources are ignored as in Extension. Invalid non-string SNL throws; opaque unfinished tokenizer spans retain the pinned tokenizer's behavior.

Global planning canonicalizes order and detaches JSON inputs as Extension's `readDependencyCache` does. All manual/foreign-generator/context rows and unknown fields survive. Old saved automatic `depends` rows are replaced **in the returned view only**; no saved bytes are removed. A returned `changes.removed` is a view difference, never permission to delete Authoring. `report` is the upstream pure reconciler report (its `updated` counts endpoint keys, not actual value changes; its `preservedUser` excludes tagged context rows). It is **not** the separate host regeneration/cache telemetry report.

`planDependencyRelationships(entries, macros, rows, {entryIds: Set|null})` is the preserved scoped algorithm primitive. Scope limits source scanning, not the target/evidence pool. Unmanaged and out-of-scope row objects can be shared with input and must not be mutated. This primitive is not the current global cache invalidation contract. Only the explicitly named `computeAtomicityInPlace` mutates selected rows; its predicate must be pure.

## Exact provenance and semantic delta

Pinned executable oracle: SNL-Doc-Extension commit `76acedbc05f0523b8ad2a2e99ebfeb01591f4647`.

- `src/dependencyCache.ts` SHA-256 `8461a3392fec9de81110c1c5ccefb019e329df2ea75add404fe594a410c95792`.
- `src/snlReferences.ts` SHA-256 `c656d5bcc5bdfb61c42c351e7480cc8de1e15a48ae5b23968d4f43aa6bce6827`.
- Exact original bytes and MIT license are retained under `CLI_Scripts/fixtures/relationship-oracle/`. Tests hash-check and transpile the actual source, replacing only the cache transport; the original generation callback and validator execute. There are no absolute donor imports or invented equivalence oracle.
- Tokenizer and reconciler bodies are asserted byte-identical to the pinned source. Tuple keys now use JSON arrays rather than ambiguous pipe concatenation.
- Unlike legacy Toolkit `74c0b1df5ff38f2b51ef9e0e64759d6cad4836eb`, **parallel direct edges do not make each other non-atomic**. Current Extension excludes all matching direct endpoints when searching for a composite path. The DAG bitset optimization marks the entire parallel group atomic unless an earlier neighbor's closure covers the target. Cyclic/over-budget graphs use matching endpoint-exclusion traversal.
- DAG complexity remains `O((V+E) ceil(V/32) + E log E)` time and `O(V ceil(V/32)+E)` storage. Bitsets are capped at 64 MiB. Cycles fall back globally and can be expensive; sparse fallback tests are not a dense-cycle performance claim. Pure timing is separate from disk/CLI/cache/UI performance.

## Explicit contract BLOCK: no relationship/generate command shipped

Toolkit base `b84fdf3977b3b271b114602b7d6797ca865b05cb` has a planned normative Entry `CLI.snl-relationship-generate`, but no command in `COMMAND_PATHS`. It asks for `scope`, whole-workspace CAS, managed-slice replacement, resulting revision, canonical readback and validation, without specifying a cache target or cache publication receipt.

Pinned Extension `spec.cache.dependencies`, `schema.read.relationships`, and `src/snlDoc.ts:7380-7415,7635-7671` instead require:

1. Strict saved Authoring read first, then current generated cache plus manual rows.
2. Ordinary generation writes only rebuildable dependencies cache; never Authoring.
3. Scope remains only for source compatibility; actual invalidation/generation is global.
4. Saved historical rows and composed rows are different identities/views; generated rows are read-only.

Before wiring `relationship/generate` across CLI/execute/MCP/DSH, the owner must define: whether the operation publishes cache or only returns a plan; global-vs-scoped behavior; which cache root/version/input key is shared; how workspace CAS excludes derived writes; what resulting revision means when Authoring is unchanged; and safe snapshot-bound cache publication/validation/rollback behavior. Existing shared lock/CAS/batch infrastructure must be reused after this decision. Do not restore the old `lib/relationship-operation.ts` Authoring writer.

This candidate deliberately leaves command discovery, transport allowlists, Authoring Spec, batch/tags/locks, reader pins and package version unchanged. It does not claim cache publication, installed Extension Host/UI parity, mixed-writer safety of a new publisher, or full release readiness. It supplies executable pure planning and a pack/install SDK test only. Rebuild with `npm run build:cli` before packaging; `npm pack --ignore-scripts` in the focused test is not the full release prepack gate.
