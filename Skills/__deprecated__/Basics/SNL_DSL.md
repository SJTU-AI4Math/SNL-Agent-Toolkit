# SNL DSL syntax

> Foundational reference for writing and parsing `content.snl`.

SNL source is one syntax tree. It is not Markdown and it is not a sequence of sibling expressions.

## Grammar

```text
node     := "@"? name ("@" IDENT)? ("[" IDENT "]")? ("(" args? ")")?
args     := node ("," node)*
name     := IDENT | "%" text "%" | "$" latex "$" | "$$" latex "$$"
```

The parser must reach EOF after the root node.

## Name forms

- `foo` — registered macro name or identifier fallback.
- `%plain text%` — text-mode synthetic node.
- `$x + y$` — inline-formula synthetic node.
- `$$x + y$$` — display-formula synthetic node.
- `@foo` — binder form. The binder tag applies recursively to its subtree.

Delimited contents are flat strings. The parser does not recursively parse SNL inside `%…%`, `$…$`, or `$$…$$`.

Identifiers use ASCII letters, digits, `_`, `.`, `-`, and an optional leading backslash form accepted for LaTeX-like fallback names. Macro authors should prefer stable semantic ASCII names.

## Children and styles

```snl
foo(a, b)
foo[compact](a, b)
```

- Parentheses hold ordered child nodes.
- Commas are mandatory between children.
- A trailing comma is invalid.
- `[style]` selects a tag from the macro's `styles[]`; without it, `styles[0]` is used.

## Cross-entry source postfix

A node may identify the Entry that owns its binding:

```snl
x@algebra.def.group
x@algebra.def.group[bold]
```

The postfix appears immediately after the node name and before `[style]` or `(children)`. The source id must resolve to an Entry in the shared pool. Do not write `@x@source`; binder introduction and cross-entry reference are different operations.

## Natural language with embedded terms

Use a text carrier with positional children:

```snl
%Natural language paragraph with #0 embedded inside.%(SNL_Macros)
```

For several terms:

```snl
%Open #0, then press #1.%(Dashboard,Save_Button)
```

`#0`, `#1`, … are filled by the corresponding child. This keeps the prose intact while making named concepts real macro nodes.

## Single-root examples

Valid:

```snl
leq(absValue(innerProduct(x,y)),times(norm(x),norm(y)))
```

```snl
%For #0, multiplication is associative.%(Group)
```

Invalid:

```snl
%For% Group %multiplication is associative.%
```

The invalid form has three roots. Put the prose in one carrier node and interpolate `Group` as a child.

## Escaping boundary

- Outside `%…%`, `$…$`, and `$$…$$`: SNL syntax applies.
- Inside `%…%`: text/KaTeX text payload applies.
- Inside `$…$` and `$$…$$`: KaTeX formula payload applies.
- The parser and renderer do not repair author escaping.
- JSON adds another escaping layer only when the SNL source or macro template is stored in a JSON string.

## Resolution

A plain identifier resolves in this order:

1. registered active macro;
2. binder/free-variable classification;
3. visible fallback rendering.

An unresolved name is not automatically a parser error. Use strict linting when every identifier is expected to come from the active macro pool.

## Related basics

- Macro definition and rendering: [`SNL_Macro.md`](SNL_Macro.md)
- On-disk files: [`Json_Schema.md`](Json_Schema.md)
