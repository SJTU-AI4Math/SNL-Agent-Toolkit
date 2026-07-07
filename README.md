# SNL Agent Toolkit

CLI + agent-facing docs for authoring [SNL](https://github.com/SJTU-AI-Verse/SNL-Basics) documents inside a
[`SNL-Doc-Extension`](https://github.com/SJTU-AI4Math/SNL-Doc-Extension) workspace, **without opening the IDE**.

Target consumer: a coding agent (Claude Code / Cursor / DeepSeek / whatever) running on a machine that has
the project's `.SNL_Doc/` folder checked out but does NOT have the VS Code extension installed. Instead of
firing UI commands, the agent uses this toolkit's CLIs to search, validate, and commit entries / macro
packages / library graphs directly.

**Status:** scaffolding. No CLIs implemented yet; see `AGENT.md` for the target UX and roadmap.

---

## Layout

```
SNL-Agent-Toolkit/
├── AGENT.md                # top-level agent-facing manual (read first)
├── docs/
│   └── snl-syntax-primer.md   # short reference for the SNL surface syntax
├── schema/                 # vendored TS interfaces mirroring the extension's on-disk shapes
│   └── snlDoc.ts
├── bin/                    # CLIs (Node ESM, single-file each)
│   └── (empty for now)
├── examples/               # few-shot payloads referenced by AGENT.md
│   └── (empty for now)
└── package.json
```

Vendoring rationale: the shared types live in `SNL-Doc-Extension/src/snlDoc.ts` and `libraryGraph.ts`.
Rather than depending on the extension repo, we keep a **frozen snapshot** in `schema/` with the source
commit noted in `schema/README.md`. Schema drift is a manual sync until we extract `@snl-doc/schema`.

## Install

Not published yet. For now:

```bash
git clone git@github.com:SJTU-AI4Math/SNL-Agent-Toolkit.git
cd SNL-Agent-Toolkit
npm install
# invoke CLIs directly, e.g.
# node bin/snl-search-macros.mjs --root /path/to/project 'ricci'
```

Once stable, the plan is to publish as `@snl-doc/agent-toolkit` on npm and let agents pull via `npx`.

## Related repos

- [`SNL-Basics`](https://github.com/SJTU-AI4Math/SNL_Basics) — SNL parser / renderer library.
- [`SNL-Doc-Extension`](https://github.com/SJTU-AI4Math/SNL-Doc-Extension) — VS Code extension that owns
  the `.SNL_Doc/` on-disk schema. **This toolkit's schema/ folder is a vendored snapshot of that repo.**

## License

MIT (TBD — will match SNL-Doc-Extension once that repo picks one).
