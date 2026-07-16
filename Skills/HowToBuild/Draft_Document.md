# Draft a document (起稿)

> Use this when planning a non-trivial document or construction blueprint.

### Phase 1 — Drafting (起稿)

**Purpose.** For any professional or complex material, write a
free-form markdown plan FIRST. This is where you decide scope,
chapter/section skeleton, and rough content, without any commitment
to the SNL schema.

**When to skip.** Trivial one-entry edits, or when the user already
handed you a structured source (a Lean file, a Typst blueprint, etc.).

**Deliverables.**
- A scratch `.md` file (kept outside `.SNL_Doc/`, e.g. `drafts/<name>.md`).
- Rough heading tree that will later map to library branches.
- Prose paragraphs annotated in your head as "definition / theorem /
  remark / example / proof …" — the annotations become entry kinds
  in phase 3.

**Tools.** None specific to this toolkit — plain markdown, your
editor of choice.

**Rules of thumb.**
- Don't invent terminology yet. Write in whatever natural language
  the source uses. Term extraction happens in phase 2.
- Keep the outline shallow at first (2–3 heading levels). Deep
  nesting will migrate to `branch` edges in phase 4, not to more
  heading levels.
- If the source has cross-references ("by Theorem 2.3"), mark them
  in the draft as `[[ref: theorem 2.3]]` — you'll resolve them into
  macro references in phase 5.

**What "起稿" is NOT (cat 2026-07-11 clarification).** For technical
projects like an API doc, "起稿" is NOT prose-first exploration. It's a
**construction blueprint**: chapters + a flat table under each chapter
where every row is a future entry with `{ id, kind, title, parent? }`
already decided. When Phase 1 ends, Phase 2 term extraction and Phase 3
entry prefab should have zero decisions left about what exists — only
about how to write it. If you find yourself explaining ideas in the
draft rather than listing them, you've drifted into Phase 5 content and
should refactor back to a table.

---
