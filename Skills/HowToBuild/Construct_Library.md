# Construct a Library (库建构)

> Use this to build `meta.json`, `graph.json`, `counters.json`, and the branch tree.

Read [`../Basics/Json_Schema.md`](../Basics/Json_Schema.md) before editing the on-disk files.

### Phase 4 — Library Construction (库建构)

**Purpose.** Build the `.SNL_Doc/libraries/<slug>/` folder that
selects a subset of entries and imposes a **branch tree** over them
(chapter → section → subsection → leaf entry). The graph is the
source of truth for the library's structure; there is no separate
"table of contents".

**Deliverables.**
- `libraries/<slug>/meta.json` — `{ title, description? }`.
- `libraries/<slug>/graph.json` — Library Graph v2:
  - `nodes[]` — each `{ id, label: 'Entry', props: { entryId?, ... } }`.
    `id` is library-local (unique within this file only) — use a short
    semantic slug like `ch1`, `ch1.sec2`, `ch1.sec2.thmContinuous`, or
    reuse the pool `entryId` when the node is not a placeholder.
    Extension only enforces uniqueness; keep it human-readable for
    the same reason as entry ids. `entryId` points at the shared pool
    (unset = placeholder for a slot you'll fill later).
  - `relationships[]` — each `{ from, to, label: 'branch' }`. A branch
    from A → B means "B is a child of A" for numbering / rendering.
- `libraries/<slug>/counters.json` — Library-scoped counter tree. Entry
  occurrences may select a counter by `props.counterId`; otherwise the
  Entry Kind's `defaultCounterName` is resolved against this tree.

**Tools.**
- ⏳ `snl-outline-to-graph` (planned, not yet designed) — takes a
  markdown outline + entry-id map and emits a `graph.json`. Until it
  ships, hand-author the JSON, then lint.
- ✅ `snl-lint-graph` — schema, label vocab, branch-tree integrity
  (no multi-parent, no cycles, all `entryId`s resolve in the pool).
- ⏳ `snl-commit-batch`.

**Rules of thumb.**
- **The branch subgraph is a tree**, not a DAG. Each node has at most
  one incoming `branch` edge; the linter enforces this.
- **Placeholder nodes are legitimate.** An entry that isn't drafted
  yet can still occupy a slot in the tree — set `props.entryId`
  unset and give the node a memorable local `id`. Fill in later.
- **Counter names should be unique within a Library.** Name lookup uses the
  first depth-first match, so duplicates are ambiguous even when ids differ.
- **Occurrence overrides are local.** A `counterId` on a graph node changes
  numbering for that Library occurrence; it does not mutate the Entry Kind.
- **Semantic relationships belong at the root.** Record `depends_on`,
  `generalizes`, `proves`, and similar Entry-to-Entry semantics in
  `.SNL_Doc/relationships.json`, not as custom edges in the Library outline.
- **One library, one narrative.** A library is a curated reading
  path over a subset of the pool. If you find yourself building a
  library that references half the pool with no clear structure,
  you probably want two libraries instead.

---
