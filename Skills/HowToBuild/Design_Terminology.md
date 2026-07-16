# Design terminology (术语化)

> Use this during large-scale NL → SNL construction to decide which concepts exist and who owns them.

Read [`../Basics/SNL_Macro.md`](../Basics/SNL_Macro.md) and [`../Basics/Json_Schema.md`](../Basics/Json_Schema.md) before starting. Those documents own macro syntax and field-level schema; this guide owns the build workflow.

## Purpose

Establish the terminology system before writing Entry bodies:

- Entry Kinds for semantic paragraph roles;
- Macro Kinds for semantic/rendering categories;
- term macros for reusable named concepts;
- package ownership and activation.

Every later build step depends on these identities.

## Inputs

- the construction blueprint from [`Draft_Document.md`](Draft_Document.md);
- existing `config.json` catalogs;
- every active package in `term_macros/`;
- domain vocabulary extracted from the source material.

## Deliverables

- `config.json#entry_kinds` updated only for genuinely new roles;
- `config.json#macro_kinds` updated only for genuinely new semantic categories;
- domain-owned `term_macros/<package>.json` files;
- `active_macro_packages` containing every package required by planned Entries;
- a concept → macro name → owning package table for Entry authors.

## Workflow

### 1. Inventory existing terminology

Search active packages before inventing a name. Record collisions, synonyms, and concepts whose existing source points at the wrong Entry.

### 2. Extract concepts from the blueprint

For each planned Entry, list named concepts, operations, relations, controls, file paths, commands, or notation that should remain queryable. Do not write prose yet.

### 3. Decide macro-worthiness

Create a macro when a concept is reused, needs source links, needs hover/query behavior, or has non-trivial rendering. Keep genuinely one-off prose in text carriers.

### 4. Assign stable names and ownership

- Prefer semantic ASCII names.
- Use dotted qualification when ambiguity is plausible.
- Treat names as lifetime identities.
- Split packages by domain/ownership, not arbitrary size.
- Keep one authoritative owner for each macro.

### 5. Design styles

Put the intended implicit style at `styles[0]`. Add alternate styles only when a real caller needs them. Choose modes and arity according to [`../Basics/SNL_Macro.md`](../Basics/SNL_Macro.md).

### 6. Leave semantic sources honest

Before defining Entries exist, keep `source.entries` empty. Do not invent future ids unless the Entry blueprint has already fixed them. Populate sources during semantic indexation.

### 7. Lint every package

```bash
node bin/snl-lint-package.mjs --root . --name <package>
```

Resolve package-local errors and workspace-wide name collisions before Entry authoring begins.

## Exit criteria

Terminologization is complete when Entry authors can write each planned Entry without making new naming, package-ownership, kind, or style decisions. If authoring uncovers a missing reusable concept, pause and return here rather than embedding dead notation.
