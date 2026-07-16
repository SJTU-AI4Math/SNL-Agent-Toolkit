# Toolkit workflow and roadmap

> Use this to understand the current CLI execution model and planned capabilities.

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
