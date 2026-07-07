# AGENT.md — SNL Agent Toolkit

> Read this **first** when you (an agent) are asked to write, edit, or organise
> SNL documents in a `.SNL_Doc/` workspace.

This document has two parts. Depending on the task, you may only need one.

- **Part A — Authoring SNL content.** Rules for how to write SNL syntax, how to
  choose entry kinds, when to split a subentry, and macro conventions. Read this
  for ANY SNL-writing task, even if you're not using this toolkit's CLIs.
- **Part B — Toolkit CLIs.** Search / validate / commit CLIs that let you interact
  with a project's `.SNL_Doc/` folder without the VS Code extension installed.

---

## Part A — Authoring SNL content

_Placeholder — to be filled once we've run the first spike with real data._

Short version of what will go here:

1. **What SNL is.** A macro-expression language. **The entire `content.snl`
   field is one macro tree — not "prose with inline macros".** Free text
   lives inside `%…%` (text mode) or `$…$` / `$$…$$` (LaTeX inline / display)
   delimiters, which become leaf nodes of the tree. A single macro reference
   is written as a bare identifier (`R`, `DivRing.div.frac`), NOT with a
   `\backslash-prefix`. Applying a macro to children uses parens:
   `foo(a, b)`. Selecting a render style uses square brackets:
   `foo[display](a, b)`.
2. **Entry kinds.** The project defines its own set — theorem / definition /
   remark / example / etc. Each has a coloring + numbering template. Pick the
   kind that matches the paragraph's semantic role. Use `snl-list-kinds` to see
   what's available. If nothing fits, ask before inventing one.
3. **When to split into subentries.** Rule of thumb: a subentry is warranted
   when the child paragraph has its OWN semantic role (a proof of a theorem, an
   example under a definition, a remark inside a section). Don't split for
   pure prose flow.
4. **Macros.** Named terms that render specially and can cross-reference other
   entries. Use `snl-search-macros` (P1, not shipped yet) before inventing a
   new one — the project likely already has `Ric`, `continuous`, etc. Naming a
   new macro is a commitment (it goes in the shared pool), so err on the side
   of using existing ones.

Full authoring rules to be written after we've run the first spike.

---

## Part B — Toolkit CLIs

### Status: P0 linters shipped

- ✅ **`snl-lint-entry`** — schema + SNL syntax + identifier resolution for EntryData JSON payloads.
- ✅ **`snl-lint-graph`** — schema + label vocabulary + branch-tree integrity for library graph.json.
- ✅ **`snl-lint-package`** — schema + template placeholder rules for macro package files.
- ⏳ **`snl-commit-batch`** — atomic merge of validated payloads into .SNL_Doc/.
- ⏳ **Read CLIs (P1)** — `snl-entry-get`, `snl-macro-get`, `snl-macro-find`, `snl-list-*`.

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
  `.SNL_Doc/entries.json`. Placeholder nodes (no entryId) are fine.

### snl-lint-package

Lint one or more macro-package JSON payloads (files in
`.SNL_Doc/term_macros/`).

```bash
# Lint every package on disk
node bin/snl-lint-package.mjs --root /path/to/project

# Named package (bare filename, no .json)
node bin/snl-lint-package.mjs --root . --name core

# Multiple packages — repeat --name
node bin/snl-lint-package.mjs --root . --name core --name blocks

# Draft package living outside .SNL_Doc/
node bin/snl-lint-package.mjs --root . path/to/draft-pkg.json
```

Checks:
- **Schema** — top-level `version` / `name` / optional `description` /
  `macros` (name → entry map). Per macro: `description` / `source` /
  `dynamic_arity` / non-empty `styles[]`. Per style: `tag` / `mode` /
  `template`. Style tags unique within one macro.
- **Template placeholders** — `#0`, `#1`, …, `#*` recognised; anything
  else (`#foo`, `#-1`, `##`, …) is an error. `#*` is only legal when the
  macro's `dynamic_arity` is `true`.
- **Sanity warnings** — a dynamic-arity macro whose **default** style
  (`styles[0]`) has a non-empty template with no `#*` gets warned
  (variadic children won't render); styles that set `variadic_left/join/
  right` on non-dynamic macros get warned (fields will be ignored).
  Custom-renderer styles (with a `react_renderer_key`) or empty-template
  styles are exempt — those bypass the template.
- **Cross-style arity** — when styles disagree on their maximum `#N`
  index, we surface an **info** note; legal (SNL fills missing children
  as empty) but often unintended — agent decides.

Note: cross-package name collisions and workspace-wide activation are NOT
checked here (the linter is file-local). Those checks will fold into
`snl-commit-batch` (P0.5).

### Common flag conventions

Every CLI accepts:

- `-r, --root <path>` — workspace containing `.SNL_Doc/`. Defaults to `.`.
- `--json` — output JSON instead of coloured human text (when supported).
- `-h, --help` — show usage and exit.

---

## Workflow patterns (planned)

_Placeholder — the full workflow lands once `snl-commit-batch` is shipped._

Rough sketch of the target loop:

1. Read source material (markdown / LaTeX / natural text) from the user.
2. Break it into paragraphs by heading structure (`#` → chapter, `##` → section,
   leaf paragraph → single entry).
3. For each leaf paragraph:
   a. `snl-macro-find <term>` (P1) to check for an existing macro before
      inventing one.
   b. `snl-list-kinds` (P1) if unsure what kind fits.
   c. Emit a JSON file into a scratch dir with your candidate EntryData.
   d. `snl-lint-entry` on the file. If errors → fix and retry. If only
      warnings → decide whether to register a new macro or accept.
4. When the whole document is drafted, `snl-commit-batch` (P0.5) validates
   the whole batch and merges atomically. On failure, fix the reported entry
   and retry.

Design intent: each agent invocation is stateless and single-purpose — the
scratch dir is the only durable state until commit. If a step fails, drop the
scratch dir and retry.

---

## Roadmap

**P0 — Linters (in progress).** `snl-lint-entry` shipped; `snl-lint-graph`
and `snl-lint-package` up next.

**P0.5 — Atomic commit.** `snl-commit-batch` — accepts a directory of validated
payloads, re-lints against the current on-disk state, and writes only if
everything passes.

**P1 — Basic reads.** Exact-lookup CLIs so agents don't reinvent existing
macros / entries: `snl-macro-get <name>`, `snl-macro-find <substring>`,
`snl-entry-get <id>`, `snl-list-kinds`, `snl-list-libraries`,
`snl-list-package <name>`, `snl-list-entries [--kind X] [--library Y]`.

**Future (post-spike).** Tag system, TED for entry lookup, LeanSearch-style
retrieval, multi-filter rerank pipeline. Depends on how large real docs get
before naive search stops cutting it.

---

## Contributing

- Every CLI: `.mjs` shim under `bin/` (shebang + hand off to `tsx`) +
  implementation under `bin/impl/*.ts`. Shared logic goes in `lib/`.
- Tests: `tests/*.test.ts` — run via `npm test` (uses tsx + node --test).
- Type check: `npm run lint-types` (tsc --noEmit).
- Schema drift: if `SNL-Doc-Extension/src/snlDoc.ts` changes, sync
  `schema/snl-doc.ts` per the procedure in `schema/README.md`.
