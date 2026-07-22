# `.SNL_Doc` JSON schema reference

> Markdown reference for the on-disk data model. This is descriptive documentation, not a machine-readable JSON Schema document.

The authoritative implementation is owned by `SNL-Doc-Extension`. Toolkit runtime compatibility types live in `lib/snl-doc-schema.ts`; agents should read this document rather than TypeScript declarations.

## Directory layout

```text
.SNL_Doc/
├── config.json
├── entries.json
├── relationships.json                 # optional
├── term_macros/
│   └── <package>.json
└── libraries/
    └── <slug>/
        ├── meta.json
        ├── graph.json
        ├── counters.json
        └── documents/
            ├── Typst/
            ├── LaTeX/
            └── Markdown/
```

## `config.json`

```json
{
  "version": "0.0.3",
  "entry_kinds": [
    {
      "id": "definition",
      "name": "Definition",
      "coloring": { "stroke": "#1565c0", "background": "#e3f2fd" },
      "defaultCounterName": "Definition",
      "style": ""
    }
  ],
  "macro_kinds": [
    {
      "id": "operator",
      "name": "Operator",
      "description": "Operators",
      "coloring": { "stroke": "#6a1b9a", "background": "#f3e5f5" }
    }
  ],
  "active_macro_packages": ["algebra"]
}
```

### Invariants

- `EntryKind.id` and `MacroKind.id` are stable identity keys.
- `EntryKind.defaultCounterName` names a counter in the current Library. It is not a numbering DSL.
- `active_macro_packages` contains bare filenames without `.json`.
- `coloring` values are CSS colors consumed by the UI.

## `entries.json`

A bare array shared by every Library:

```json
[
  {
    "id": "algebra.def.group",
    "kind": "definition",
    "title": "Group",
    "content": { "snl": "%A #0 is …%(Group)" },
    "contribution_info": null,
    "pointer": null
  }
]
```

### Invariants

- `id` is non-empty and globally unique in the pool.
- `kind` references `config.entry_kinds[].id`.
- `title` may be empty.
- `content` may contain `snl`, `typst`, `latex`, `markdown`, and `text`; SNL is the canonical structured form.
- `contribution_info` is consumer-owned data.
- `pointer` is `null` or a structured source-location payload; preserve unknown fields.

## `term_macros/<package>.json`

```json
{
  "version": "0.0.3",
  "name": "Algebra",
  "description": "Algebra terms",
  "macros": {
    "Group": {
      "description": "A group",
      "source": { "entries": ["algebra.def.group"], "urls": [] },
      "kind": "structure",
      "dynamic_arity": false,
      "styles": [
        { "tag": "default", "mode": "text", "template": "group" }
      ]
    }
  }
}
```

- Macro map keys are stable macro identities.
- `source.entries[]` references Entry ids.
- `kind`, when present, references a Macro Kind id.
- `styles` is non-empty; tags are unique within one macro.
- Valid modes: `formula_inline`, `formula_display`, `text`, `block`.
- Optional style fields: `variadic_left`, `variadic_join`, `variadic_right`, `react_renderer_key`, `tags`, `typst`, `latex`, `markdown`, `text`.

See [`SNL_Macro.md`](SNL_Macro.md) for rendering semantics.

## `libraries/<slug>/meta.json`

```json
{
  "title": "Algebra",
  "description": "A reading path through the algebra Entries."
}
```

Both fields are optional at read time. The directory slug is the Library identity.

## `libraries/<slug>/graph.json`

```json
{
  "nodes": [
    {
      "id": "group",
      "label": "Entry",
      "props": {
        "entryId": "algebra.def.group",
        "counterId": "counter-definition"
      }
    }
  ],
  "relationships": [
    { "from": "chapter", "to": "group", "label": "branch" }
  ]
}
```

- `nodes[].id` is unique only within this Library.
- `label: "Entry"` is the understood node label.
- `props.entryId` optionally references the shared pool; omission means a placeholder.
- `props.counterId` optionally overrides the Entry Kind's default counter for this occurrence.
- `branch` points parent → child.
- Each node has at most one incoming `branch`; the branch graph is acyclic.
- Sibling order is relationship declaration order; reading order is depth-first traversal.
- Unknown properties must survive round trips.

## `libraries/<slug>/counters.json`

```json
{
  "counters": [
    {
      "id": "counter-definition",
      "name": "Definition",
      "numbering": "1",
      "children": [
        {
          "id": "counter-subdefinition",
          "name": "Subdefinition",
          "numbering": ".1",
          "children": []
        }
      ]
    }
  ]
}
```

- Counter ids are stable within the Library.
- `name` is matched by `EntryKind.defaultCounterName`; duplicate names are ambiguous because lookup uses the first depth-first match.
- `numbering` is a Typst-inspired ordinal template such as `1`, `.1`, `A`, `(i)`, or `§I.`.
- `children` forms the counter hierarchy.

## `relationships.json`

```json
{
  "version": 1,
  "relationships": [
    {
      "id": "rel-group-monoid",
      "from": "algebra.def.group",
      "to": "algebra.def.monoid",
      "label": "generalizes",
      "metadata": {}
    }
  ]
}
```

This graph is pool-wide and semantic. It is distinct from each Library's structural `graph.json`.

- `id` is globally unique in the relationship file.
- `from` and `to` reference Entry ids.
- `label` is a non-empty free-form string.
- `metadata` is generally opaque and must round-trip unchanged.
- Exception: rows with `metadata.generator: "macro-source-scan"` are
  Extension-owned generated relationships. Their `metadata.macros[]` values are
  Macro identities and `metadata.postfixes[]` values are Entry identities;
  identity tracing/rename updates these known witness arrays while leaving
  arbitrary user-authored metadata untouched.

## Identity and round-trip rules

Never silently change:

- Entry id;
- Entry Kind id;
- Macro Kind id;
- macro package filename;
- macro name;
- Library slug;
- relationship id.

Readers should tolerate unknown fields and writers should preserve them unless a migration explicitly owns their removal.

When an identity really must change, do not hand-edit one file or run a raw
text replacement. Use `snl-find-refs` to inspect its structured definition and
references, then `snl-rename-id --dry-run` followed by `snl-rename-id` to apply
a collision-checked synchronized migration. The Toolkit owns Entry references
in Library graphs, pool relationships, macro provenance, and SNL `x@entry-id`;
it owns Macro references in package map keys and SNL macro tokens. Opaque
metadata and non-SNL prose are deliberately outside that migration boundary.

## Source-of-truth synchronization

When `SNL-Doc-Extension/src/snlDoc.ts` or `src/libraryGraph.ts` changes:

1. update this Markdown reference;
2. update `lib/snl-doc-schema.ts` if Toolkit code consumes the changed shape;
3. update lint rules and fixtures;
4. run `npm test` and `npm run lint-types`.
