# SNL Macro syntax and semantics

> Foundational reference for defining and invoking macros.

An SNL Macro gives a stable semantic name to a concept and defines how that node renders. Macro definitions live in `.SNL_Doc/term_macros/*.json`; invocations live in Entry `content.snl`.

## Invocation

```snl
Group
mul(a,b)
mul[infix](a,b)
list(item1,item2,item3)
```

- Bare name: zero children.
- `(…)`: ordered children.
- `[tag]`: select a style; omission selects `styles[0]`.
- Macro names are identity keys. Treat renaming as a migration across every Entry.

## Package shape

```json
{
  "version": "0.0.3",
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
          "tag": "default",
          "mode": "formula_inline",
          "template": "#0 \\cdot #1"
        }
      ]
    }
  }
}
```

The object key is the macro name. The in-memory editor shape may repeat it as `name`; the on-disk package map does not.

## Macro fields

- `description`: human explanation; may be empty.
- `source.entries`: Entry ids that define or own the concept.
- `source.urls`: stable external references.
- `kind`: optional id from `config.json#macro_kinds`. If the author declares `fvar`, the UI should show the free-variable styling; consumers must not silently neutralize that declaration.
- `dynamic_arity`: whether output is assembled from every child rather than fixed `#N` slots.
- `styles`: non-empty ordered styles. `styles[0]` is the implicit default.
- `tags`: optional free-text labels.

## Style fields

- `tag`: unique within the macro.
- `mode`: one of `formula_inline`, `formula_display`, `text`, `block`.
- `template`: fixed-arity rendering template.
- `variadic_left`, `variadic_join`, `variadic_right`: dynamic-arity delimiters and separator.
- `react_renderer_key`: optional built-in React renderer.
- `typst`, `latex`, `markdown`, `text`: optional per-style output backends.

## Fixed arity

Use `#0`, `#1`, … in `template`:

```json
{
  "dynamic_arity": false,
  "styles": [
    { "tag": "default", "mode": "formula_inline", "template": "\\frac{#0}{#1}" }
  ]
}
```

Only numeric placeholders and `#*` are special. A literal hash must be escaped according to the template/KaTeX context.

## Dynamic arity

For current SNL-Basics rendering, a dynamic macro's body is composed from its delimiters and rendered children; the ordinary template body is ignored.

```json
{
  "dynamic_arity": true,
  "styles": [
    {
      "tag": "default",
      "mode": "text",
      "template": "",
      "variadic_left": "[",
      "variadic_join": ", ",
      "variadic_right": "]"
    }
  ]
}
```

Do not put meaningful output in a dynamic macro's `template`.

## JSON and KaTeX escaping

A macro template is KaTeX source inside a JSON string. One decoded KaTeX backslash is written as two characters in JSON source:

```json
{ "template": "\\frac{#0}{#1}" }
```

Do not double-escape again. `"\\\\frac"` decodes to two backslashes and changes the KaTeX meaning.

For technical text terms, author the escaping explicitly (`_`, `{`, `}`, `%`, `$`, `&`, and backslashes). Parser and renderer do not auto-escape author data.

## Naming and packaging

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

The linter checks package shape, style tags, modes, placeholders, dynamic/fixed consistency, and KaTeX-compilable templates. Still inspect decoded templates when backslashes are involved.

## Related basics

- Invocation grammar: [`SNL_DSL.md`](SNL_DSL.md)
- Full file shapes: [`Json_Schema.md`](Json_Schema.md)
