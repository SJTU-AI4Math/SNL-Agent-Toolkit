# AGENT.md — SNL Agent Toolkit

> Routing entry point for agents working with SNL documents or this Toolkit.

## Principle

`.SNL_Doc` is the specification authority. `AGENT.md` only routes work to the current documents under [`Skills/`](Skills/); it is not a second manual.

## Start

1. Load [`CLI Tools`](<Skills/CLI Tools/SKILL.md>) before invoking Toolkit commands. Treat machine-readable `snl --help` as the current implementation boundary.
2. Load [`RefineNL2SNL`](Skills/RefineNL2SNL/SKILL.md) when refining natural-language material into SNL.
3. For workflows whose physical Skill is still empty, read the owning `.SNL_Doc` Library/Entries directly; an empty `SKILL.md` is not usable guidance and is not routed here.

## Non-negotiable rules

1. Use Toolkit APIs or CLIs for canonical mutations. Never hand-calculate hash filenames, edit migration receipts, or modify frozen backups.
2. Treat revisions as opaque CAS tokens: read, mutate with the exact revision, validate, then read back.
3. Run workspace validation before publishing changes. Corrupt, unsupported, symlinked, or concurrently replaced data must fail closed.
4. Keep stdout machine-readable under `--json`; diagnostics and human logs belong on stderr.

The complete current index is [`Skills/README.md`](Skills/README.md). Deprecated documents are historical reference only and are not packaged or routed.
