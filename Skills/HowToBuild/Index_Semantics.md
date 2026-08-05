# Build the semantic index (建立语义索引)

> Use this to connect macros to defining Entries and stable external sources.

### Phase 5 — Semantic Indexation (建立语义索引)

**Purpose.** Wire each macro back to the entries and external
resources that define / justify it. This is what turns the document
from "typeset LaTeX with fancy colors" into a **queryable
knowledge graph** — hovering a macro in the reader can jump to its
defining entry; agents can trace concept dependencies.

**Deliverables (edits to phase-2 macro packages).**
- For each `MacroPackageEntry`, fill in `source`:
  - `entries: string[]` — one or more globally unique Entry ids (from `entries/*.json`)
    that define / axiomatize / introduce this concept. Usually the
    Definition entry for the concept, sometimes plus a Theorem that
    justifies the notation.
  - `urls: string[]` — external references (nLab, Wikipedia,
    Mathlib docs, arXiv). Cite the concept, not the paper it
    appeared in.

**Tools.**
- ✅ `snl-lint-package` — validates schema, but does NOT currently
  check that `source.entries[]` ids resolve in the live Entry entity pool. That
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
