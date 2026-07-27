# Terminologization (术语化)

During *Terminologization*, extract terms from markdown natural language contents and create Term Macros in `.SNL_Doc/term_macros/*.json`. 

It is strongly advised to assign the task to subagents, as designing terms requires deliberate thinking.

## Terminology for Terminologization

1. A **Term (术语)** is a domain-specific signifier, signifying a specific semantic concept.

2. An **Atomic Term (原子术语)** is a term without arguments. An **Abstract Term (抽象术语)** is a term with finite or dynamic arity. The process of combining abstract terms and parameters to form a concrete term is called **Term Application (术语应用)**. 

    *Terminology above is borrowed from lambda calculus.*

3. We use **Term Macros (术语宏)** to denote abstract terms, where arguments are represented by `#N` placeholders.

4. Multiple different terms can signify the same semantic concept, a phenomenon called **Aliasing (别名)**. Therefore, a term macro contain multiple **Macro Styles (宏样式)**.

**Examples**

1. In Mathematics, math operators and meta-math expressions are both considered **Terms** in SNL (This is important because meta-math expressions are not considered **Terms** in formal languages like Lean 4):
    * In math expression $A \cup B$, `#0 ∪ #1` is a math operator. It is an **Abstract Term**, the corresponding **Term Macro** is $\LaTeX$ formula macro `#0 \cup #1`.
    * In math expression "Let $P$ be a predicate, define $\{x\mid P(x)\}$ to be ...", `Let #0, define #1 to be #2` describes the process of defining a mathematical concept, this process is not a math operator but a meta-math expression. Yet it is still a semantically specific concept and should be considered an **Abstract Term** in SNL. The corresponding **Term Macro** is text macro `Let #0, define #1 to be #2`.

2. In code documentations, a variety of concepts can be considered **Terms**: 
    * All declared variables, functions, classes, interfaces, etc. can be considered **Terms**. 

## Purpose

Establish the terminology system before writing Entry bodies: 
- Entry Kinds for semantic paragraph roles;
- Macro Kinds for semantic/rendering categories;
- term macros for reusable named concepts;
- package ownership and activation.

Every later build step depends on these identities.

## Inputs

- the planning blueprint from the previous drafting stage;
- existing `config.json` catalogs;
- every active package in `term_macros/`;
- domain vocabulary extracted from the source material.

## Deliverables

- `.SNL_Doc/CONVENTIONS.md` — the document's own naming and ownership standard (see step 4);
- `config.json#entry_kinds` updated only for genuinely new roles;
- `config.json#macro_kinds` updated only for genuinely new semantic categories;
- domain-owned `term_macros/<package>.json` files;
- `active_macro_packages` containing every package required by planned Entries;
- a concept → macro name → owning package table for Entry authors.

## Workflow

### 1. Inventory existing terminology

Search active packages before inventing a name. Record collisions, synonyms, and concepts whose existing source points at the wrong Entry.

### 2. Extract terms from the blueprint

This section introduces how to detect and extract terms from natural language contents, after the completion of the drafting stage.

For each planned Entry, list named concepts, operations, relations, controls, file paths, commands, or notation that should remain queryable. Do not write prose yet.

### 3. Decide macro-worthiness

Create a macro when a concept is reused, needs source links, needs hover/query behavior, or has non-trivial rendering. Keep genuinely one-off prose in text carriers.

### 4. Assign stable names and ownership

The Toolkit deliberately does **not** prescribe a single global naming scheme.
Different documents have different source traditions, and a scheme imposed from
outside would be wrong for most of them. What the Toolkit does require is that
each document **declare its own scheme, in writing, inside its own workspace**,
before the first macro is named.

Write that declaration to `.SNL_Doc/CONVENTIONS.md` and keep it authoritative.
It must fix at least:

- the macro-name grammar the document uses, including whether dotted
  qualification is mandatory and what the qualifier means (package? domain?
  namespace of the defining theory?);
- the package-splitting rule, and which package owns a concept when two could
  claim it;
- the style-name vocabulary, so `[display]`, `[inline]`, `[paren]` mean the same
  thing everywhere;
- the Entry-id grammar, since `source.entries` links macros to Entries;
- the casing rule for multi-word slugs.

Then hold the line:

- Prefer semantic ASCII names inside whatever grammar was declared.
- Treat names as lifetime identities; renaming is a migration
  (`snl-find-refs` then `snl-rename-id`), never a hand edit.
- Split packages by domain/ownership, not arbitrary size.
- Keep one authoritative owner for each macro.

An agent joining an existing document reads `.SNL_Doc/CONVENTIONS.md` first and
conforms. If the file is missing, the first thing to produce in this stage is
that file — reconstructed from the names already on disk, then confirmed with
the author — not a new macro.

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

Terminologization is complete when `.SNL_Doc/CONVENTIONS.md` exists and Entry authors can write each planned Entry without making new naming, package-ownership, kind, or style decisions. If authoring uncovers a missing reusable concept, pause and return here rather than embedding dead notation.
