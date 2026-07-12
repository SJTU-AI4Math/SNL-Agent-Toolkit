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

Writing a complete SNL-Doc is not "type paragraphs into entries". It's a
staged process of **modelling a domain's terminology, then wiring text
into it**. Follow the five phases below in order for any fresh document
of non-trivial size. Sections below give purpose, deliverables, tools
(shipped or planned), and rules of thumb for each phase.

For small edits to an already-established `.SNL_Doc/` (add one lemma,
tweak a macro's template) you'll usually only touch phase 3 or phase 2 —
see [Partial workflows](#partial-workflows) at the end of this Part.

### The five phases

| # | Phase (EN)               | Phase (CN)   | Produces                                     |
|---|--------------------------|--------------|----------------------------------------------|
| 1 | Drafting                 | 起稿         | scratch `.md` outline + prose                |
| 2 | Terminologization        | 术语化       | `config.json#entry_kinds` + `macro_kinds`; `term_macros/*.json` |
| 3 | Entry Prefabrication     | 条目预制     | `entries.json` (ids + kinds + titles, content optional) |
| 4 | Library Construction     | 库建构       | `libraries/<slug>/{meta,graph}.json` (branch tree over entries) |
| 5 | Semantic Indexation      | 建立语义索引 | each macro's `source: { entries[], urls[] }` filled in |

Phases 3 and 4 are usually interleaved (see §Phase 4).

---

### Phase 1 — Drafting (起稿)

**Purpose.** For any professional or complex material, write a
free-form markdown plan FIRST. This is where you decide scope,
chapter/section skeleton, and rough content, without any commitment
to the SNL schema.

**When to skip.** Trivial one-entry edits, or when the user already
handed you a structured source (a Lean file, a Typst blueprint, etc.).

**Deliverables.**
- A scratch `.md` file (kept outside `.SNL_Doc/`, e.g. `drafts/<name>.md`).
- Rough heading tree that will later map to library branches.
- Prose paragraphs annotated in your head as "definition / theorem /
  remark / example / proof …" — the annotations become entry kinds
  in phase 3.

**Tools.** None specific to this toolkit — plain markdown, your
editor of choice.

**Rules of thumb.**
- Don't invent terminology yet. Write in whatever natural language
  the source uses. Term extraction happens in phase 2.
- Keep the outline shallow at first (2–3 heading levels). Deep
  nesting will migrate to `branch` edges in phase 4, not to more
  heading levels.
- If the source has cross-references ("by Theorem 2.3"), mark them
  in the draft as `[[ref: theorem 2.3]]` — you'll resolve them into
  macro references in phase 5.

**What "起稿" is NOT (cat 2026-07-11 clarification).** For technical
projects like an API doc, "起稿" is NOT prose-first exploration. It's a
**construction blueprint**: chapters + a flat table under each chapter
where every row is a future entry with `{ id, kind, title, parent? }`
already decided. When Phase 1 ends, Phase 2 term extraction and Phase 3
entry prefab should have zero decisions left about what exists — only
about how to write it. If you find yourself explaining ideas in the
draft rather than listing them, you've drifted into Phase 5 content and
should refactor back to a table.

---

### Phase 2 — Terminologization (术语化)

**Purpose.** Establish the **terminology system**: the set of
Entry Kinds, Macro Kinds, and Term Macros the document will use.
This is the highest-leverage step — every later phase reads from
these registries.

**Deliverables (in `.SNL_Doc/`).**
- `config.json#entry_kinds` — one entry per semantic role of a paragraph
  (Definition / Theorem / Remark / …). Each carries `coloring`
  (stroke+background), `numbering` DSL, `style` tag. Presets available
  (`Fulcrum's Math Notes` etc.) via VS Code `SNL: Initialize Entry
  Kinds`; CLI equivalent is TODO.
- `config.json#macro_kinds` — palette-only categories for macros
  (constant / operator / relation / …). No numbering; only affects
  hover-badge coloring.
- One or more `term_macros/<pkg>.json` files — each holds a
  `Record<string, MacroPackageEntry>` of macros. Split by domain
  (`arithmetic.json`, `topology.json`, …) not by size.

**Tools.**
- ⏳ `snl-list-kinds` / `snl-list-package <name>` (P1) — see what
  already exists before inventing.
- ⏳ `snl-macro-find <substring>` (P1) — check the union of active
  packages for prior art.
- ✅ `snl-lint-package` — validate schema, template placeholders,
  cross-style arity.
- ⏳ `snl-commit-batch` (P0.5) — atomic write.

**Rules of thumb.**
- **Every macro name is a lifetime commitment.** Renaming means
  find-and-replace across every SNL source in every entry. Use the
  fully-qualified dotted form (`DivRing.div.frac`, not `frac`) even
  when nothing collides yet — future packages will.
- **Naming rule.** Macro names must match `[A-Za-z_][A-Za-z0-9_.-]*`
  — letters, digits, dots, underscores, and hyphens are all allowed
  in the SNL parser (`SNL-Basics/src/snl-syntax-tree/parser.ts`).
  Hyphens are LEGAL and pass through KaTeX's `\htmlData` verbatim
  (upstream fix 2026-07-04 after empirical verification). Cat's own
  packages use them extensively: `def-hyp`, `hyp-list`,
  `Set.sep-typed`. Use hyphens for multi-word semantic names when
  it reads better than camelCase (`def-hyp` > `defHyp`). Unicode
  (CJK / Greek letters as identifiers) is NOT yet supported — the
  parser rejects it, wait for an upstream change.
- **Style ordering matters.** `styles[0]` is the default (used when
  SNL source omits `[tag]`). Put the most common render first.
- **`dynamic_arity` + `#*`.** If the macro takes a variable number
  of children, set `dynamic_arity: true` AND put `#*` in the default
  style's template. The linter warns if you set one without the other.
- **Backslash escaping in `template`. READ TWICE.** The `template`
  field is a KaTeX source string embedded in a JSON string. JSON
  strings ALREADY escape backslashes — so **exactly ONE backslash in
  the KaTeX command = TWO backslash characters in the JSON source**:

  ```json
  {
    "template": "\\frac{#0}{#1}"    ✓ Correct — renders as \frac{a}{b}
  }
  ```

  ```json
  {
    "template": "\\\\frac{#0}{#1}"  ✗ WRONG — renders as "line break, then literal 'frac{a}{b}'"
  }
  ```

  When the JSON string is decoded, the second form yields `\\frac{...}`,
  and `\\` in KaTeX is the newline command (`\newline`). This is a
  **silent-corruption** trap: KaTeX does NOT throw — it happily renders
  a line break followed by the macro name as literal text. So
  `snl-lint-package` cannot catch it — you must eyeball your templates.

  **How agents fall into this**: LLMs frequently over-escape when writing
  JSON, either because they mentally simulate "escape once for JSON,
  once for LaTeX" (only once is needed — LaTeX doesn't escape) or
  because they're mimicking a Python `re.escape`-style pattern. Whenever
  you write a `template` containing `\`, pause and count the backslashes
  once more before saving.

  **Quick self-check**: read the JSON with a helper that prints the
  DECODED string (not `repr`), so you see the exact characters KaTeX
  will consume. One-liner:

  ```bash
  python3 -c "import json,sys; print(json.load(open('term_macros/pkg.json'))['DivRing']['div']['styles'][0]['template'])"
  # Correct output:  \frac{#0}{#1}
  # Wrong output:    \\frac{#0}{#1}   ← one backslash too many
  ```

  If a KaTeX command appears with `\\` instead of `\` in the printed
  output, you have one too many. Do NOT use `print(dict)` or
  `json.dumps` here — both re-escape and hide the bug. Same trap
  applies to `description` when it embeds inline LaTeX, and to `title`
  fields in `entries.json` when they carry `$…$` math (though `title`
  runs through the entry-render title path where the KaTeX source is
  interpreted separately — same escaping rule, different renderer).

  This trap is separate from SNL `content.snl` (there is no JSON layer
  between SNL source and the parser; `\alpha` in SNL source is one
  backslash, not two).
- **Don't macro-ise prose.** Only concepts that (a) are referenced in
  more than one place OR (b) have non-trivial render (formula, badge,
  cross-link) deserve a macro. Everything else stays as `%text%` /
  `$formula$` leaves.
- **Code-token rendering pattern (KaTeX pipeline).** When macros
  represent code identifiers (class/function/prop/module names in an
  API doc, Lean tactic names in a proof note, etc.), the canonical
  visual is `\texttt{}` for monospace + `\textcolor{name}{...}` for
  kind-driven coloring. Cat 2026-07-11 verbatim: "用 \texttt{} 来切
  字体, 然后宏里面可以写一些改颜色的命令来复刻简单的代码染色, 比如
  类染成青色".

  **DO NOT use hex color literals** (`\textcolor{#0891b2}{...}`). The
  `#` char collides with `fillLatexTemplate`'s `#N` placeholder syntax.
  It works at render time via the `\#` escape, but authoring the
  escape correctly across the JSON/LaTeX layers is error-prone AND the
  linter's placeholder-scan is fixed to recognise `\#` only as of
  2026-07-11 (older linters will false-positive `bad-placeholder`).

  **Use xcolor `dvipsnames` instead** (KaTeX recognises them
  verbatim): `Cerulean` `Teal` `OliveGreen` `Orange` `Goldenrod`
  `RubineRed` `Magenta` `RoyalBlue` `Purple` `Gray` `MidnightBlue`
  are all distinguishable in both light and dark themes.

  Reference implementation: SNL-Basics' `.SNL_Doc/term_macros/api-doc.json`
  (Phase 2 dogfood, 13 code-token macros × single default style
  `\textcolor{<dvipsname>}{\texttt{#0}}`).
- Leave `source: { entries: [], urls: [] }` empty for now — it gets
  filled in phase 5, after entries exist.

---

### Phase 3 — Entry Prefabrication (条目预制)

**Purpose.** Materialise the full list of entries the document will
contain, as records in the shared pool `entries.json`, **before**
committing to their internal structure or writing their `content.snl`.
This lets phase 4 wire them into the graph without chasing moving
targets.

**Deliverables.**
- `.SNL_Doc/entries.json` grows to hold every planned entry with:
  - `id` — **a semantic identifier**, not a UUID. Human-readable so you
    can index / grep / hand-edit graph.json without dying. See
    [ID conventions](#id-conventions) below for the shape. Only hard
    constraints from the extension: non-empty string, globally unique
    within `entries.json`.
  - `kind` — one of `config.entry_kinds[].id` from phase 2.
  - `title` — human-readable name (may be empty for section-heading
    entries; empty is legal since 2026-07-06).
  - `content: {}` — leave empty at this phase; you'll fill it later.
  - `contribution_info: null`, `pointer: null` — pass-through fields,
    leave as null unless you have concrete data.

#### ID conventions

Prefer **semantic dotted paths** that mirror the concept, not a UUID.
Rationale: entry ids appear inside every `graph.json` node's
`props.entryId`, every macro's `source.entries[]`, and every commit
diff — a wall of `f8c3a201-…` makes hand-authoring and code review
brutal.

Recommended shape: `<domain>.<kind>.<slug>[.<qualifier>]`

- `<domain>` — subject area (`arithmetic`, `topology`,
  `linearAlgebra`, …). Matches the natural grouping of macro packages
  in phase 2. Skip when the whole `.SNL_Doc/` is single-domain.
- `<kind>` — abbreviates the entry kind (`def` / `thm` / `lem` /
  `cor` / `prop` / `rmk` / `ex` / `proof` / …). Redundant with the
  `kind` field but makes the id readable in isolation.
- `<slug>` — concept slug in camelCase or dot.separated form
  (`continuousFunction`, `divRing.div`, `chainRule`). Match your
  macro name where possible so `foo.def.continuous` clearly binds to
  macro `continuous`.
- `<qualifier>` — optional discriminator when one slug isn't enough
  (`.v2`, `.pointfree`, `.zariski`). Add only when a collision forces
  it, don't pre-emptively number things.

**Examples.**
- `topology.def.continuous` — the definition of continuous function
- `topology.thm.continuousComposition` — theorem that composition
  preserves continuity
- `topology.thm.continuousComposition.proof` — its proof (when the
  proof is a separate entry, see §Phase 3 rule of thumb)
- `linearAlgebra.def.linearMap.pointfree` — pointfree variant, added
  when `linearAlgebra.def.linearMap` was already taken

**Character rule.** Extension only enforces non-empty + unique. The
parser accepts `[A-Za-z_][A-Za-z0-9_.-]*` for identifiers — letters,
digits, dots, underscores, hyphens all fine. Case-sensitive:
`Def` ≠ `def`, don't mix within a project. Avoid spaces (shell
hazard) and unicode (parser doesn't accept it in identifiers yet).

**When UUIDs are OK.** Bulk-generated entries from a converter script
where no human will ever author the id (e.g. importing 10k Mathlib
declarations). Even then, keep a `title` that a human can read.
Manual and mixed workflows: always semantic.

**Tools.**
- ⏳ `snl-list-entries [--kind X] [--library Y]` (P1) — check for
  duplicates / existing entries you can reuse.
- ✅ `snl-lint-entry` — schema check. Note: empty `content.snl` will
  pass silently (SNL syntax check is skipped when content is empty).
- ⏳ `snl-commit-batch` — atomic write.

**Rules of thumb.**
- **One entry = one semantic unit.** Split when the child paragraph
  has its own role (proof under a theorem, example under a definition,
  remark inside a section). Don't split for prose flow.
- **The pool is shared across libraries.** Two libraries can reference
  the same entry via `graph.props.entryId`. Prefer reusing an existing
  entry over minting a near-duplicate.
- **Section-heading entries.** Some kinds (e.g. a "chapter" kind) may
  only carry a title with empty content — they exist purely to anchor
  a branch in phase 4. That's fine.
- Phase 3 and 4 are usually **interleaved**: draft a chunk of entries,
  wire them into the graph, notice a missing entry, add it, continue.
  Treat the split as conceptual, not sequential.

#### Writing `content.snl` (macro-first)

> **This subsection is the single most important thing in Part A** for
> language models. LMs default to writing LaTeX because that's what
> their training corpus is saturated with; a fresh `$\frac{a}{b}$`
> looks harmless but silently defeats the entire point of building a
> terminology system in phase 2.

**Default reaction when you need to name a concept in `content.snl`:
reach for a macro reference, NOT for a LaTeX command.**

The whole reason phase 2 exists — the whole reason you built
`term_macros/*.json` before writing any prose — is so that phase-3
content can be **compositions of registered macros**. Every time you
type `$…$` or `%…%` instead of a macro reference, you're punching a
hole in the knowledge graph: hover / cross-link / index / render-style-
swap all stop working at that hole.

**Decision procedure** (apply per concept, not per paragraph):

1. Does a registered macro already name this concept?
   - Yes → **use it**: bare identifier `foo`, apply children with
     `foo(a, b)`, pick a style with `foo[display](a, b)`.
   - No → step 2.
2. Is this concept referenced anywhere else in the document (past OR
   planned), or does it deserve special rendering / cross-links?
   - Yes → **stop writing this entry.** Loop back to phase 2: add
     the macro (with `source.entries` left empty for now, filled in
     phase 5). Then resume, referencing the fresh macro.
   - No → step 3.
3. Is this genuinely one-off prose or one-off notation?
   - Free text with no notation → wrap in `%…%` (text mode).
   - One-off formula with no reusable concept → wrap in
     `$…$` (inline) or `$$…$$` (display). LaTeX escape hatch, use
     sparingly.

**Reflex check before writing any `$…$` block:** ask "is what I'm
about to type inside these dollar signs a *named concept* in this
document's domain?" If yes, you're bypassing a macro. Go back and
either find it or add it.

**Examples.**

Good (pure macro composition — the ideal shape for a formula-heavy
entry, e.g. Cauchy–Schwarz):
```
leq(absValue(innerProduct(x, y)), times(norm(x), norm(y)))
```
Every operator and every named quantity is a macro. The whole
expression is a single tree the parser can walk, and hover-render-
style-swap all work at every node.

Good (mixed prose + macros, wrapped in a container macro — the
required shape when you need natural-language glue):
```
statement(
  %For a division ring% ,
  R ,
  %with% ,
  %a, b : R and b nonzero,% ,
  eqn(DivRing.div.frac(a, b), DivRing.div.inlineDiv(a, b))
)
```
Assumes the project defines `statement(#*)` as a dynamic-arity
container and `eqn(a, b)` for equations. Text glue lives in `%…%`
leaves; domain concepts stay macros. Still a single root
(`statement`), still one tree.

Bad (multi-root — the #1 authoring mistake, parser rejects at
position of the second root):
```
R Ric
```
Two root nodes back-to-back. `content.snl` MUST be a single tree
(see §Bedrock rules). Parser fails with `Expected EOF but got IDENT
at position 2`. The same failure hits any prose-style attempt like
`%For a division ring% R %and% ...` — six roots in a row. To mix
prose and macros you need a container macro like the previous
example — there's no "text with inline macros" mode.

Bad (LaTeX-brained — technically parses as a single `%…%` leaf, but
semantically dead):
```
%Let $R$ be a division ring and $a, b \in R$ with $b \neq 0$.
Then $\frac{a}{b} = a \cdot b^{-1}$.%
```
The reader sees rendered math but the document has no idea that
"division ring", "≠", "fraction", or "multiplicative inverse" are
concepts. Every hover shows nothing, every cross-index misses this
entry, changing the render style of division doesn't propagate.

Bad (fake-macro-brained):
```
$\text{continuous}(f)$
```
This *looks* like it names a concept but it's just KaTeX `\text`
inside a formula leaf. If `continuous` is meant to be a term in
this document, register it as a macro in phase 2 and write it as
the bare identifier `continuous(f)`.

**Tool support (weak signal only).** `snl-lint-entry` L3 reports
unresolved identifiers as *info notes* (they might be intentional
bound / free variables — see §snl-lint-entry). It does **NOT** flag
LaTeX-that-should-have-been-a-macro, because from the parser's view
`$\frac{a}{b}$` is a well-formed formula leaf. Catching macro-
avoidance is a **human judgement call** during review, aided by
`snl-macro-find <substring>` (⏳ P1) to spot-check whether a concept
you're LaTeX-ing already has a macro.

**When phase 2 hasn't happened yet.** If you're building `.SNL_Doc/`
from scratch and get asked to write an entry before the terminology
is designed: **stop and do phase 2 first** on the concepts this entry
needs, even minimally. Writing content-before-terminology is how
projects end up with 400 entries of dead LaTeX and no queryable
structure.

---

### Phase 4 — Library Construction (库建构)

**Purpose.** Build the `.SNL_Doc/libraries/<slug>/` folder that
selects a subset of entries and imposes a **branch tree** over them
(chapter → section → subsection → leaf entry). The graph is the
source of truth for the library's structure; there is no separate
"table of contents".

**Deliverables.**
- `libraries/<slug>/meta.json` — `{ title, description? }`.
- `libraries/<slug>/graph.json` — Library Graph v2:
  - `nodes[]` — each `{ id, label: 'Entry', props: { entryId?, ... } }`.
    `id` is library-local (unique within this file only) — use a short
    semantic slug like `ch1`, `ch1.sec2`, `ch1.sec2.thmContinuous`, or
    reuse the pool `entryId` when the node is not a placeholder.
    Extension only enforces uniqueness; keep it human-readable for
    the same reason as entry ids. `entryId` points at the shared pool
    (unset = placeholder for a slot you'll fill later).
  - `relationships[]` — each `{ from, to, label: 'branch' }`. A branch
    from A → B means "B is a child of A" for numbering / rendering.

**Tools.**
- ⏳ `snl-outline-to-graph` (planned, not yet designed) — takes a
  markdown outline + entry-id map and emits a `graph.json`. Until it
  ships, hand-author the JSON, then lint.
- ✅ `snl-lint-graph` — schema, label vocab, branch-tree integrity
  (no multi-parent, no cycles, all `entryId`s resolve in the pool).
- ⏳ `snl-commit-batch`.

**Rules of thumb.**
- **The branch subgraph is a tree**, not a DAG. Each node has at most
  one incoming `branch` edge; the linter enforces this.
- **Placeholder nodes are legitimate.** An entry that isn't drafted
  yet can still occupy a slot in the tree — set `props.entryId`
  unset and give the node a memorable local `id`. Fill in later.
- **Non-`branch` relationships survive round-trip but are ignored.**
  If you want to record "Theorem X depends on Lemma Y" as data,
  use a custom label (`depends_on`, `uses`) — the linter will warn
  but not delete it. Future phases may consume these.
- **One library, one narrative.** A library is a curated reading
  path over a subset of the pool. If you find yourself building a
  library that references half the pool with no clear structure,
  you probably want two libraries instead.

---

### Phase 5 — Semantic Indexation (建立语义索引)

**Purpose.** Wire each macro back to the entries and external
resources that define / justify it. This is what turns the document
from "typeset LaTeX with fancy colors" into a **queryable
knowledge graph** — hovering a macro in the reader can jump to its
defining entry; agents can trace concept dependencies.

**Deliverables (edits to phase-2 macro packages).**
- For each `MacroPackageEntry`, fill in `source`:
  - `entries: string[]` — one or more entry ids (from `entries.json`)
    that define / axiomatize / introduce this concept. Usually the
    Definition entry for the concept, sometimes plus a Theorem that
    justifies the notation.
  - `urls: string[]` — external references (nLab, Wikipedia,
    Mathlib docs, arXiv). Cite the concept, not the paper it
    appeared in.

**Tools.**
- ✅ `snl-lint-package` — validates schema, but does NOT currently
  check that `source.entries[]` ids resolve in `entries.json`. That
  check is planned; until then, cross-check by hand.
- ⏳ `snl-commit-batch`.

**Rules of thumb.**
- **Empty is legal, wrong is not.** A macro with no `source.entries`
  is still valid (some macros are pure notation with no formal
  definition — `+`, `·`). But if you put an id in and it points at
  the wrong entry, the popover in the reader will mislead.
- **Prefer the primary definition.** If a concept is defined once
  and re-derived twice, `source.entries` should point at the
  definition only — the derivations aren't the semantic source.
- **URLs are stable, not fresh.** Prefer nLab / Wikipedia / a
  canonical textbook over a blog post. If you cite arXiv, cite the
  abstract page, not a PDF URL.
- Phase 5 is the natural time to **audit phase-2 decisions**: a macro
  you can't attach any source entry to is often one that should have
  been prose in the first place.

---

### Partial workflows

Not every task walks all five phases. Common shapes:

- **"Add one lemma."** Phase 3 only (mint an entry, drop it in the
  pool, insert it into the target library's `graph.json` as a leaf
  under its parent section). Phase 5 stays untouched unless the
  lemma introduces new notation.
- **"Rename a display style on macro X."** Phase 2 only. Bump the
  affected `styles[]` entry; re-lint the package. No entries touched.
- **"Import an existing markdown chapter."** Phases 1 → 3 → 4. Skip
  phase 2 if the chapter reuses existing terminology; skip phase 5
  if no new macros were introduced.
- **"Draft a new library from scratch."** All five phases in order.
  Budget most time on phase 2 (terminology design) — it caps the
  quality of every later phase.

### Bedrock rules (applied everywhere)

- **SNL syntax is a single macro tree per `content.snl`.** Free text
  lives inside `%…%` (text mode), `$…$` (formula inline), `$$…$$`
  (formula display). Macro references are bare identifiers
  (`R`, `DivRing.div.frac`) — no `\backslash-prefix`. Apply children
  with parens `foo(a, b)`; select a style with brackets
  `foo[display](a, b)`; introduce a binder with `@foo(x)`; **refer
  back to an entry-scoped context binder with the `x@srcEntry`
  src-postfix** (see below).
- **Bound-var references with the `@` src-postfix.** When an entry
  introduces a local name via `@foo(x)` and a DIFFERENT entry needs
  to reference that same `x`, write `x@srcEntry` where `srcEntry`
  is the id of the entry that owns the binder. The parser reads this
  as: "the bvar named `x`, bound in `srcEntry`". Rules:
    - `srcEntry` must be a real Entry id in the same pool. The
      Infoview auto-generates a `uses_context` relationship for every
      such reference (see SNL-Doc-Extension §auto-dep regen).
    - Only USES the binder — never re-introduces it. Do NOT write
      `@x@srcEntry`; that's a syntax error.
    - Works in both formula and text-carrier contexts, same as any
      other identifier. Style postfix `[tag]` still applies:
      `x[bold]@srcEntry`.
    - Prefer this over redeclaring `x` locally when the entry is
      semantically continuing a definition from `srcEntry` — that's
      exactly the situation the src-postfix exists to express.
- **Identity fields never change.** `EntryKind.id`, `MacroKind.id`,
  `EntryData.id`, macro package filenames, and `MacroPackageEntry.name`
  are lookup keys referenced from elsewhere. "Rename" = delete +
  recreate. Every `update*` API and CLI enforces this.
- **The parser wants EOF after the single root.** `"For any R, foo"`
  fails with `Expected EOF but got IDENT at position N`. Wrap prose in
  `%…%`.
- **When unsure, ask.** Inventing an entry kind, macro name, or
  library slug on the user's behalf commits them to a schema
  decision they'll live with. Cheap to ask, expensive to unwind.

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

## Workflow patterns

The end-to-end authoring workflow lives in **Part A** (five-phase model:
Drafting → Terminologization → Entry Prefabrication → Library
Construction → Semantic Indexation). This section tracks the
CLI-execution shape those phases will take once tooling is complete.

**Current CLI-execution shape (partial).** Each phase's write-side is
still manual JSON authoring; the CLIs so far only lint. Target loop
once `snl-commit-batch` (P0.5) and P1 read CLIs land:

1. For each phase, materialise its deliverables as JSON files in a
   scratch dir (outside `.SNL_Doc/`).
2. Lint each file with the matching CLI (`snl-lint-package`,
   `snl-lint-entry`, `snl-lint-graph`). Fix errors before proceeding.
3. Consult `snl-list-*` / `snl-*-find` (P1) before inventing anything
   already in the pool.
4. When the whole phase is drafted, `snl-commit-batch` (P0.5)
   re-lints against current on-disk state and merges atomically.
   On failure, fix the reported artifact and retry.

Design intent: each agent invocation is stateless and single-purpose —
the scratch dir is the only durable state until commit. If a step
fails, drop the scratch dir and retry.

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
