# AGENT.md — SNL Agent Toolkit

> Routing entry point for agents working with SNL documents or this Toolkit.

## Principle

`.SNL_Doc` is the specification authority. `AGENT.md` only routes work to the current documents under [`Skills/`](Skills/); it is not a second manual.

## Start

1. Load [`CLI Tools`](<Skills/CLI Tools/SKILL.md>) before invoking Toolkit commands. Treat machine-readable `snl --help` as the current implementation boundary.
2. Load [`Initialize`](Skills/Initialize/SKILL.md) for a new workspace; use the official `snl init --root <dir>` and its lean defaults unless a preset is explicitly intended.
3. Load [`RefineNL2SNL`](Skills/RefineNL2SNL/SKILL.md) when refining natural-language material into SNL.
4. Load [`Report`](Skills/Report/SKILL.md) before reporting any SNL library change — a plan, a confirmation, or a result. It is the shared format for the two required diff blocks (macro content and entry tree), one-sided "no change", plan-versus-completion wording, and Entry ID provenance.
5. [`Plan`](Skills/Plan/SKILL.md), [`Author`](Skills/Author/SKILL.md), and [`Maintain`](Skills/Maintain/SKILL.md) currently materialize only that reporting route; their wider workflows are still incomplete. `Read` and `Verify and Fix` remain empty, and `SNL Ecosystem` is a partial outline. In a source checkout, inspect their owning `.SNL_Doc` Library/Entries, which may themselves be unfinished. The npm package does not include that specification workspace; package-only users should use the published guides and implemented CLI contracts, and report the missing workflow rather than invent it. An empty `SKILL.md` is not usable guidance.

## Non-negotiable rules

1. Use Toolkit APIs or CLIs for canonical mutations. Never hand-calculate hash filenames, edit migration receipts, or modify frozen backups.
2. Treat revisions as opaque CAS tokens: read, mutate with the exact revision, validate, then read back.
3. Run workspace validation before publishing changes. Corrupt, unsupported, symlinked, or concurrently replaced data must fail closed.
4. Keep stdout machine-readable under `--json`; diagnostics and human logs belong on stderr.

The complete current index is [`Skills/README.md`](Skills/README.md). Deprecated documents are historical reference only and are not packaged or routed.
