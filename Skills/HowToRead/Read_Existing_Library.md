# Read an existing SNL Library

> Use this workflow to inspect a completed `.SNL_Doc` without changing it.

Read [`../Basics/Json_Schema.md`](../Basics/Json_Schema.md), [`../Basics/SNL_DSL.md`](../Basics/SNL_DSL.md), and [`../Basics/SNL_Macro.md`](../Basics/SNL_Macro.md) first.

## 1. Establish the workspace

Confirm the workspace root contains `.SNL_Doc/config.json` plus live `packages/`, `entries/`, and `macros/` entity directories. Treat Package ids and entity identities as keys; ignore frozen `entries.json` / `term_macros/` migration backups.

## 2. Choose a Library

Enumerate `.SNL_Doc/libraries/*/meta.json`. Use the directory name as the Library slug and `meta.json.title` as its display name.

Read these files together:

- `meta.json` — Library identity and description;
- `graph.json` — selected Entry occurrences and branch order;
- `counters.json` — numbering hierarchy and counter names.

## 3. Reconstruct reading order

From `graph.json`:

1. index nodes by local `node.id`;
2. keep only understood `branch` relationships for structural traversal;
3. find roots with no incoming `branch`;
4. traverse roots in `nodes[]` order;
5. traverse children in `relationships[]` declaration order using depth-first search.

A graph node is an occurrence in this Library. Resolve `node.props.entryId` against the global live Entry entity pool. A node without `entryId` is a placeholder, not a broken Entry.

## 4. Resolve numbering

For each Entry occurrence:

1. use `node.props.counterId` when present;
2. otherwise resolve the Entry's `kind` in `config.entry_kinds[]` and read its `defaultCounterName`;
3. find the first depth-first counter whose `name` matches;
4. format its ordinal through the counter's `numbering` DSL;
5. combine parent/child counter segments according to the counter tree.

Duplicate counter names are ambiguous and should be reported, not guessed around.

## 5. Read Entry content

Resolve the Entry envelope by inner `entry.id` and prefer `entry.content.snl` for semantic inspection.

- Parse it as one SNL tree.
- For each plain identifier, check active macro packages.
- `%…%`, `$…$`, and `$$…$$` are synthetic payload nodes.
- `name@entryId` points to a binding owned by another Entry.

Other content fields are mirror/export surfaces and may not preserve the same semantic structure.

## 6. Resolve macros

Read `config.active_macro_packages`. Load matching Package manifests and their Macro entities, then apply active-Package precedence by `macro.name`.

For a macro occurrence:

- select the requested `[style]`, or `styles[0]` when omitted;
- recursively render children;
- inspect `source.entries[]` to find defining Entries;
- inspect `source.urls[]` for external references;
- respect the macro's declared `kind` and style rather than neutralizing it in the reader.

If active packages define the same name, report the collision. Do not silently pick whichever file happened to be read last.

## 7. Read semantic relationships

`relationships.json` is pool-wide. It is not the Library outline.

To view relationships for one Library, induce the subgraph whose endpoints both belong to the Library's resolved Entry-id set. Preserve labels and metadata as authored.

## 8. Validate before trusting a suspicious artifact

```bash
node bin/snl-lint-graph.mjs --root . --slug <library>
node bin/snl-lint-package.mjs --root .
```

For a suspicious Entry, copy the envelope's inner `entry` object to a draft file and run `snl-lint-entry`. Existing committed Entries need a temporary lint root with an empty `entries/` directory to avoid the expected duplicate-id diagnostic.

## Output of a reading task

A useful reading report should identify:

- Library slug and title;
- ordered Entry ids and titles;
- unresolved placeholders or Entry references;
- counter ambiguity;
- unresolved/colliding macros;
- relevant semantic relationships;
- source Entries/URLs for the concepts discussed.
