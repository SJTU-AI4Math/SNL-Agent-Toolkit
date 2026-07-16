# SNL language rules

> Read this for syntax, identity, binding, and single-root invariants.

### Bedrock rules (applied everywhere)

- **SNL syntax is a single macro tree per `content.snl`.** Free text
  lives inside `%…%` (text mode), `$…$` (formula inline), `$$…$$`
  (formula display). Macro references are bare identifiers
  (`R`, `DivRing.div.frac`) — no `\backslash-prefix`. Apply children
  with parens `foo(a, b)`; select a style with brackets
  `foo[display](a, b)`; introduce a binder with `@foo(x)`; **refer
  back to an entry-scoped context binder with the `x@srcEntry`
  src-postfix** (see below).
- **Bound-var references with the `@` src-postfix.** When an entry
  introduces a local name via `@foo(x)` and a DIFFERENT entry needs
  to reference that same `x`, write `x@srcEntry` where `srcEntry`
  is the id of the entry that owns the binder. The parser reads this
  as: "the bvar named `x`, bound in `srcEntry`". Rules:
    - `srcEntry` must be a real Entry id in the same pool. The
      Infoview auto-generates a `uses_context` relationship for every
      such reference (see SNL-Doc-Extension §auto-dep regen).
    - Only USES the binder — never re-introduces it. Do NOT write
      `@x@srcEntry`; that's a syntax error.
    - Works in both formula and text-carrier contexts, same as any
      other identifier. Style postfix `[tag]` still applies:
      `x[bold]@srcEntry`.
    - Prefer this over redeclaring `x` locally when the entry is
      semantically continuing a definition from `srcEntry` — that's
      exactly the situation the src-postfix exists to express.
- **Identity fields never change.** `EntryKind.id`, `MacroKind.id`,
  `EntryData.id`, macro package filenames, and `MacroPackageEntry.name`
  are lookup keys referenced from elsewhere. "Rename" = delete +
  recreate. Every `update*` API and CLI enforces this.
- **The parser wants EOF after the single root.** `"For any R, foo"`
  fails with `Expected EOF but got IDENT at position N`. Wrap prose in
  `%…%`.
- **When unsure, ask.** Inventing an entry kind, macro name, or
  library slug on the user's behalf commits them to a schema
  decision they'll live with. Cheap to ask, expensive to unwind.

---
