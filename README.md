# SNL Agent Toolkit

CLI and agent-facing Skills for working with [SNL](https://github.com/SJTU-AI4Math/SNL-Basics) documents inside an [`SNL-Doc-Extension`](https://github.com/SJTU-AI4Math/SNL-Doc-Extension) workspace without opening the IDE.

Agents should begin with [`AGENT.md`](AGENT.md), then load the task-specific documents under [`Skills/`](Skills/README.md).

## Layout

```text
SNL-Agent-Toolkit/
├── AGENT.md                   # short routing entry point
├── Skills/
│   ├── SNL Ecosystem/         # workspace concepts and DSL
│   ├── Initialize, Plan/      # setup and topology planning
│   ├── Author, Read, Maintain/# core workflows
│   ├── RefineNL2SNL/          # NL → SNL quality refinement
│   └── Verify and Fix/        # validation and repair
├── src/cli/                   # hand-written unified and compatibility CLI sources
├── dist/cli/                  # prebuilt executable artifacts
├── bin/                       # checkout-only legacy compatibility shims
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

Invoke the unified CLI from a checkout or as the installed `snl` bin. Legacy
`bin/snl-*.mjs` shims remain checkout-only compatibility entry points:

```bash
./dist/cli/snl.mjs --root /path/to/project --json entry list --limit 50
./dist/cli/snl.mjs --root /path/to/project --json entry get algebra.def.group
./dist/cli/snl.mjs --root /path/to/project --json validate

# Legacy compatibility examples
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

See [`Skills/CLI Tools/SKILL.md`](Skills/CLI%20Tools/SKILL.md) for the current command inventory and machine-facing invocation contracts.

## Schema ownership

The authoritative product and data contracts live in `.SNL_Doc`; Toolkit compatibility types live in `lib/snl-doc-schema.ts`. The on-disk schema implementation is shared with `SNL-Doc-Extension` and must fail closed on unsupported versions.

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

The repository ships one prebuilt Node core, one stdio MCP server, and thin manifests for Claude Code, Codex, Hermes Agent, and DeepSeek Harness. The seven MCP tools expose Entry and Library reading projections plus all managed entity families through a stable surface:

- `snl_entities_list`
- `snl_entity_get`
- `snl_entry_latex` — directly assembled bare LaTeX; block macros become `macro-name(rendered subtrees)` placeholders
- `snl_library_entry_tree` — folder-style multiline Library hierarchy with field and language controls
- `snl_entity_apply` (`create`, `update`, `delete` with revision CAS)
- `snl_workspace_validate`
- `snl_execute` — strict `snl.operation/v1` object execution shared with the unified `snl` CLI

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

# Hermes Agent: register the prebuilt stdio MCP
# (Hermes native `plugins install` expects a Python plugin.yaml plugin, not a portable Agent Plugin.)
git clone https://github.com/SJTU-AI4Math/SNL-Agent-Toolkit.git ~/.hermes/vendor/snl-agent-toolkit
hermes mcp add snl-agent-toolkit \
  --command node \
  --args ~/.hermes/vendor/snl-agent-toolkit/dist/mcp/server.cjs
hermes mcp test snl-agent-toolkit
# Start a new Hermes session so the seven MCP tools enter its fixed tool set.

# DeepSeek Harness profile bundle, from a checkout or packed npm artifact
dsh plugin --profile default add .
```

The npm package also exposes `@snl-doc/agent-toolkit/dsh`, `snl-agent-mcp`, and the batch-oriented `snl-entity` CLI. The plugin runtime is prebuilt and does not require `tsx` or TypeScript source execution.
