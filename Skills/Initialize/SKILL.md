# Initialize

Use this guide when an existing directory or repository should become a new SNL workspace. Initialize through the official Toolkit, not by constructing `.SNL_Doc` files, calculating identity hashes, or copying an old workspace skeleton. These instructions describe the default bootstrap and explicitly selected presets; initialization is not migration or repair.

Before use, identify the installed `snl` executable and run `snl --help` and `snl init --help`. A source checkout, built `dist`, PATH-linked executable, and agent Skill registration are different things. Follow the executed version's advertised commands, not a historical claim that there is no init CLI. Other workflows in the CLI manual can still be normative but unimplemented; do not emulate an absent command silently.

## Primary Initialization

1. Confirm the exact target root: it must already exist as a canonical, non-symlink directory. Init does not create missing parent directories. An existing non-empty repository is allowed, but `.SNL_Doc` must be absent as a directory, file, or symlink. Preserve unrelated project files. Init has no overwrite, force, merge, or migration mode, even if a user asks to replace an old workspace: resolve that separately before initialization.
2. Rehearse the selected default or preset in an empty temporary directory. For the normal default, run:

```bash
snl init --root /absolute/target --json
snl info --root /absolute/target --json
snl validate --root /absolute/target --json
```

Use the real target only after the rehearsal succeeds. `--root` selects the target (omitting it defaults to the current directory); `snl init <dir>` is invalid. Do not run multiple alternative init forms on the same workspace.
3. Require exit 0, `ok: true`, and `data.valid: true`. The CLI emits one `snl.result/v1` JSON object; branch on structured errors rather than scraping prose. Existing `.SNL_Doc` returns `workspace.already-initialized` with exit 1 and no replacement. Inspect failures before retrying; do not delete data or hand-write receipts to bypass them.
4. Read back `snl entry-kind list --root /absolute/target --json`, `snl macro-kind list --root /absolute/target --json`, and `snl macro list --root /absolute/target --json`. Defaults include the `_unpackaged` and `BasicMacros` Packages and seven structural BasicMacros, but no Entries or Library. Keep Kind counts separate from Macro counts.
5. Keep the initializer-owned `.gitkeep` files in `entries/`, `macros/`, and `libraries/` when committing `.SNL_Doc`. Git does not preserve empty directories. Before publication, validate a fresh checkout/archive of the staged tree as well as the live workspace. Create an actual Library later through the public API when needed.

### Presets are explicit alternatives

`snl init --root /absolute/target --preset <id> --json` selects one advertised built-in preset. `snl init --root /absolute/target --input /absolute/preset.json --json` selects a custom preset; `--input -` reads JSON from stdin. These selectors are mutually exclusive. Help advertises the built-in IDs; inspect a preset's actual payload in scratch rather than assuming its name means it reproduces an existing template repository. Presets overlay the default bootstrap by exact identity; custom lists are not replacements for the complete bootstrap.

### MCP / agent transport

Initialization is exposed through `snl_execute`, not `snl_entity_apply`. Discover the live tool schema and pass this tool-argument object (without a top-level `protocol` field):

```json
{"root":"/absolute/target","command":"init","arguments":{}}
```

For validation through the same tool:

```json
{"root":"/absolute/target","command":"validate","arguments":{"scope":"workspace"}}
```

The adapter adds the `snl.operation/v1` protocol internally and returns the shared `snl.result/v1` result. With MCP, inspect `structuredContent.ok` and its structured error; an operation failure is not necessarily a transport `isError`. Discover operation support first with `snl_execute` using `command: "help"` and `arguments: {}`: a custom older adapter may register the tool but return `operation.unsupported`. For a named preset use `arguments: {"preset":"react"}`; a custom preset object goes in `arguments.value`, not a server-side input filename. Installing the MCP server does not automatically register a Skill with the same name. Load this packaged guide by its actual path if the host has no registered Skill alias.

## Entry Kind Initialization

The official default Entry Kinds are `section`, `subsection`, and `entry`. Start with this lean catalog unless a domain preset is explicitly intended; add semantic roles deliberately through the public Kind API as the document evolves.

An existing Fulcrum template's full 16 Entry Kinds are a separate configuration, not an obsolete list and not the new-workspace default. Do not copy the full catalog automatically. Read back actual IDs and theme/localization fields after selecting a preset. Do not use Entry Kinds merely to encode subject areas that belong in Library topology or Packages.

## Macro Kind Initialization

The official default Macro Kinds are `fvar`, `binder`, `const`, `bvar`, and `sub`. These five categories are distinct from the seven seeded BasicMacros. Preserve the initializer's current light/dark coloring and schema, and use public Kind APIs for later authorized changes.

A template's full six Macro Kinds are a separate configuration, not the default. Do not infer that every preset installs the template's writing Macros or removes required default Kinds. Compare the actual scratch-workspace catalog and Macro inventory before selecting or extending a preset.
