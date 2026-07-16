# Develop the Toolkit

> Use this when changing CLI implementation, tests, or vendored schema types.

## Contributing

- Every CLI: `.mjs` shim under `bin/` (shebang + hand off to `tsx`) +
  implementation under `bin/impl/*.ts`. Shared logic goes in `lib/`.
- Tests: `tests/*.test.ts` — run via `npm test` (uses tsx + node --test).
- Type check: `npm run lint-types` (tsc --noEmit).
- Schema drift: if `SNL-Doc-Extension/src/snlDoc.ts` changes, sync
  `schema/snl-doc.ts` per the procedure in `schema/README.md`.
