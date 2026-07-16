# Build an SNL document

> Use this guide to select the right phase or partial workflow.

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
