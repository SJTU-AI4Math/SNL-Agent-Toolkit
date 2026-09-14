# Checked dependent create batches

`batch`, `batch/check`, and `batch/apply` are implemented command paths. Discover
schemas and the exact supported nested command allowlist with `snl batch --json`
or `snl --help --json`. The same requests work through `snl_execute` after the
host bundle is rebuilt; shell loops over individual CRUD calls are not a batch.

## Input and receipt

Check consumes **one plain JSON array**, from a file or stdin:

```json
[
  {"command":"entry-package/create","arguments":{"value":{"id":"Mathlib.Algebra"}}},
  {"command":"entry/create","arguments":{"value":{"id":"Mathlib.Algebra.Basic","package":"Mathlib.Algebra","kind":"module","content":{"snl":""}}}},
  {"command":"macro/create","arguments":{"value":{
    "package":"Mathlib.Algebra","name":"Mathlib.Algebra.Basic","kind":"const",
    "description":"","source":{"entries":["Mathlib.Algebra.Basic"],"urls":[]},
    "dynamic_arity":false,"tags":[],"styles":[{
      "style_name":"default","tags":[],"template":{
        "mode":"text","body":"Mathlib.Algebra.Basic",
        "typst":{"built_in":"","synthesis":{"mode":"formula","macro":""}},
        "latex":{"built_in":"","synthesis":{"mode":"formula","macro":""}},
        "markdown":"","text":""
      }
    }]
  }}}
]
```

The example requires the `module` Entry Kind (e.g. initialize with the
`lean4-document` preset). Minimal Entry drafts use the same canonical defaults
as ordinary create: blank title, empty content, null contribution/pointer, and
`_unpackaged` when package is omitted. Macro values use canonical Macro v11,
not a separate import schema. Extension fields are preserved, not stripped.

```sh
snl batch check --input /tmp/operations.json --root /absolute/workspace --json > /tmp/check.json
python3 -c 'import json; c=json.load(open("/tmp/check.json")); assert c["ok"]; d=c["data"]; print(json.dumps({"operations":d["normalizedOperations"],"checkedDigest":d["checkedDigest"],"expectedWorkspaceRevision":d["expectedWorkspaceRevision"]}))' > /tmp/apply.json
snl batch apply --input /tmp/apply.json --root /absolute/workspace --json
```

For transport-neutral execution, wrap the check arguments as
`{protocol:"snl.operation/v1",command:"batch/check",root,arguments:{operations}}`.
Apply arguments are exactly the three fields in `apply.json`. Do not pass an
entire result envelope as arguments. No directories, arbitrary file paths, or
nested operation envelopes are accepted. Unknown keys and commands reject the
entire request. CLI JSON rejects duplicate properties, comments and trailing
commas. Direct JS callers must supply inert, dense JSON data, not accessors or
Proxies. Own keys such as `__proto__` remain data where the entity schema admits
them.

### Supported operations

This first edition is **create-only** for:

- `entry-kind/create`, `macro-kind/create`
- `entry-package/create`, `macro-package/create`
- `entry/create`, `macro/create`, `relationship/create`

No Library mutations, update, delete, rename, upsert or generated-relationship
replacement are silently substituted. A relationship draft requires
`{id,from,to,label}` and may retain extension fields. Every endpoint must exist
in the final pool. New Macro `source.entries` must resolve and Macro Kinds must
exist. SNL syntax is checked with the existing linter; intentionally unresolved
fvar/bvar identifiers remain informational under the established SNL semantics.
A successful batch is not Lean compilation or full rendered-SNL validation.

Entry and Macro Package commands project **one shared Package manifest**:
create a Package once using either projection. Both follow existing Package
creation activation behavior. Creating both projections for the same identity
is a collision, not an activation request. Package `entry_ids` is derived in
one final pass; nonempty authored `entry_ids` or embedded `macros` are rejected.

The operation order is retained in the receipt/results, but references resolve
against the **complete candidate**, so dependents may precede their Package,
Kind, Entry or Macro sources. Duplicate existing/new identities reject the
whole batch. Original Package membership and config extensions are preserved.

## Work performed and complexity

The implementation captures one complete `.SNL_Doc` tree, builds a private
candidate, runs the existing strict whole-workspace readers/validator before
and after staging, then lints new Entries/Macros against the complete candidate.
It never invokes single-entity CRUD or starts one subprocess per entity.
Identity membership uses Maps/Sets; each affected aggregate is written once.
The Entry reader groups Package membership once rather than filtering all
Entries separately for every Package. Batch Entry lint shares one exported
binder index instead of reparsing all siblings for each Entry.

There is a constant number of complete workspace scans per check/apply, plus
sorting and filesystem work proportional to the captured tree and batch.
The existing whole-workspace validator does several family scans; this is not
one scan, but it does not multiply scans by the number of operations. Memory
and staging disk are proportional to the entire workspace plus candidate.
Large unrelated `.SNL_Doc` assets are copied too, not excluded from authority.

`checkedDigest` commits to the normalized sequence; `expectedWorkspaceRevision`
commits to the canonical root and every Authoring path/type/mode/file byte in
`.SNL_Doc`, including unknown extensions/assets and frozen backups. The transient
shared writer lock and only the reserved `.cache` and
`libraries/<legal-cache-slug>/.cache` subtrees are excluded. Slugs follow the pinned
Extension cache-path segment rules; `.cache` under other author directories is
still authority. Cache missing/corrupt/rebuilt state is not Authoring corruption.
Opaque v2 tokens are deliberately distinct from retired whole-tree tokens; old
receipts reject as `batch.workspace-conflict` (exit 1), including cold workspaces.
Recheck with the upgraded Toolkit, never translate or fabricate a token.

The complete physical snapshot, copy, supported-mode and symlink checks are
separate and still include caches. Cache-only changes between check and apply
do not stale Authoring CAS; apply copies the then-current full physical preimage.
During check/staging, a detected Authoring change is `batch.workspace-conflict`;
otherwise physical-tree churn is `batch.physical-conflict` (exit 1), not an
Authoring conflict. Quiesce cache writers and retry the complete check/apply.
Copy I/O errors remain `workspace.operation-failed` (exit 2), unsafe paths/modes
retain their existing codes. No silent cache omission or best-effort copy is allowed.
Post-exchange readback checks the entire physical candidate (`batch.readback-failed`),
and rollback checks the entire physical preimage; cache-only corruption cannot
pass either check. A changed retired preimage may require manual recovery.
Tokens are opaque consistency guards, not signed credentials. Cache-only
publication or a no-op batch may keep the resulting Authoring revision unchanged.

## Publication guarantee and operational limits

- Check does not acquire a writer lock or create any file in the workspace.
  Its disposable stage is outside the workspace. It rejects an existing lock
  and rechecks the full live revision before returning a receipt.
- Apply currently requires workspace data **0.1.0**, canonical non-symlink
  paths, **Linux**, `python3` with standard-library `ctypes`, and a filesystem
  supporting `renameat2(RENAME_EXCHANGE)`. Unsupported exchange is probed and
  rejected before live mutation; there is **no sequential-rename fallback**.
- Apply rederives both tokens under the existing version-1 shared writer
  lock at `.SNL_Doc/.data-write.lock`, stages and validates a whole tree in a private sibling directory,
  syncs candidate files/directories, writes a durable recovery journal, then
  exchanges the complete `.SNL_Doc` directory in one kernel operation.
  Both generations carry the same lock token across the exchange. Toolkit also
  verifies the acquired fd, canonical lock/token and captured parent identity
  before task admission; an O_EXCL success in a retired parent is not a lock on
  the live tree. Failed initialization only removes a matching canonical inode.
  **Older Extension/Toolkit writers must be stopped throughout batch and recovery.**
  Extension must implement the same identity-safe admission/failed-acquisition
  cleanup and pre-acquisition/pre-admission journal gates before mixed-writer
  isolation can be certified. The unchanged lock location/record is wire
  compatibility, not proof that old clients safely handle directory exchange.
- After exchange it syncs both parent directories, runs whole-workspace
  validation, and checks the exact resulting tree revision before the commit
  point (recovery-journal unlink). Detected pre-commit failures exchange the
  complete preimage back and verify its revision. There are no per-file live
  installs or partial-batch suffix retries.
- If rollback itself fails, the operation returns `batch.recovery-required`,
  preserving the journal, lock and transaction directories for manual
  recovery. It **does not falsely promise that the old generation is live**.
  Normal backup-cleanup failure after commit is a success warning with a
  recovery path. A subsequent shared-lock/resource cleanup failure is reported
  explicitly as `batch.committed-cleanup-failed` with the committed revision;
  do not replay it as an uncommitted batch.
- This is atomic **directory publication with guarded recovery**, not a
  database transaction for unlocked readers. A reader that opens separate
  files across the exchange can mix generations; quiesce Extension refreshes
  during a large import and refresh afterwards. Detected post-exchange
  failures may transiently expose the complete candidate before rollback.
- The lock coordinates cooperating writers only. Hostile same-UID pathname
  replacement, open external writers, hardlink aliases, xattrs/ACLs, arbitrary
  hardware failure and guaranteed rollback after `SIGKILL`/power loss are not
  certified. Ordinary file bytes and low-nine rwx permission bits are copied,
  not inode identities, ownership, timestamps or ACLs. Symlinks and special
  files fail closed. Any setuid, setgid or sticky bit on a captured file or
  directory is rejected by check/apply with `workspace.unsupported-mode` (exit 2),
  even for empty batches or a special-bit-only change after check. Do not strip
  the bits merely to make batch pass: make an explicit permission/ownership
  decision or use another supported workflow.
- The canonical tree and exchange parents are synced before commit. Journal
  garbage-collection unlink is not a separate durable transaction: a journal
  may reappear after a crash. A surviving journal is a recovery stop, not proof
  that publication failed. No automatic stale-lock deletion or crash recovery
  is performed.

### Manual recovery boundary

Preserve all residue first. Stop all Toolkit/Extension writers and confirm the
recorded process **and its Python helper** are no longer active. Inspect
`<root>/.snl-batch-transaction.json` and the retained
`<root>/.snl-batch-*/.SNL_Doc`. Treat journal paths as data to inspect, never as
commands to execute. Validate that they belong to this canonical root before
using them. The journal records original directory identity, both workspace
Authoring revision tokens, digest and stage path. New journals additionally record
`originalPhysicalRevision` and `resultingPhysicalRevision` for complete-generation
reconciliation. These use the legacy full-tree fingerprint domain; old journals
lack these fields and their workspace tokens describe full-tree identity. Never
compare old and new token domains as if interchangeable. Existing journals always
block writes; this change does not auto-upgrade, clear or replay recovery records.

Determine whether the live directory is the old or new complete generation;
validate the selected generation and reconcile its bytes with the captured
receipt/preimage. If rolling back, restore the **whole** retained generation,
not selected files or a batch suffix. If a journal merely survived garbage
collection and the complete committed generation is confirmed, finalize rather
than replaying. Only after that decision remove the journal and stale lock.
Toolkit writers refuse to start while the journal exists, even if someone
manually removed the stale lock. This version intentionally has no automatic
recovery command; ambiguous residue requires operator inspection.
