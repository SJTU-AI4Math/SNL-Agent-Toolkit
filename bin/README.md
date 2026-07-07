# Toolkit CLIs

Each CLI is a `.mjs` shim (shebang + argv passthrough) that hands off to a
TypeScript implementation under `impl/`, executed via `tsx` so no build step
is required.

**Shipped:**
- `snl-lint-entry.mjs` — schema + SNL syntax + identifier resolution for
  EntryData JSON payloads. See `../AGENT.md` §snl-lint-entry.
- `snl-lint-graph.mjs` — schema + label vocabulary + branch-tree
  integrity for library `graph.json`. See `../AGENT.md` §snl-lint-graph.
- `snl-lint-package.mjs` — schema + template placeholder rules for macro
  package files. See `../AGENT.md` §snl-lint-package.

**Planned (see roadmap in ../AGENT.md):** `snl-commit-batch`, plus the
P1 read CLIs.
