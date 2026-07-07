# Toolkit CLIs

Each CLI is a `.mjs` shim (shebang + argv passthrough) that hands off to a
TypeScript implementation under `impl/`, executed via `tsx` so no build step
is required.

**Shipped:**
- `snl-lint-entry.mjs` — schema + SNL syntax + reference lint for EntryData
  JSON payloads. See `../AGENT.md` §snl-lint-entry.

**Planned (see roadmap in ../AGENT.md):** `snl-lint-graph`,
`snl-lint-package`, `snl-commit-batch`, plus the P1 read CLIs.
