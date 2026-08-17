# SNL Macro syntax and semantics

> Foundational reference for defining and invoking macros.

An SNL Macro gives a stable semantic name to a concept and defines how that node renders. Macro definitions live in `.SNL_Doc/macros/*.json` envelopes and belong to Package manifests under `.SNL_Doc/packages/`; invocations live in Entry `content.snl`.

## Invocation

```snl
Group
mul(a,b)
mul[infix](a,b)
list(item1,item2,item3)
```

- Bare name: zero children.
- `(…)`: ordered children.
- `[style_name]`: select a style explicitly. Omission uses `styles[0]`.
- Macro names are identity keys. Treat renaming as a migration across every Entry.

## Package shape

```json
{
  "version": "11",
  "name": "Algebra",
  "description": "Algebra terminology",
  "macros": {
    "mul": {
      "description": "Multiplication",
      "source": { "entries": ["algebra.def.mul"], "urls": [] },
      "kind": "operator",
      "dynamic_arity": false,
      "styles": [
        {
          "style_name": "default",
          "template": {
            "mode": "formula_inline",
            "body": "#0 \\cdot #1"
          },
          "tags": []
        }
      ],
      "tags": []
    }
  }
}
```

The object key is the macro name. The in-memory editor shape may repeat it as `name`; the on-disk package map does not.

## Create a Macro safely

Author one inner Macro draft. Do not include a storage envelope, hash, filename, or
Package wrapper:

```json
{
  "name": "mul",
  "description": "Multiplication",
  "styles": [
    {
      "style_name": "default",
      "template": { "mode": "formula_inline", "body": "#0 \\cdot #1" }
    }
  ]
}
```

Create it in an existing Package:

```bash
node bin/snl-add-macro.mjs --root . --package Algebra --json macro-draft.json
```

If the Package does not exist, create and activate it first:

```bash
node bin/snl-add-package.mjs --root . --json package-draft.json
```

`snl-add-macro` supplies omitted `description`, `source.entries`, `source.urls`,
`kind`, and Macro/style `tags`. It infers `dynamic_arity` from an unescaped
`#*`. It then runs Macro v11 and KaTeX validation, constructs the envelope, computes
the canonical identity path, and installs it under `.data-write.lock`. Pass
`--no-katex` only in an environment where KaTeX checking is deliberately unavailable.

An `info/macro.package-inactive` issue means the Macro was stored successfully but
cannot resolve until its Package is activated. `invalid`, `conflict`, and `error`
results do not overwrite an existing Macro.

**Never edit `macros/*.json`, `packages/*.json`, `term_macros/*.json`, the migration
receipt, or hash-derived filenames by hand during normal authoring.**

## Macro fields

- `description`: human explanation; may be empty.
- `source.entries`: Entry ids that define or own the concept.
- `source.urls`: stable external references.
- `kind`: required non-empty id from `config.json#macro_kinds`. Macro v11 uses `sub` rather than the retired `partial`.
- `dynamic_arity`: whether output is assembled from every child rather than fixed `#N` slots.
- `styles`: non-empty ordered styles. `styles[0]` is the implicit default.
- `tags`: required free-text label array; use `[]` when empty. Tags must not contain backslashes.

## Style fields

- `style_name`: unique within the macro and matching `[A-Za-z_][A-Za-z0-9_]*`.
- `template`: one atomic object containing `mode`, `body`, and optional backend
  fields, or an i18n map whose values are complete template objects.
- `template.mode`: one of `formula_inline`, `formula_display`, `text`, `block`.
- `template.body`: rendering body; use `#N` for fixed arity and a real `#*` for dynamic arity.
- `template.separator`: optional string used to join children inserted at `#*`; explicit `""` is preserved.
- `template.block_template_name`: optional block-renderer dispatch key, valid only when `mode` is `block`.
- `tags`: required free-text label array; use `[]` when empty. Tags must not contain backslashes.
- `typst`, `latex`, `markdown`, `text`: optional per-style output backends.

## Fixed arity

Use canonical `#0` through `#99` in `template`:

```json
{
  "dynamic_arity": false,
  "styles": [
    {
      "style_name": "default",
      "template": { "mode": "formula_inline", "body": "\\frac{#0}{#1}" },
      "tags": []
    }
  ]
}
```

Only canonical `#0` through `#99` and `#*` are special. Three-or-more-digit
indexes, leading-zero forms such as `#00`, and malformed hashes such as `##`
are errors. Escape a literal hash as `\#`.

## Dynamic arity

In Macro v11, every dynamic style template body must contain `#*`. The renderer replaces `#*` with all rendered children joined by `separator`, while preserving all surrounding template text.

```json
{
  "dynamic_arity": true,
  "styles": [
    {
      "style_name": "default",
      "template": { "mode": "text", "body": "[#*]", "separator": ", " },
      "tags": []
    }
  ]
}
```

Do not use the removed `variadic_left`, `variadic_join`, or `variadic_right` fields. Put delimiters and other surrounding output directly in `template` around `#*`.

## JSON and KaTeX escaping

A macro template is KaTeX source inside a JSON string. One decoded KaTeX backslash is written as two characters in JSON source:

```json
{ "template": { "mode": "formula_inline", "body": "\\frac{#0}{#1}" } }
```

Do not double-escape again. `"\\\\frac"` decodes to two backslashes and changes the KaTeX meaning.

For technical text terms, author the escaping explicitly (`_`, `{`, `}`, `%`, `$`, `&`, and backslashes). Parser and renderer do not auto-escape author data.

## Naming and packaging

The concrete naming standard is per-document, declared in that document's
`.SNL_Doc/CONVENTIONS.md`. Read it before adding a name; see
[`../HowToBuild/Terminologization.md`](../HowToBuild/Terminologization.md) step 4.

- Prefer semantic ASCII names that will remain stable.
- Use dotted qualification when the domain needs it: `DivRing.div.frac`.
- Split packages by domain or ownership, not arbitrary file size.
- Activate packages through `config.json#active_macro_packages`.
- If `active_macro_packages` is absent, legacy readers may treat every package as active; do not rely on that ambiguity in new documents.
- Before adding a name, search all active packages for an existing concept.

## What deserves a macro

Create a macro when a concept is reused, needs semantic source links, needs hover behavior, or has non-trivial rendering. Leave genuinely one-off prose in a `%…%` carrier.

## Validation

```bash
node bin/snl-lint-package.mjs --root . --name package-name
```

The linter enforces Macro v11: required `kind`, required macro/style `tags`,
valid unique `style_name`, atomic/localized template projections, dynamic `#*`,
string `separator`, block-only `block_template_name`, modes, placeholders, and
KaTeX-compilable bodies. Still inspect decoded templates when backslashes are involved.

## Migrating Toolkit package files from Macro v6

SNL-Basics's canonical `migrateMacroDocument` expects a flat macro record whose
values include `name`. Toolkit package files deliberately omit that redundant
field because `macros` map keys are the macro identities. Do not pass a package's
`macros` object directly to the Basics migration: the resulting names would be
missing.

Import `migrateMacroPackageV6toV8` from `lib/snl-doc-schema.ts` (implemented in
`lib/migrate-macro-package.ts`). The adapter
validates the package map, restores each authoritative map key as a transient
macro `name`, invokes the canonical Basics v6→v7→v8 migration, then removes the
redundant value-level name. It preserves package version/metadata, unknown
extension fields, and Toolkit output backends without mutating the input. The
result has Package wrapper version `8` and required `default_style`. Always
run `lintPackage` (or `snl-lint-package`) on the migrated result before writing
it to disk.

## Related basics

- Invocation grammar: [`SNL_DSL.md`](SNL_DSL.md)
- Full file shapes: [`Json_Schema.md`](Json_Schema.md)
