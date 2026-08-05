# Use the Toolkit CLIs

> Use this to lint Entries, Library graphs, and macro packages.

## Part B — Toolkit CLIs

### Status: reference-safe maintenance CLIs shipped

- ✅ **`snl-lint-entry`** — schema + SNL syntax + identifier resolution for EntryData JSON payloads.
- ✅ **`snl-lint-graph`** — schema + label vocabulary + branch-tree integrity for library graph.json.
- ✅ **`snl-lint-package`** — schema + template placeholder rules for macro package files.
- ✅ **`snl-find-refs`** — trace every structured definition/reference to an Entry or Macro id.
- ✅ **`snl-rename-id`** — collision-checked global Entry/Macro id rename with dry-run and rollback.
- ⏳ **`snl-commit-batch`** — atomic merge of validated payloads into .SNL_Doc/.
- ⏳ **Other Read CLIs (P1)** — `snl-entry-get`, `snl-macro-get`, `snl-macro-find`, `snl-list-*`.

### snl-lint-entry

Lint one or more EntryData JSON payloads against a workspace's `.SNL_Doc/`
context.

```bash
node bin/snl-lint-entry.mjs --root /path/to/project entry-draft.json [more.json ...]

# Machine-readable output for programmatic consumption:
node bin/snl-lint-entry.mjs --root . --json entry-draft.json

# Treat unknown-macro references as errors (default: warnings).
node bin/snl-lint-entry.mjs --root . --strict-macros entry-draft.json
```

**Exit codes:**
- `0` — clean, or warnings only
- `1` — at least one lint error
- `2` — CLI-level failure (bad flags, no `.SNL_Doc/`, unreadable JSON)

**Layered validation** the linter runs:

- **L1 (schema)** — id/kind/title/content/contribution_info/pointer presence,
  id-uniqueness against the shared pool, kind is one of `config.entry_kinds`.
- **L2 (SNL syntax)** — if `content.snl` is non-empty, it must parse via
  SNL-Basics's `tryParseSnlSyntaxTree`; parse errors carry the character
  offset.
- **L3 (identifiers)** — bare identifiers in `content.snl` that don't resolve
  to a registered macro are reported as **info notes** (not warnings, not
  errors). SNL intentionally falls back to fvar/bvar rendering for unbound
  identifiers, so an unresolved name may be a bound variable, a locally-scoped
  free variable, a typo, or a genuinely missing macro registration — the
  agent decides. Under `--strict-macros` these become errors (rare; typically
  off).

### snl-lint-graph

Lint one or more `graph.json` payloads (Library Graph v2) against the
shared entry pool.

```bash
# Lint every library on disk under .SNL_Doc/libraries/*/graph.json
node bin/snl-lint-graph.mjs --root /path/to/project

# Named library
node bin/snl-lint-graph.mjs --root . --slug my-lib

# Multiple slugs — repeat --slug
node bin/snl-lint-graph.mjs --root . --slug lib-a --slug lib-b

# Draft graph living outside .SNL_Doc/
node bin/snl-lint-graph.mjs --root . path/to/draft-graph.json
```

Checks:
- **Schema** — top-level `nodes[]` + `relationships[]` shape; node id
  uniqueness; per-node `id/label/props` and per-relationship `from/to/label`.
- **Label vocabulary** — v2 recognises `label: 'Entry'` (nodes) and
  `label: 'branch'` (relationships). Others get **warnings** (kept on disk
  round-trip, ignored by the numbering engine).
- **Branch integrity** — every branch edge's `from`/`to` resolves to a
  declared node; each node has at most one incoming branch (multi-parent
  = error); the branch subgraph has no cycles.
- **Pool references** — `props.entryId`, when set, must resolve in
  the live `.SNL_Doc/entries/*.json` pool. Placeholder nodes (no entryId) are fine.

### snl-lint-package

Lint one or more Macro payloads. Named mode assembles a Package from the live
Package manifest and per-entity Macro files; positional mode still accepts a
standalone synthetic Package JSON payload.

```bash
# Lint every package on disk
node bin/snl-lint-package.mjs --root /path/to/project

# Named Package (Package ID)
node bin/snl-lint-package.mjs --root . --name core

# Multiple packages — repeat --name
node bin/snl-lint-package.mjs --root . --name core --name blocks

# Draft package living outside .SNL_Doc/
node bin/snl-lint-package.mjs --root . path/to/draft-pkg.json
```

Checks:
- **Schema** — top-level `version` / `name` / optional `description` /
  `macros` (name → entry map). Per macro: `description` / `source` /
  `dynamic_arity` / required `default_style` / required `tags[]` /
  non-empty `styles[]`. Per style:
  valid unique `style_name`, `mode`, `template`, and required `tags[]`.
- **Template placeholders** — canonical `#0` through `#99` and `#*` are
  recognised; anything else (`#foo`, `#-1`, `##`, `#00`, `#100`, …) is an
  error. Escape a literal hash as `\#`. `#*` is only legal when the
  macro's `dynamic_arity` is `true`; every dynamic style must contain it.
- **Macro v8 rules** — `default_style` values resolve to declared styles;
  every template is a string; `separator`, when present, is a string (including
  explicit `""`); `block_template_name` is valid only in block mode; tags
  cannot contain backslashes; pre-v7 style fields are errors rather than
  runtime aliases.
- **Cross-style arity** — when styles disagree on their maximum `#N`
  index, we surface an **info** note; legal (SNL fills missing children
  as empty) but often unintended — agent decides.

Note: cross-package name collisions and workspace-wide activation are NOT
checked here (the linter is file-local). Those checks will fold into
`snl-commit-batch` (P0.5).

### snl-find-refs

Trace a stable Entry or Macro identity across every structured location in the
workspace:

```bash
node bin/snl-find-refs.mjs --root . --type entry algebra.def.group
node bin/snl-find-refs.mjs --root . --type macro Group
node bin/snl-find-refs.mjs --root . --type macro --json Group
```

For Entry ids, this covers the `entries/*.json` definition, Library graph
`props.entryId`, pool-wide relationship `from`/`to`, macro
`source.entries[]`, SNL `x@entry-id` references, and Extension-generated
relationship `metadata.postfixes[]` witnesses. For Macro ids, it covers the
package `macros` map key, actual SNL macro tokens, and generated relationship
`metadata.macros[]` witnesses. Style tags and `%…%` / `$…$` literal
environments are not misreported as Macro references. User-authored opaque
metadata remains outside the default migration boundary. Macro package definitions
are always reported, but SNL invocation references are attributed only to macros
resolved from `config.active_macro_packages`; renaming an inactive macro does
not rewrite same-spelled fallback variables.

### snl-rename-id

Synchronously rename one Entry or Macro identity and all references found by
`snl-find-refs`:

```bash
# Always inspect first.
node bin/snl-rename-id.mjs --root . --type entry --dry-run old.entry new.entry

# Apply after reviewing the plan.
node bin/snl-rename-id.mjs --root . --type entry old.entry new.entry
node bin/snl-rename-id.mjs --root . --type macro OldMacro NewMacro
```

Safety rules:

- the old identity must have exactly one definition;
- the destination must not already occur as either a definition or a reference
  (renaming never merges two identities);
- if the old identity has SNL references, the new identity must be expressible
  by the current SNL identifier grammar; JSON-only Unicode Macro identities
  remain traceable and renameable;
- every schema-owned JSON file and every non-empty SNL source must parse before
  any write; malformed reference fields fail closed instead of being skipped;
- JSON changes are source-range edits to the owning string token/property key;
  every unedited token—including opaque numbers, unknown fields, whitespace,
  key order, and CRLFs—remains byte-for-byte unchanged. The deliberately edited
  identity/SNL string token is re-encoded as valid JSON and may normalize its
  own prior escape spelling;
- `.SNL_Doc`, `packages`, `entries`, `macros`, `libraries`, Library slug directories, and schema
  files must stay within the canonical workspace and may not be symlinks;
  reads use `O_NOFOLLOW`, temporary files use exclusive creation, parent
  directories plus inode/content are checked again before installation, and
  original permission modes are preserved;
- writes acquire the Extension-compatible `.data-write.lock`, use same-directory
  temporary files, recheck each source immediately before its installation, and
  restore already-installed originals if a later replacement fails. Rollback
  refuses to overwrite/delete output that changed concurrently. This is
  guarded multi-file safety, **not crash-atomic transaction semantics**: process/machine failure
  between per-file renames can still require recovery from version control;
- only schema-owned identity/reference fields, generated relationship witness
  arrays, and parsed SNL tokens change; titles, Markdown/LaTeX/text, arbitrary
  user metadata, pointers, and unknown properties are not text-replaced;
- after installation, the workspace is reloaded and checked for exactly one
  new definition, zero stale occurrences, and the expected occurrence count;
  verification failure triggers rollback;
- `--dry-run` performs the complete validation and plan construction with zero
  writes.

### Common flag conventions

Every CLI accepts:

- `-r, --root <path>` — workspace containing `.SNL_Doc/`. Defaults to `.`.
- `--json` — output JSON instead of coloured human text (when supported).
- `-h, --help` — show usage and exit.

---
