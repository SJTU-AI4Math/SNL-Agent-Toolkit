# Relationship generation: pure SDK and global cache publisher

## Supported surface

```js
import { planComposedDependencyRelationships } from '@snl-doc/agent-toolkit/relationship-generation';
const plan = planComposedDependencyRelationships(allEntries, activeMacros, authoredRelationships);
// plan.generated: derived rows only
// plan.relationships: current composed view
// plan.destination === 'memory-only'; plan.publicationSupported === false
```

The SDK accepts complete validated Entry and ACTIVE Macro pools. It does not read a workspace or resolve Package activation. Do not simply merge all Packages. Toolkit's internal `readActiveMacros` is shared by the publisher and HTML Reader: in entity storage, system `_unpackaged` Macros are never effective, missing activation selects all regular Packages, and `[]` selects none. Duplicate/ordered activation entries are set membership; canonical Package filename order determines collision winners. Strict catalog admission still reads every envelope before filtering. `readAllMacroPackages` and public Macro CRUD/list retain the complete management catalog (including system Macros), identities, revisions and unknown fields. Entry analysis/lint and write-time semantic validation also use this same effective-active helper; their catalogs and storage validators are unchanged. The input must be JSON-compatible canonical data. Relationship shape/duplicate IDs are checked; this is not a replacement for whole-workspace validation. Missing/self Macro sources are ignored as in Extension. Invalid non-string SNL throws; opaque unfinished tokenizer spans retain the pinned tokenizer's behavior.

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

## Global cache publisher: CLI / execute / MCP / DSH

`snl relationship generate --scope '{}' --dry-run --root /absolute/workspace --json`
returns a zero-write preview and `data.expectedWorkspaceRevision`. Review the view diff, then run
`snl relationship generate --scope '{}' --if-workspace-match '<token>' --root /absolute/workspace --json`.
`--input <file|->` alternatively accepts the raw arguments object. Duplicate flag/input fields are rejected.
MCP and DSH `snl_execute` use `command: "relationship/generate"` and the same arguments.
`snl relationship --root /absolute/workspace --json` describes the operation.

Scope is required and accepts only `{}`: global complete Entries + active Macros + all authored relationships.
`dryRun` defaults false; explicit null/nonboolean is invalid. Apply needs a fresh preview Authoring token;
a supplied dry-run token is also checked. Unknown arguments fail before config reads.

Only `.SNL_Doc/.cache/dependencies/result.json` is written (plus transient same-directory temporary file
and the existing transient Authoring lock). Envelope `snl-derived-cache/schema=1`, generator `dependencies`,
version `"1"`, library `null`, canonical inputHash/valueHash exactly match Extension 76acedbc.
Manual and historical managed Authoring bytes are never edited. `changes` is a current-view diff, not deletion authority.

`lib/dependency-cache-descriptor.ts` reuses the pinned complete input projection and validator.
`lib/dependency-cache-storage.ts` is the pinned native format/fingerprint/path-guard subset with deliberate
strict-publisher adaptations: no memory fallback, no cache `.gitignore` write, directory sync after rename,
complete-input callback after temporary sync, and no cleanup of the shared result. Only owned temporary files
are removed. The exact original native runtime is frozen in the test fixture and exercised for readback.

Apply takes the shared Authoring lock, checks fresh CAS, validates, plans, and rechecks full inputs/revision
before publication and after same-input readCache and composed-view readback/validation. Strict failures use
`relationship.publication-failed` or `relationship.readback-failed` (exit 2); stale authority uses
`relationship.workspace-conflict` (exit 1). Successful cache-only apply can return the same Authoring token.

Other Extension cache writers do not share this Authoring lock. A late stale envelope may physically replace
a newer artifact but cannot pass a current-input readCache. Clear/replacement may fail readback or happen after
success. No whole-namespace cross-process atomicity or immunity to malicious same-UID path races is promised.
Failures never unconditionally delete someone else's result. Existing batch physical copy/rollback and revision
helper logic are unchanged. No browser/Extension Host UI claim follows from native cache reader acceptance.

## Independent installed-reader acceptance harness

After full prepack, run `scripts/verify-relationship-publisher-installed.mjs <fresh-evidence-directory> <read-only-fixed76-extension-clone>` under the applicable shared process-admission wrapper. It creates private consumer metadata before invoking npm, binds every npm call to an explicit prefix, verifies the resolved consumer prefix, clears inherited npm/global/custom-adapter configuration, uses a private npm cache and separate user/global config files, and compares shared-home and producer package metadata hashes in a `finally` guard.

The fixture is authored through installed public CLI `init`, `batch check/apply`, and fresh-CAS `entry update`. It includes two regular Packages with a duplicate Macro name, reverse creation order, a system-Package Macro created by public batch, four Entries, and a preserved manual relationship. All four installed transports must publish a nonempty, closed graph. The independently archived fixed76 native `snlDoc` (not a Toolkit-supplied input oracle) reads the same physical workspace with only a VSCode platform shim. Both `readDependencyCache` and unsupplied-snapshot `readRelationships` must consume the artifact without rewriting it. Source/tarball/installed closure hashes and complete native input snapshots are retained.

The installed harness now exercises missing activation through an explicitly authorized, exclusive-fixture-only config setup after public authoring. This is not evidence of a public config setter: only `active_macro_packages` is deleted/replaced, with full before/after byte hashes and structural diff, and all other Authoring bytes checked unchanged. Optional fourth argument reuses a lane-owned sealed fixed76 native build (archive, source and bundle hashes verified), avoiding a second native dependency installation. `scripts/verify-publisher-activation.mjs <fresh-evidence-dir> <sealed-fixed76-build-dir>` under tsx exercises missing, empty, regular subset, canonical duplicate-name winner, reverse and duplicate activation against actual native full collectors, plus the Toolkit HTML Reader's actual local model. Explicit system activation remains a rejected Toolkit config, even though native ignores it; these are negative admission cases, not newly accepted workspace states. No all-pool fallback or validator relaxation is used. No cross-product mixed-writer, browser or Extension Host UI certification is claimed.
