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

Invoke a CLI directly. For agent-authored writes, always use the add CLIs rather
than creating hash-named entity files yourself:

```bash
node bin/snl-entity.mjs --root /path/to/project --json list --type entry-kind
node bin/snl-entity.mjs --root /path/to/project --json get --type entry algebra.def.group
node bin/snl-add-package.mjs --root /path/to/project --json examples/package-draft.minimal.json
node bin/snl-add-macro.mjs --root /path/to/project --package Topology --json examples/macro-draft.minimal.json
node bin/snl-add-entry.mjs --root /path/to/project --json examples/entry-draft.minimal.json

node bin/snl-lint-package.mjs --root /path/to/project
node bin/snl-find-refs.mjs --root /path/to/project --type entry algebra.def.group
node bin/snl-rename-id.mjs --root /path/to/project --type entry --dry-run old.id new.id
```

The write CLIs compute canonical identity hashes and filenames, construct storage
envelopes, fill safe defaults, lint before writing, acquire `.data-write.lock`, and
refuse malformed/current-future-incompatible workspaces. `--json` gives stable
agent-facing `created`, `invalid`, `conflict`, or `error` output. They never edit
migration receipts or frozen legacy backups.

See [`Skills/HowToMaintain/Use_Toolkit_CLIs.md`](Skills/HowToMaintain/Use_Toolkit_CLIs.md)
for the full creation, lint, reference-tracing, and synchronized-rename workflows.

## Schema ownership

The authoritative on-disk schema implementation belongs to `SNL-Doc-Extension`. The agent-readable Markdown reference is [`Skills/Basics/Json_Schema.md`](Skills/Basics/Json_Schema.md); Toolkit-only compatibility types live in `lib/snl-doc-schema.ts`.

Toolkit currently targets workspace data `0.1.0`, Package schema 2,
Entry/Macro schema 1, and Macro v11 from SNL-Basics 0.2.4. It retains
read/maintenance compatibility for `0.0.6` and older aggregate workspaces, never
merges frozen aggregate backups into current live entities, and rejects unknown
future workspace or entity schema versions instead of guessing.

## Related repositories

- [`SNL-Basics`](https://github.com/SJTU-AI4Math/SNL-Basics) — parser and renderer.
- [`SNL-Doc-Extension`](https://github.com/SJTU-AI4Math/SNL-Doc-Extension) — VS Code extension and authoritative `.SNL_Doc` storage behavior.

## License

MIT (TBD — will match SNL-Doc-Extension once that repository picks one).

## Agent Plugin

The repository ships one prebuilt Node core, one shared Agent Skill, one stdio MCP server, and thin manifests for Claude Code, Codex, Hermes Agent, and DeepSeek Harness. The four MCP tools cover all managed entity families through a stable surface:

- `snl_entities_list`
- `snl_entity_get`
- `snl_entity_apply` (`create`, `update`, `delete` with revision CAS)
- `snl_workspace_validate`

Managed entity types are `entry-kind`, `macro-kind`, `entry-package`, `macro-package`, `entry`, `macro`, `relationship`, and `library`.

### Build and verify locally

```bash
npm ci
npm run build:plugin
npm test
npm run lint-types
npm pack --dry-run
```

### Install from this repository

```bash
# Claude Code marketplace + plugin
claude plugin marketplace add SJTU-AI4Math/SNL-Agent-Toolkit
claude plugin install snl-agent-toolkit@snl-agent-toolkit

# Codex marketplace + plugin
codex plugin marketplace add SJTU-AI4Math/SNL-Agent-Toolkit
codex plugin add snl-agent-toolkit@snl-agent-toolkit

# Hermes portable Agent Plugin
hermes plugins install SJTU-AI4Math/SNL-Agent-Toolkit --enable

# DeepSeek Harness profile bundle, from a checkout or packed npm artifact
dsh plugin --profile default add .
```

The npm package also exposes `@snl-doc/agent-toolkit/dsh`, `snl-agent-mcp`, and the batch-oriented `snl-entity` CLI. The plugin runtime is prebuilt and does not require `tsx` or TypeScript source execution.
