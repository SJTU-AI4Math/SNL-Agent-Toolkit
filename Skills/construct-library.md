# Construct a Library (库建构)

> Use this to build `meta.json`, `graph.json`, and the branch tree.

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
- **Non-`branch` relationships survive round-trip but are ignored.**
  If you want to record "Theorem X depends on Lemma Y" as data,
  use a custom label (`depends_on`, `uses`) — the linter will warn
  but not delete it. Future phases may consume these.
- **One library, one narrative.** A library is a curated reading
  path over a subset of the pool. If you find yourself building a
  library that references half the pool with no clear structure,
  you probably want two libraries instead.

---
