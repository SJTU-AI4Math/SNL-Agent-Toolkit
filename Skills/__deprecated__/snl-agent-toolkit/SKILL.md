---
name: snl-agent-toolkit
description: Use when reading, authoring, validating, or maintaining an SNL workspace. Prefer the typed SNL tools over editing .SNL_Doc files by hand.
version: 0.1.0
author: SJTU-AI4Math
license: MIT
metadata:
  tags: "snl, structured-natural-language, knowledge-management, mcp"
---

# SNL Agent Toolkit

## Overview

Use this skill for `.SNL_Doc` workspaces managed by SNL Doc Extension. It keeps agent work on the validated, revision-checked API instead of fragile direct JSON edits.

## When to Use

Use it when a task reads, searches, creates, updates, deletes, renames, or validates an SNL entity or workspace. Do not use it for plain Markdown/LaTeX that is outside an SNL workspace.

## Managed entities

The tool surface covers exactly eight entity families:

- `entry-kind`
- `macro-kind`
- `entry-package`
- `macro-package`
- `entry`
- `macro`
- `relationship`
- `library`

Entry Packages and Macro Packages are distinct management projections over the current shared Package manifest. Do not infer that they are separate persisted files.

## Reading one Entry

Call `snl_entry_latex` with the workspace root and canonical Entry id when the task is to understand authored Entry content. It parses `content.snl`, resolves the active Macro catalog, and directly assembles bare LaTeX without the indexed `\htmlData` rendering layer. A Macro whose selected style has `mode: block` is represented conservatively as `macro-name(rendered subtrees)` instead of compiling its host-specific block body.

## Reading one Library hierarchy

Call `snl_library_entry_tree` with the workspace root and Library slug to obtain a folder-style multiline Entry tree. `language` selects localized Entry Kind names and titles. The independent boolean parameters `includeEntryKind`, `includeNumber`, `includeTitle`, `includeEntryId`, and `includeCounterId` default to true and control the corresponding line fields. Numbering follows the Library's branch reading order, per-occurrence `counterId`, Entry Kind fallback, and counter hierarchy.

## Workflow

1. Run `snl_workspace_validate` before a write sequence. Stop on schema, topology, or reference errors.
2. Discover identities with `snl_entities_list`; use `query` only to narrow results, never to invent an ID.
3. Read the exact entity with `snl_entity_get` and retain its returned revision.
4. Create with `snl_entity_apply(action="create")`.
5. Update or delete only with the exact `expectedRevision` returned by the latest read. On conflict, reread and reconsider the change rather than blindly retrying.
6. Run `snl_workspace_validate` again after the complete change set.

For batch-oriented work, the equivalent `snl-entity` CLI remains available and emits stable JSON. Never hand-calculate identity hashes, create hash-named files, edit migration receipts, or modify frozen aggregate backups.

## SNL boundaries

- Content outside `%…%`, `$…$`, and `@` operands is SNL, not raw KaTeX.
- Unknown identifiers may intentionally be fvar/bvar fallback; use strict validation only when the task requires every identifier to resolve as a Macro.
- Preserve localized maps and unknown extension fields. Resolve localized display values only for presentation or search.
- Package membership, references, and canonical filenames are authoritative cross-file invariants. Use Toolkit writes so they update atomically.

## Common Pitfalls

1. Do not collapse Entry Packages and Macro Packages into a single public entity type. They are separate management projections even while the current storage manifest is shared.
2. Do not retry a revision conflict with a fabricated or stale token. Read the entity again and reconsider the proposed value.
3. Do not treat a successful JSON parse as workspace validity. Membership, references, identities, and schema generations are cross-file invariants.
4. Do not hand-edit `.SNL_Doc` while a Toolkit write is in progress. All writers share one lock and use atomic replacement.

## Verification Checklist

- [ ] All affected entity IDs were discovered from the workspace.
- [ ] Every update/delete used the latest opaque revision.
- [ ] The write result is structured success rather than conflict/invalid/not-found.
- [ ] `snl_workspace_validate` succeeds after the complete change.
- [ ] No hash filenames, migration receipts, or frozen backups were edited manually.

## Resources

Read `references/entity-adapter-contract.md` when implementing or debugging a host adapter. The detailed authoring and maintenance guides remain under the packaged `Skills/` directory.
