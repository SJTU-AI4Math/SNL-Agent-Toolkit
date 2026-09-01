# `.SNL_Doc` JSON schema reference

> Agent-readable reference for the on-disk model. `SNL-Doc-Extension` is authoritative; Toolkit mirrors only the parts its CLIs consume.

## Directory layout

```text
.SNL_Doc/
├── config.json
├── packages/<PackageId>-<packageHash>.json
├── entries/<PackageId>-<entryHash>.json
├── macros/<PackageId>-<macroHash>.json
├── relationships.json                     # optional
├── libraries/<slug>/
│   ├── meta.json
│   ├── graph.json
│   ├── counters.json
│   └── documents/{Typst,LaTeX,Markdown}/
├── entries.json                           # frozen legacy backup after migration
└── term_macros/*.json                     # frozen legacy backups after migration
```

When `config.json#entity_storage.version` is `1`, readers use only `packages/`, `entries/`, and `macros/`. They must never merge the frozen aggregate backups into the live entity set. New workspaces omit the backups.

## Agent write rule

This page explains storage for inspection and debugging. It is **not** an
instruction to hand-author storage files. For normal creation, give the Toolkit an
inner business draft:

```bash
node bin/snl-add-package.mjs --root . --json package-draft.json
node bin/snl-add-macro.mjs --root . --package <PackageId> --json macro-draft.json
node bin/snl-add-entry.mjs --root . --json entry-draft.json
```

These CLIs own envelope/storage versions, Package identity, canonical hashes and
filenames, safe defaults, linting, writer locking, optimistic checks, and structured
JSON errors. Agents must not calculate hashes, create or rename entity files, edit
`entity_storage.receipt`, or modify frozen `entries.json` / `term_macros/*.json`.
Identity changes use `snl-rename-id`, never a partial JSON edit.

## `config.json`

```json
{
  "version": "0.1.0",
  "entity_storage": {
    "version": 1,
    "legacy_backup_version": "0.0.5",
    "entry_default_package": "_unpackaged",
    "receipt": {}
  },
  "entry_kinds": [
    {
      "id": "definition",
      "name": { "type": "i18n", "default_language": "en", "values": { "en": "Definition" } },
      "coloring": {
        "light": { "stroke": "#1565c0", "background": "#e3f2fd" },
        "dark": { "stroke": "#90caf9", "background": "#0d47a1" }
      },
      "defaultCounterName": "Definition",
      "style": ""
    }
  ],
  "macro_kinds": [
    {
      "id": "operator",
      "name": "Operator",
      "description": "Operators",
      "coloring": {
        "light": { "stroke": "#6a1b9a", "background": "#f3e5f5" },
        "dark": { "stroke": "#ce93d8", "background": "#4a148c" }
      }
    }
  ],
  "active_macro_packages": ["Algebra"]
}
```

- `EntryKind.id` and `MacroKind.id` are stable identity keys.
- `EntryKind.defaultCounterName` names a Library counter.
- `active_macro_packages` contains Package IDs, not filenames.
- `entity_storage.receipt` is Extension-owned migration evidence. Readers recompute it from the frozen `0.0.5` backups and reject missing or mismatched receipts; preserve it verbatim.

## Stable identity paths

Entity filenames are derived from logical identity, not mutable JSON content:

```text
hash = first 20 lowercase hex digits of SHA-256(
  UTF-8("snl-doc/v1\0" + kind + "\0" + identity components joined by NUL)
)
```

- Package: kind `package`, component `packageId`.
- Entry: kind `entry`, components `packageId`, `entry.id`.
- Macro: kind `macro`, components `packageId`, `macro.name`.

Examples of path constructors are implemented in `lib/entity-storage.ts`. Never guess, truncate differently, hash JSON content, or retain a stale filename after changing an identity or Entry Package.

Package IDs are immutable, case-preserved, 1–64 Windows-safe ASCII characters matching `[A-Za-z0-9][A-Za-z0-9._-]*`; `.json` suffixes and Windows device names are forbidden. `_unpackaged` is the reserved system Package. Exact and case-folded path/Package collisions are fatal.

## Package manifest

```json
{
  "format": "snl-package",
  "version": 1,
  "schema_version": 2,
  "id": "Algebra",
  "name": "Algebra",
  "description": "Algebra terms",
  "entry_ids": ["algebra.def.group"]
}
```

A Package groups both Entries and Macros. `entry_ids` is the exact sorted,
duplicate-free set of Entry ids owned by the Package. `id` is immutable;
`name`, `description`, and unknown extension fields are mutable and must round-trip.

## Entry entity

```json
{
  "format": "snl-entry",
  "version": 1,
  "schema_version": 1,
  "package": "Algebra",
  "entry": {
    "id": "algebra.def.group",
    "package": "Algebra",
    "kind": "definition",
    "title": "Group",
    "content": { "snl": "%A #0 is …%(Group)" },
    "contribution_info": null,
    "pointer": null
  }
}
```

- Envelope and inner `package` must agree.
- `entry.id` is globally unique even across Packages.
- Moving an Entry changes its hash-derived filename and both Package fields, but not its id or references.
- `kind` references `config.entry_kinds[].id`; `title` may be a string or an i18n object.
- `content.snl` is the canonical structured form; other optional dialects are `typst`, `latex`, `markdown`, and `text`.
- `contribution_info`, `pointer`, and unknown fields are pass-through data.

## Macro entity

```json
{
  "format": "snl-macro",
  "version": 1,
  "schema_version": 1,
  "package": "Algebra",
  "macro": {
    "name": "Group",
    "description": "A group",
    "source": { "entries": ["algebra.def.group"], "urls": [] },
    "kind": "structure",
    "dynamic_arity": false,
    "styles": [
      {
        "style_name": "default",
        "tags": [],
        "template": { "mode": "text", "body": "group" }
      }
    ],
    "tags": []
  }
}
```

- Macro identity is `(package, macro.name)`; active Packages form a set and
  canonical Package filename order determines last-wins precedence for same-named Macros.
- `source.entries[]` references Entry ids.
- `kind`, when present, references a Macro Kind id.
- `styles[0]` is the implicit default; Macro v11 retires `default_style`.
- Style names are unique within one Macro and follow the SNL identifier grammar.
- Each style has an atomic `template` object (or an i18n map of complete
  objects) with `mode` and `body`. Valid modes are `formula_inline`,
  `formula_display`, `text`, and `block`.
- Macro and style `tags` are required arrays and may not contain backslashes.
- Dynamic Macros put `#*` in every style template; optional string `separator` joins children.
- `block_template_name` is valid only in `block` mode.
- A style may omit arguments used by sibling styles. Fixed arity is the largest referenced `#N` plus one across all styles; missing intermediate placeholders are valid.

See [`SNL_Macro.md`](SNL_Macro.md) for rendering semantics.

## Libraries

`libraries/<slug>/meta.json`:

```json
{ "title": "Algebra", "description": "A reading path." }
```

`libraries/<slug>/graph.json`:

```json
{
  "nodes": [
    { "id": "group", "label": "Entry", "props": { "entryId": "algebra.def.group", "counterId": "counter-definition" } }
  ],
  "relationships": [
    { "from": "chapter", "to": "group", "label": "branch" }
  ]
}
```

- Node ids are local to one Library; `props.entryId` references the global Entry pool.
- Omitted `entryId` means a placeholder.
- `branch` points parent to child; each node has at most one parent and the graph is acyclic.
- Sibling order is relationship declaration order; reading order is depth-first.

`libraries/<slug>/counters.json`:

```json
{
  "counters": [
    { "id": "counter-definition", "name": "Definition", "numbering": "1", "children": [] }
  ]
}
```

Counter ids are Library-local. `name` is matched by `EntryKind.defaultCounterName`; duplicate names are ambiguous.

## Pool relationships

`relationships.json` is optional and distinct from Library structure:

```json
{
  "version": 1,
  "relationships": [
    { "id": "rel-group-monoid", "from": "algebra.def.group", "to": "algebra.def.monoid", "label": "generalizes", "metadata": {} }
  ]
}
```

`from` and `to` reference Entry ids. Metadata is opaque except Extension-generated rows with `metadata.generator: "macro-source-scan"`: `metadata.macros[]` contains Macro names and `metadata.postfixes[]` contains Entry ids.

## Identity changes and round trips

Never hand-edit an identity in only one location. Use:

```bash
node bin/snl-find-refs.mjs --root . --type entry old.id
node bin/snl-rename-id.mjs --root . --type entry --dry-run old.id new.id
node bin/snl-rename-id.mjs --root . --type entry old.id new.id
```

The rename CLI acquires the Extension-compatible `.data-write.lock`, updates structured references, and transactionally moves the defining Entry/Macro to its new hash-derived path with optimistic concurrency checks and guarded rollback. It deliberately leaves frozen legacy backups unchanged.

Readers reject malformed envelopes, envelope/inner Package disagreement, path mismatch, duplicate Entry ids, duplicate `(Package, Macro)` identities, and case-folded Package collisions. Unknown fields must survive writes unless an explicit migration owns their removal.

## Source-of-truth synchronization

When Extension storage changes:

1. inspect `src/entityStorage.ts`, `src/entityStorageIo.ts`, migration code, and storage docs;
2. update this reference and `lib/entity-storage.ts` / `lib/snl-doc-schema.ts`;
3. update every CLI that discovers or writes schema files;
4. add failing fixtures for both live entity data and ignored frozen backups;
5. run `npm test`, `npm run lint-types`, all Toolkit lints, and a real Extension read/render check.
