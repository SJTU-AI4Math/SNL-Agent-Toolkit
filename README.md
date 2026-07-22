# SNL Agent Toolkit

CLI and agent-facing Skills for working with [SNL](https://github.com/SJTU-AI4Math/SNL-Basics) documents inside an [`SNL-Doc-Extension`](https://github.com/SJTU-AI4Math/SNL-Doc-Extension) workspace without opening the IDE.

Agents should begin with [`AGENT.md`](AGENT.md), then load the task-specific documents under [`Skills/`](Skills/README.md).

## Layout

```text
SNL-Agent-Toolkit/
├── AGENT.md                   # short routing entry point
├── Skills/
│   ├── Basics/                # SNL Macro, SNL DSL, Markdown JSON schema
│   ├── HowToRead/             # inspect an existing SNL Library
│   ├── HowToBuild/            # large-scale NL → SNL construction
│   └── HowToMaintain/         # modify/optimize existing Libraries and Toolkit
├── bin/                       # executable CLI shims and implementations
├── lib/                       # shared runtime logic and compatibility types
├── CLI_Scripts/               # executable CLI validation/test scripts
├── examples/                  # few-shot payloads
└── package.json
```

## Install

```bash
git clone git@github.com:SJTU-AI4Math/SNL-Agent-Toolkit.git
cd SNL-Agent-Toolkit
npm install
npm test
```

Invoke a CLI directly, for example:

```bash
node bin/snl-lint-package.mjs --root /path/to/project
node bin/snl-find-refs.mjs --root /path/to/project --type entry algebra.def.group
node bin/snl-rename-id.mjs --root /path/to/project --type entry --dry-run old.id new.id
```

See [`Skills/HowToMaintain/Use_Toolkit_CLIs.md`](Skills/HowToMaintain/Use_Toolkit_CLIs.md)
for the full lint, reference-tracing, and synchronized-rename workflows.

## Schema ownership

The authoritative on-disk schema implementation belongs to `SNL-Doc-Extension`. The agent-readable Markdown reference is [`Skills/Basics/Json_Schema.md`](Skills/Basics/Json_Schema.md); Toolkit-only compatibility types live in `lib/snl-doc-schema.ts`.

## Related repositories

- [`SNL-Basics`](https://github.com/SJTU-AI4Math/SNL-Basics) — parser and renderer.
- [`SNL-Doc-Extension`](https://github.com/SJTU-AI4Math/SNL-Doc-Extension) — VS Code extension and authoritative `.SNL_Doc` storage behavior.

## License

MIT (TBD — will match SNL-Doc-Extension once that repository picks one).
