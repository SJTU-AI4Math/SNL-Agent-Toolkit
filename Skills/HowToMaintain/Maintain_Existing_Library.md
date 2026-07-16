# Maintain an existing SNL Library

> Use this workflow for targeted corrections, refactors, and quality improvements to an established `.SNL_Doc`.

Read [`../Basics/Json_Schema.md`](../Basics/Json_Schema.md) first, then load the Basics document for any SNL or macro content you will touch.

## 1. Define the invariant you are preserving

Before editing, identify:

- the Library slug and affected Entry occurrences;
- stable Entry, kind, macro, counter, and relationship ids;
- active macro package ownership;
- current graph parent and sibling order;
- source links that depend on the affected Entry ids.

A maintenance task should change the requested behavior while preserving unrelated identity and authored semantics.

## 2. Choose the owning artifact

- prose or semantic tree → `entries.json`;
- macro rendering or concept identity → owning `term_macros/<package>.json`;
- Entry/Marco Kind metadata and activation → `config.json`;
- Library structure or occurrence override → `libraries/<slug>/graph.json`;
- numbering hierarchy → `libraries/<slug>/counters.json`;
- semantic edge → root `relationships.json`;
- Library title/description → `libraries/<slug>/meta.json`.

Fix the source of truth. Do not add a UI-layer disguise for incorrect author data.

## 3. Preserve identities

Do not casually rename Entry ids, kind ids, macro names, package filenames, Library slugs, counter ids, or relationship ids. If a migration truly requires an identity change, update every reference atomically and document the mapping.

## 4. Keep round trips lossless

Unknown fields are consumer-owned unless the current task explicitly migrates them. Read, modify the narrow field set, and preserve everything else.

For SNL content:

- keep one root tree;
- retain natural-language carriers when only embedded terms change;
- prefer registered terms over dead inline notation;
- do not auto-escape across the SNL/KaTeX boundary.

For macros:

- preserve package ownership;
- keep `styles[0]` as the intended implicit default;
- respect authored `kind` values;
- update `source.entries[]` when the defining Entry changes.

## 5. Validate the changed layer

```bash
# Macro packages
node bin/snl-lint-package.mjs --root . --name <package>

# Library graphs
node bin/snl-lint-graph.mjs --root . --slug <library>

# Draft Entry payload
node bin/snl-lint-entry.mjs --root . <draft-entry.json>
```

Use strict macro resolution when every identifier should be registered. Keep end-to-end KaTeX Preview checking enabled.

## 6. Review the diff as data

Check that:

- arrays did not reorder accidentally;
- graph relationship order changed only when reading order should change;
- no package was activated/deactivated accidentally;
- source links still resolve;
- counter names remain unique where name lookup is used;
- JSON formatting did not hide broad rewrites;
- unrelated worktree changes are not staged.

## 7. Re-run repository checks

For Toolkit changes:

```bash
npm test
npm run lint-types
```

For document-only changes, run all affected artifact linters plus any project-specific validation. Commit only after the real artifacts, not just a generated preview, pass.
