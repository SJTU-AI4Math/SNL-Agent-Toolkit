# AGENT.md — SNL Agent Toolkit

> Routing entry point for agents working with SNL documents or this Toolkit.

## Principle

`.SNL_Doc` is the specification authority. `AGENT.md` only routes work to the current documents under [`Skills/`](Skills/); it is not a second manual.

## Start

1. Load [`SNL Ecosystem`](Skills/SNL%20Ecosystem/SKILL.md) for the data model and DSL.
2. Choose the workflow Skill matching the task: [`Initialize`](Skills/Initialize/SKILL.md), [`Plan`](Skills/Plan/SKILL.md), [`Author`](Skills/Author/SKILL.md), [`Read`](Skills/Read/SKILL.md), or [`Maintain`](Skills/Maintain/SKILL.md).
3. Load [`CLI Tools`](Skills/CLI%20Tools/SKILL.md) before invoking Toolkit commands.
4. Use [`RefineNL2SNL`](Skills/RefineNL2SNL/SKILL.md) for NL→SNL refinement and [`Verify and Fix`](Skills/Verify%20and%20Fix/SKILL.md) for final validation or repair.

## Non-negotiable rules

1. Use Toolkit APIs or CLIs for canonical mutations. Never hand-calculate hash filenames, edit migration receipts, or modify frozen backups.
2. Treat revisions as opaque CAS tokens: read, mutate with the exact revision, validate, then read back.
3. Run workspace validation before publishing changes. Corrupt, unsupported, symlinked, or concurrently replaced data must fail closed.
4. Keep stdout machine-readable under `--json`; diagnostics and human logs belong on stderr.

The complete current index is [`Skills/README.md`](Skills/README.md). Deprecated documents are historical reference only and are not packaged or routed.
