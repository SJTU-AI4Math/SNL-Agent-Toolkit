# Author Entries (条目预制)

> Use this to create Entry records and write macro-first `content.snl`.

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
