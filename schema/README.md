# Vendored schema

The `.ts` files here are **snapshots** of the on-disk schema owned by the
[`SNL-Doc-Extension`](https://github.com/SJTU-AI4Math/SNL-Doc-Extension) repo.
They are copied verbatim (minus the `vscode` imports and the runtime helpers
they gate) so the toolkit doesn't take a dependency on the extension itself.

**Source of truth:** `SJTU-AI4Math/SNL-Doc-Extension`, files
`src/snlDoc.ts` and `src/libraryGraph.ts`.

**Frozen at commit:** _(not yet — populate this when the first snapshot lands)_

## Sync procedure

When the extension's schema changes:

1. Diff `SNL-Doc-Extension/src/snlDoc.ts` and `libraryGraph.ts` against the
   currently-vendored copies.
2. Copy the changed **interface / type** declarations across (leave runtime
   helpers behind).
3. Strip any `vscode.*` imports; the toolkit's CLIs use plain `node:fs`.
4. Bump the "Frozen at commit" line above to the new HEAD sha.
5. Bump `package.json` version in the toolkit root (breaking → major).

Eventually we'll extract `@snl-doc/schema` into its own package that both the
extension and this toolkit depend on. Until then, this manual sync is the
guardrail.
