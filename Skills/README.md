# Skills

`AGENT.md` is only the entry point. Concrete knowledge and workflows live under exactly four categories.

## [`Basics/`](Basics/README.md)

Foundational knowledge used by every workflow:

- SNL Macro syntax and semantics;
- SNL DSL syntax;
- `.SNL_Doc` JSON schema in Markdown.

## [`HowToRead/`](HowToRead/README.md)

How to inspect an already-written SNL Library: reconstruct reading order, resolve Entries and macros, understand counters, and query semantic relationships.

## [`HowToBuild/`](HowToBuild/README.md)

How to perform large-scale natural-language → SNL Library construction, from blueprint and terminology through Entries, Library graph, and semantic index.

## [`HowToMaintain/`](HowToMaintain/README.md)

How to modify and optimize an existing SNL Library safely, run Toolkit validation, and maintain Toolkit implementation.

## Maintenance rule

- Put each concrete block of work in one category and one owning document.
- Basics explains structures and syntax; HowTo guides explain procedures.
- Link to an owning document instead of duplicating its detailed rules.
- When a new document is added, register it in the category README and update `AGENT.md` only if top-level routing changes.
