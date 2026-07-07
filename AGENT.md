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

### Status: bootstrapping

- ✅ **`snl-lint-entry`** — schema + SNL syntax + reference lint for EntryData JSON payloads.
- ⏳ **`snl-lint-graph`** — schema + branch-tree lint for library graph.json.
- ⏳ **`snl-lint-package`** — schema + template lint for macro package files.
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
