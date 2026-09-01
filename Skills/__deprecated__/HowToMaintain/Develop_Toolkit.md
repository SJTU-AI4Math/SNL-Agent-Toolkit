# Develop the Toolkit

> Use this when changing CLI implementation, validation scripts, or internal compatibility types.

## Contributing

- Every CLI: `.mjs` shim under `bin/` (shebang + hand off to `tsx`) plus implementation under `bin/impl/*.ts`.
- Shared runtime logic goes in `lib/`.
- CLI validation scripts live in `CLI_Scripts/*.test.ts` and run via `npm test` (`tsx --test`).
- Type check: `npm run lint-types` (`tsc --noEmit`).
- Agent-facing schema knowledge lives in [`../Basics/Json_Schema.md`](../Basics/Json_Schema.md).
- Toolkit compatibility types live in `lib/snl-doc-schema.ts`.
- When the Extension schema changes, update the Markdown schema, compatibility types, lints, and fixtures together.

## Required verification

```bash
npm test
npm run lint-types
```

Run artifact-specific CLI checks as well when changing parser, renderer, schema, or linter behavior.
