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
npm ci
npm run build:web
npm run build:plugin
node dist/cli/snl.mjs --help
npm test
```

Invoke the unified CLI from a checkout or as the installed `snl` bin. Source lives under `src/cli/`; `package.json.bin` points to the built `dist/cli/` artifacts. Looking only in the legacy `bin/` directory is not capability discovery. A PATH-linked executable can also lag a newer checkout.

For a new workspace, read [Initialize](Skills/Initialize/SKILL.md). The default is the lean three Entry Kinds / five Macro Kinds plus BasicMacros, not a full template catalog. Preset forms below are alternatives, not successive commands to run on one target:

```bash
./dist/cli/snl.mjs --root /path/to/project --json init
./dist/cli/snl.mjs --root /path/to/project --json init --preset lean4-document
./dist/cli/snl.mjs --root /path/to/project --json init --input preset.json
./dist/cli/snl.mjs --root /path/to/project --json entry list --limit 50
./dist/cli/snl.mjs --root /path/to/project --json entry get algebra.def.group
./dist/cli/snl.mjs --root /path/to/project --json validate

```

The write CLIs compute canonical identity hashes and filenames, construct storage
envelopes, fill safe defaults, lint before writing, acquire `.data-write.lock`, and
refuse malformed/current-future-incompatible workspaces. `--json` gives stable
agent-facing `snl.result/v1` objects with `ok`, `command`, and `data` or a structured `error`. They never edit
migration receipts or frozen legacy backups.

See [`Skills/CLI Tools/SKILL.md`](<Skills/CLI Tools/SKILL.md>) for the normative command contracts and `snl --help` for the implemented command inventory. The manual is not a promise that every command is available: for example, batch, import/migrate, and Library HTML export remain planned unless advertised by the executable. Never emulate these with direct JSON writes.

Legacy compatibility binaries remain available for existing callers; they are not the recommended new-workspace workflow. Current usable packaged guides are listed in [Skills/README.md](Skills/README.md); reserved directories are not completed workflows. Installing the MCP plugin registers tools, not a native Skill alias named `snl-agent-toolkit`.

## Local Web reader

After installing a built npm package (or building the source checkout above and running `npm link`):

```bash
cd /path/to/my-snl-workspace
snl
# SNL read-only reader: http://127.0.0.1:4911

snl --root /path/to/another-workspace --port 4912
```

Open the printed URL in a browser. The homepage shows the canonical root and Libraries. Reading, SNoogL, relationship graph and common routes use the same Reader source as HTML exports. Refresh reloads current folder data; no editor or data-source switching is included in this first version. Source/Monaco viewing is not yet connected in this local host (existing HTML export source viewing is unchanged).

The startup folder is the initial data source, not the Toolkit installation folder. No parent search or process-wide `chdir` occurs. Missing `.SNL_Doc` gives an `snl init` hint without initializing it. The process stays in the foreground; Ctrl+C stops it. Port conflicts fail rather than changing ports. `--json` prints one `snl.web/v1` readiness event after listening, then keeps running; operation commands retain `snl.result/v1`. Help never starts a service. The HTTP host is not an MCP operation.

The listener binds only to `127.0.0.1`. It serves an explicit frontend asset list and read APIs, not arbitrary repository paths. Foreign Host/Origin, cross-site requests and mutations are rejected. Do not expose this local-only service through an external reverse proxy.

### Shared frontend build

`reader-source.json` pins an immutable Extension revision. `npm run build:web` downloads that source at build time, installs its locked build dependencies in a temporary directory, then invokes its maintained `build-local-reader.mjs`. It builds shared browser and model artifacts into ignored `dist/web/`; no UI source fork is vendored into Toolkit. `npm run build:web -- --source /path/to/extension` can instead use an already-installed, clean checkout at exactly the pinned revision. `npm pack` performs the frontend build and includes the prebuilt assets. Node, npm, network access and tar are needed when building from source; normal `snl` startup needs no network, compiler or VS Code.

## Schema ownership

The authoritative product and data contracts live in `.SNL_Doc`; Toolkit compatibility types live in `lib/snl-doc-schema.ts`. The on-disk schema implementation is shared with `SNL-Doc-Extension` and must fail closed on unsupported versions.

Toolkit currently targets workspace data `0.1.0`, Package schema 2,
Entry/Macro schema 1, and Macro v11 from SNL-Basics 0.3.3. It retains
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
