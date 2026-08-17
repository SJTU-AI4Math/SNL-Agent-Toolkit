---
name: snl-agent-toolkit
description: Use when reading, authoring, validating, or maintaining an SNL workspace. Prefer the typed SNL tools over editing .SNL_Doc files by hand.
version: 0.1.0
author: SJTU-AI4Math
license: MIT
metadata:
  hermes:
    tags: [snl, structured-natural-language, knowledge-management, mcp]
    related_skills: []
---

# SNL Agent Toolkit

Use this skill for `.SNL_Doc` workspaces managed by SNL Doc Extension.

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

## Resources

Read `references/entity-adapter-contract.md` when implementing or debugging a host adapter. The detailed authoring and maintenance guides remain under the packaged `Skills/` directory.
