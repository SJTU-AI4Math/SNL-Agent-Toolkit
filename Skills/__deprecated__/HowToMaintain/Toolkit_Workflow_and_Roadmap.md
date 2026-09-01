# Toolkit workflow and roadmap

> Use this to understand the current CLI execution model and planned capabilities.

## Workflow patterns

The end-to-end authoring workflow uses the five-phase model:
Drafting → Terminologization → Entry Prefabrication → Library
Construction → Semantic Indexation. Package, Entry, and Macro creation now use a
draft-to-CLI loop:

1. For each phase, materialise its deliverables as JSON files in a
   scratch dir (outside `.SNL_Doc/`).
2. Install Package, Macro, and Entry drafts individually with `snl-add-package`,
   `snl-add-macro`, and `snl-add-entry`. Each command re-reads and validates the
   live workspace under the writer lock before installing a canonical entity.
3. Lint resulting Packages, Entries, and Library graphs. Fix errors before proceeding.
4. Use `snoogle --entry <query>` or `snoogle --macro <query>` for fuzzy discovery,
   and consult the future exact/list reads where precise enumeration is required,
   before inventing anything already in the pool.

Design intent: each agent invocation is stateless and single-purpose. Drafts hold
business content only; envelopes, hashes, filenames, receipts, and locking stay
inside the Toolkit. Entry/Macro identity installation is no-clobber. Package config
updates coordinate through the writer lock and optimistic checks; on config failure,
the CLI preserves the manifest path and reports its effective activation from the
unchanged config instead of attempting an unlink that could race a non-cooperating
replacement. If `active_macro_packages` is omitted, the residue may already be active.

---

## Roadmap

**P0 — Linters (shipped).** `snl-lint-entry`, `snl-lint-graph`, and
`snl-lint-package` are available.

**P0.25 — Identity maintenance (shipped).** `snl-find-refs` traces structured
Entry/Macro definitions and references; `snl-rename-id` applies synchronized,
collision-checked renames with dry-run and rollback. The shared library additionally
offers SHA-provenanced two-phase plan/apply APIs. `snl-rename-style` applies the same
guarded model to one exact Package/Macro Style scope, including defaults and explicit
parser-resolved SNL Style selections, without touching same-named Styles elsewhere.

**P0.3 — SNoogL query (shipped).** `snoogle` accepts exactly one free-form
`--entry <query>` or `--macro <query>`, applies the shared fuzzy field-tier ranker
with AND-token semantics, and returns stable human or schema-versioned JSON output.
Macro search is limited to active Packages. Filter flags are intentionally not part
of this CLI contract.

**P0.5 — Agent-safe writes (shipped).** `snl-add-package`, `snl-add-entry`, and
`snl-add-macro` accept minimal business drafts, validate current topology, and own
canonical storage writes. Multi-file Package creation is guarded with writer locking,
optimistic config checks, and residue reporting; it is not described as crash-atomic
or as lock-free compare-and-swap against non-cooperating writers.

**Future bulk writes.** If real authoring workloads need them, build a guarded
batch CLI on the same primitives. Do not weaken per-entity validation or claim
filesystem crash atomicity without a real journal.

**P1 — Basic reads.** Exact-lookup and enumeration CLIs complementing SNoogL so
agents don't reinvent existing macros / entries: `snl-macro-get <name>`,
`snl-entry-get <id>`, `snl-list-kinds`, `snl-list-libraries`,
`snl-list-package <name>`, `snl-list-entries [--kind X] [--library Y]`.

**Future (post-spike).** Tag system, TED for entry lookup, LeanSearch-style
retrieval, multi-filter rerank pipeline. Depends on how large real docs get
before naive search stops cutting it.

---
