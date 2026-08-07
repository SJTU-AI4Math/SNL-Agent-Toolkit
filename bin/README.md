# Toolkit CLIs

Each CLI is a `.mjs` shim (shebang + argv passthrough) that hands off to a
TypeScript implementation under `impl/`, executed via `tsx` so no build step
is required.

**Shipped:**
- `snl-add-package.mjs` — create and activate a canonical Package manifest from a business draft.
- `snl-add-entry.mjs` — validate an inner Entry draft and install its canonical envelope/path.
- `snl-add-macro.mjs` — normalize and validate a Macro v8 draft, then install it in a Package.
- `snl-lint-entry.mjs` — schema + SNL syntax + identifier resolution for
  EntryData JSON payloads.
- `snl-lint-graph.mjs` — schema + label vocabulary + branch-tree
  integrity for library `graph.json`.
- `snl-lint-package.mjs` — schema + template placeholder rules for macro
  package files.
- `snl-find-refs.mjs` — find every structured definition/reference to an
  Entry or Macro identity.
- `snl-rename-id.mjs` — collision-checked global Entry/Macro rename; supports
  `--dry-run` and rollback on write failure.

See `../Skills/HowToMaintain/Use_Toolkit_CLIs.md` for complete usage.

**Planned:** remaining P1 read CLIs and, if real workloads require it, a guarded bulk-write CLI built on the same primitives.
