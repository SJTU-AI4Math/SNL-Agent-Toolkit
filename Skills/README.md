# Skills

`AGENT.md` is only the routing entry point. Current knowledge and workflows live in the following Skills; `.SNL_Doc` remains the specification authority.

## Foundations

- [`SNL Ecosystem`](SNL%20Ecosystem/SKILL.md) — SNL workspace concepts, entity topology, and the DSL manual.
- [`CLI Tools`](CLI%20Tools/SKILL.md) — CLI command surface and machine-facing invocation skeletons.

## Workflow

- [`Initialize`](Initialize/SKILL.md) — initialize or import a workspace.
- [`Plan`](Plan/SKILL.md) — design Library structure before authoring.
- [`Author`](Author/SKILL.md) — create Entries, Macros, Packages, and topology through Toolkit operations.
- [`Read`](Read/SKILL.md) — inspect an existing Library and resolve its semantics.
- [`Maintain`](Maintain/SKILL.md) — update identities, references, Packages, and Library topology safely.
- [`RefineNL2SNL`](RefineNL2SNL/SKILL.md) — refine natural-language material into high-quality SNL.
- [`Verify and Fix`](Verify%20and%20Fix/SKILL.md) — validate, diagnose, and repair an SNL workspace.

## Maintenance rule

- Keep product requirements in `.SNL_Doc`; keep these Markdown files as agent-readable implementations.
- Link to one owning Skill instead of duplicating its detailed rules.
- `Skills/__deprecated__/` is historical reference only: do not route agents to it and do not publish it in the npm package.
