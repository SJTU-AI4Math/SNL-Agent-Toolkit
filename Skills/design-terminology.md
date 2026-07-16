# Design terminology (术语化)

> Use this to define kinds and reusable term macros before writing Entries.

### Phase 2 — Terminologization (术语化)

**Purpose.** Establish the **terminology system**: the set of
Entry Kinds, Macro Kinds, and Term Macros the document will use.
This is the highest-leverage step — every later phase reads from
these registries.

**Deliverables (in `.SNL_Doc/`).**
- `config.json#entry_kinds` — one entry per semantic role of a paragraph
  (Definition / Theorem / Remark / …). Each carries `coloring`
  (stroke+background), `numbering` DSL, `style` tag. Presets available
  (`Fulcrum's Math Notes` etc.) via VS Code `SNL: Initialize Entry
  Kinds`; CLI equivalent is TODO.
- `config.json#macro_kinds` — palette-only categories for macros
  (constant / operator / relation / …). No numbering; only affects
  hover-badge coloring.
- One or more `term_macros/<pkg>.json` files — each holds a
  `Record<string, MacroPackageEntry>` of macros. Split by domain
  (`arithmetic.json`, `topology.json`, …) not by size.

**Tools.**
- ⏳ `snl-list-kinds` / `snl-list-package <name>` (P1) — see what
  already exists before inventing.
- ⏳ `snl-macro-find <substring>` (P1) — check the union of active
  packages for prior art.
- ✅ `snl-lint-package` — validate schema, template placeholders,
  cross-style arity.
- ⏳ `snl-commit-batch` (P0.5) — atomic write.

**Rules of thumb.**
- **Every macro name is a lifetime commitment.** Renaming means
  find-and-replace across every SNL source in every entry. Use the
  fully-qualified dotted form (`DivRing.div.frac`, not `frac`) even
  when nothing collides yet — future packages will.
- **Naming rule.** Macro names must match `[A-Za-z_][A-Za-z0-9_.-]*`
  — letters, digits, dots, underscores, and hyphens are all allowed
  in the SNL parser (`SNL-Basics/src/snl-syntax-tree/parser.ts`).
  Hyphens are LEGAL and pass through KaTeX's `\htmlData` verbatim
  (upstream fix 2026-07-04 after empirical verification). Cat's own
  packages use them extensively: `def-hyp`, `hyp-list`,
  `Set.sep-typed`. Use hyphens for multi-word semantic names when
  it reads better than camelCase (`def-hyp` > `defHyp`). Unicode
  (CJK / Greek letters as identifiers) is NOT yet supported — the
  parser rejects it, wait for an upstream change.
- **Style ordering matters.** `styles[0]` is the default (used when
  SNL source omits `[tag]`). Put the most common render first.
- **`dynamic_arity` + `#*`.** If the macro takes a variable number
  of children, set `dynamic_arity: true` AND put `#*` in the default
  style's template. The linter warns if you set one without the other.
- **Backslash escaping in `template`. READ TWICE.** The `template`
  field is a KaTeX source string embedded in a JSON string. JSON
  strings ALREADY escape backslashes — so **exactly ONE backslash in
  the KaTeX command = TWO backslash characters in the JSON source**:

  ```json
  {
    "template": "\\frac{#0}{#1}"    ✓ Correct — renders as \frac{a}{b}
  }
  ```

  ```json
  {
    "template": "\\\\frac{#0}{#1}"  ✗ WRONG — renders as "line break, then literal 'frac{a}{b}'"
  }
  ```

  When the JSON string is decoded, the second form yields `\\frac{...}`,
  and `\\` in KaTeX is the newline command (`\newline`). This is a
  **silent-corruption** trap: KaTeX does NOT throw — it happily renders
  a line break followed by the macro name as literal text. So
  `snl-lint-package` cannot catch it — you must eyeball your templates.

  **How agents fall into this**: LLMs frequently over-escape when writing
  JSON, either because they mentally simulate "escape once for JSON,
  once for LaTeX" (only once is needed — LaTeX doesn't escape) or
  because they're mimicking a Python `re.escape`-style pattern. Whenever
  you write a `template` containing `\`, pause and count the backslashes
  once more before saving.

  **Quick self-check**: read the JSON with a helper that prints the
  DECODED string (not `repr`), so you see the exact characters KaTeX
  will consume. One-liner:

  ```bash
  python3 -c "import json,sys; print(json.load(open('term_macros/pkg.json'))['DivRing']['div']['styles'][0]['template'])"
  # Correct output:  \frac{#0}{#1}
  # Wrong output:    \\frac{#0}{#1}   ← one backslash too many
  ```

  If a KaTeX command appears with `\\` instead of `\` in the printed
  output, you have one too many. Do NOT use `print(dict)` or
  `json.dumps` here — both re-escape and hide the bug. Same trap
  applies to `description` when it embeds inline LaTeX, and to `title`
  fields in `entries.json` when they carry `$…$` math (though `title`
  runs through the entry-render title path where the KaTeX source is
  interpreted separately — same escaping rule, different renderer).

  This trap is separate from SNL `content.snl` (there is no JSON layer
  between SNL source and the parser; `\alpha` in SNL source is one
  backslash, not two).
- **Don't macro-ise prose.** Only concepts that (a) are referenced in
  more than one place OR (b) have non-trivial render (formula, badge,
  cross-link) deserve a macro. Everything else stays as `%text%` /
  `$formula$` leaves.
- **Code-token rendering pattern (KaTeX pipeline).** When macros
  represent code identifiers (class/function/prop/module names in an
  API doc, Lean tactic names in a proof note, etc.), the canonical
  visual is `\texttt{}` for monospace + `\textcolor{name}{...}` for
  kind-driven coloring. Cat 2026-07-11 verbatim: "用 \texttt{} 来切
  字体, 然后宏里面可以写一些改颜色的命令来复刻简单的代码染色, 比如
  类染成青色".

  **DO NOT use hex color literals** (`\textcolor{#0891b2}{...}`). The
  `#` char collides with `fillLatexTemplate`'s `#N` placeholder syntax.
  It works at render time via the `\#` escape, but authoring the
  escape correctly across the JSON/LaTeX layers is error-prone AND the
  linter's placeholder-scan is fixed to recognise `\#` only as of
  2026-07-11 (older linters will false-positive `bad-placeholder`).

  **Use xcolor `dvipsnames` instead** (KaTeX recognises them
  verbatim): `Cerulean` `Teal` `OliveGreen` `Orange` `Goldenrod`
  `RubineRed` `Magenta` `RoyalBlue` `Purple` `Gray` `MidnightBlue`
  are all distinguishable in both light and dark themes.

  Reference implementation: SNL-Basics' `.SNL_Doc/term_macros/api-doc.json`
  (Phase 2 dogfood, 13 code-token macros × single default style
  `\textcolor{<dvipsname>}{\texttt{#0}}`).
- Leave `source: { entries: [], urls: [] }` empty for now — it gets
  filled in phase 5, after entries exist.

---
