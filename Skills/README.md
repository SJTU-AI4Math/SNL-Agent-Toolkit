# Skills

`AGENT.md` is only the routing entry point. `.SNL_Doc` remains the specification authority.

## Published, usable guidance

- [`CLI Tools`](<CLI Tools/SKILL.md>) — normative CLI product surface and machine-facing invocation skeletons. Current implementation availability is discovered through `snl --help`.
- [`RefineNL2SNL`](RefineNL2SNL/SKILL.md) — refine natural-language material into high-quality SNL.

## Unmaterialized guidance

Other current Skill directories are reserved outputs whose `SKILL.md` files are empty. Do not route an Agent to an empty file. Until those physical Skills are generated from their owning `.SNL_Doc` Libraries and validated, read the canonical SNL Entries directly.

## Maintenance rule

- Keep product requirements in `.SNL_Doc`; keep Markdown files as agent-readable implementations.
- Route only to non-empty, validated physical Skills.
- `Skills/__deprecated__/` is historical reference only: do not route agents to it and do not publish it in the npm package.
