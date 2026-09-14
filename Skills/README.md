# Skills

`AGENT.md` is only the routing entry point. `.SNL_Doc` remains the specification authority.

## Published, usable guidance

- [`CLI Tools`](<CLI Tools/SKILL.md>) — normative CLI product surface and machine-facing invocation skeletons. Current implementation availability is discovered through `snl --help`.
- [`Initialize`](Initialize/SKILL.md) — official CLI/MCP initialization, default versus preset catalogs, one-shot conflicts, and Git-persistent validation. Regenerate from canonical Entries with `npm run generate:init-skill`.
- [`RefineNL2SNL`](RefineNL2SNL/SKILL.md) — refine natural-language material into high-quality SNL.

## Unmaterialized guidance

`SNL Ecosystem` contains a partial concept outline, not a complete workflow. `Plan`, `Author`, `Read`, `Maintain`, and `Verify and Fix` remain reserved outputs with empty `SKILL.md` files. Their canonical SNL sections may also be incomplete. Do not route an Agent to an empty file or advertise these directories as completed workflows. Source-checkout maintainers can inspect the owning `.SNL_Doc` Entries; package-only users cannot, because `.SNL_Doc` is not in the npm payload. Use published guides and advertised CLI capabilities, and report unavailable workflows explicitly.

## Maintenance rule

- Keep product requirements in `.SNL_Doc`; keep Markdown files as agent-readable implementations.
- Route only to non-empty, validated physical Skills.
- `Skills/__deprecated__/` is historical reference only: do not route agents to it and do not publish it in the npm package.
