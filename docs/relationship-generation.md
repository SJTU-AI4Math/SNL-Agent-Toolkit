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

## Engineering integration pending: no relationship/generate command shipped

Toolkit base `b84fdf3977b3b271b114602b7d6797ca865b05cb` has a planned normative Entry `CLI.snl-relationship-generate`, but no command in `COMMAND_PATHS`. It asks for `scope`, whole-workspace CAS, managed-slice replacement, resulting revision, canonical readback and validation, without specifying a cache target or cache publication receipt.

Pinned Extension `spec.cache.dependencies`, `schema.read.relationships`, and `src/snlDoc.ts:7380-7415,7635-7671` instead require:

1. Strict saved Authoring read first, then current generated cache plus manual rows.
2. Ordinary generation writes only rebuildable dependencies cache; never Authoring.
3. Scope remains only for source compatibility; actual invalidation/generation is global.
4. Saved historical rows and composed rows are different identities/views; generated rows are read-only.

The product direction is established, not blocked on a new owner decision: global cache-only generation with unchanged Authoring bytes. The pinned `spec.cache`, `spec.cache.runtime`, `spec.cache.dependencies` and `derivedCache.cachePath` define `.SNL_Doc/.cache/dependencies/result.json`, generator `dependencies`, algorithm version `1`, envelope `snl-derived-cache` schema `1`, global `library:null`, and input/value fingerprints. Complete sorted Entry id+SNL, active Macro name+source.entries and authored relationships bind the input. The empty request scope means global computation; do not invent local selector fields or shrink the input pool.

The prerequisite Authoring revision repair is implemented: opaque version-2 workspace tokens exclude exactly the reserved `.SNL_Doc/.cache` and `.SNL_Doc/libraries/<legal-cache-slug>/.cache` subtrees, not arbitrary `.cache` assets elsewhere. Canonical root, unknown author directories, files, modes and frozen backups remain authority. Cache-only create/update/delete leaves the token unchanged. Old whole-tree tokens fail closed as `batch.workspace-conflict`; reread/recheck using the upgraded Toolkit. Cache bytes never become an Authoring CAS credential.

Remaining engineering work is snapshot-bound cache publication under the shared lock, strict publication-error handling (not an in-memory fallback masquerading as persisted success), complete-input readback and Authoring validation, and common CLI/execute/MCP/DSH wiring. Dry-run must not create caches or lock residue. A successful cache-only apply may return the same Authoring revision; view removals do not authorize saved-row deletion. Do not restore the old `lib/relationship-operation.ts` Authoring writer or invent another cache schema.

Batch publication remains a separate complete physical-tree transaction: it copies caches too and verifies full physical readback/rollback. Cache changes between check and apply are accepted when Authoring is unchanged, but cache churn during physical staging/exchange may require quiescence and a whole-batch retry (`batch.physical-conflict`), or recovery if the retained preimage also changed. An Authoring token is not a copy-safety or mixed-writer certificate. See `Skills/CLI Tools/Batch.md`.

This follow-up changes the revision/batch boundary, tests and related normative documentation only. Command discovery and transport allowlists still omit generation; tags, lock implementation, reader pins and package version remain unchanged. It does not claim cache publication, installed Extension Host/UI parity, mixed-writer safety of a new publisher, or full release readiness. Rebuild with `npm run build:cli` before packaging; `npm pack --ignore-scripts` in the focused test is not the full release prepack gate.
