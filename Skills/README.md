# Skills

`AGENT.md` is only the routing entry point. `.SNL_Doc` remains the specification authority.

## Published, usable guidance

- [`CLI Tools`](<CLI Tools/SKILL.md>) — normative CLI product surface and machine-facing invocation skeletons. Current implementation availability is discovered through `snl --help`.
- [`Initialize`](Initialize/SKILL.md) — official CLI/MCP initialization, default versus preset catalogs, one-shot conflicts, and Git-persistent validation. Regenerate from canonical Entries with `npm run generate:init-skill`.
- [`RefineNL2SNL`](RefineNL2SNL/SKILL.md) — refine natural-language material into high-quality SNL.
- [`Report`](Report/SKILL.md) — shared reporting contract for SNL library changes: two diff blocks (macro content and entry tree), an explicit one-sided "no change", plan-versus-completion wording, and Entry ID provenance. It covers reporting only.

## Partially materialized guidance

`Plan`, `Author`, and `Maintain` are no longer empty, but each contains only the change-reporting route to [`Report`](Report/SKILL.md). Their broader planning, authoring, and maintenance workflows remain unwritten, and their canonical SNL sections may also be incomplete. Route an Agent to them for reporting only, and do not advertise them as completed workflows.

## Unmaterialized guidance

`SNL Ecosystem` contains a partial concept outline, not a complete workflow. `Read` and `Verify and Fix` remain reserved outputs with empty `SKILL.md` files. Their canonical SNL sections may also be incomplete. Do not route an Agent to an empty file or advertise these directories as completed workflows. Source-checkout maintainers can inspect the owning `.SNL_Doc` Entries; package-only users cannot, because `.SNL_Doc` is not in the npm payload. Use published guides and advertised CLI capabilities, and report unavailable workflows explicitly.

## Maintenance rule

- Keep product requirements in `.SNL_Doc`; keep Markdown files as agent-readable implementations.
- Route only to non-empty, validated physical Skills.
- `Skills/__deprecated__/` is historical reference only: do not route agents to it and do not publish it in the npm package.
