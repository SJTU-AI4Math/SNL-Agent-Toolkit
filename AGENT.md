# AGENT.md — SNL Agent Toolkit

> Read this **first** when you (an agent) are asked to write, edit, or organise
> SNL documents in a `.SNL_Doc/` workspace.

This document has two parts. Depending on the task, you may only need one.

- **Part A — Authoring SNL content.** Rules for how to write SNL syntax, how to
  choose entry kinds, when to split a subentry, and macro conventions. Read this
  for ANY SNL-writing task, even if you're not using this toolkit's CLIs.
- **Part B — Toolkit CLIs.** Search / validate / commit CLIs that let you interact
  with a project's `.SNL_Doc/` folder without the VS Code extension installed.

---

## Part A — Authoring SNL content

_Placeholder — to be filled in the next iteration._

Short version of what will go here:

1. **What SNL is.** A structured math markup language: text with `\macro`-style
   references to shared terms, `[tag]` style variants, `#*` variadic children,
   and formula-or-text render modes. See `docs/snl-syntax-primer.md` for the
   micro-reference.
2. **Entry kinds.** The project defines its own set — theorem / definition /
   remark / example / etc. Each has a coloring + numbering template. Pick the
   kind that matches the paragraph's semantic role. Use `snl-list-kinds` to see
   what's available. If nothing fits, ask before inventing one.
3. **When to split into subentries.** Rule of thumb: a subentry is warranted
   when the child paragraph has its OWN semantic role (a proof of a theorem, an
   example under a definition, a remark inside a section). Don't split for
   pure prose flow.
4. **Macros.** Named terms that render specially and can cross-reference other
   entries. Use `snl-search-macros` before inventing a new one — the project
   likely already has `\Ric`, `\continuous`, etc. Naming a new macro is a
   commitment (it goes in the shared pool), so err on the side of using
   existing ones.

Full authoring rules to be written after we've run the first spike with real
data.

---

## Part B — Toolkit CLIs

_Placeholder — to be filled once the CLIs are implemented._

Planned surface (all take `--root <path-to-workspace-containing-.SNL_Doc>` and
default to `$PWD`):

| CLI | Purpose |
|---|---|
| `snl-list-kinds` | Dump `entry_kinds` + `macro_kinds` from `.SNL_Doc/config.json`. |
| `snl-search-macros <query>` | Fuzzy search macro names + descriptions across `term_macros/*.json`. |
| `snl-search-entries <query>` | Search entry titles + SNL content across `entries.json`. |
| `snl-list-libraries` | Dump each library's slug / title / outline (from `graph.json`). |
| `snl-validate-entry <file.json>` | Schema-check a single EntryData JSON without writing anything. |
| `snl-validate-graph <file.json>` | Schema-check a `graph.json` (branch tree, entryId resolution, cycles). |
| `snl-commit-batch <dir>` | Take a directory of validated JSON payloads and merge them into `.SNL_Doc/`. Fails atomically. |

CLIs are pure Node ESM, no build step. Each is a self-contained script under
`bin/` so an agent can `node bin/xxx.mjs` without `npm install`ing anything
beyond the toolkit's own dev deps.

---

## Workflow patterns

_Placeholder — to be filled once we've run a real batch and know what works._

Rough sketch of what the pattern will look like:

1. Read source material (markdown / LaTeX / natural text) provided by the user.
2. Break it into paragraphs by heading structure (`#` → chapter, `##` → section,
   leaf paragraph → single entry).
3. For each leaf paragraph:
   a. Call `snl-search-macros` for any term you'd like to macro-ise.
   b. Call `snl-list-kinds` if you're not sure what kind fits.
   c. Emit a JSON file into a scratch dir with your candidate EntryData.
4. When the whole document is drafted, call `snl-commit-batch` to validate +
   merge everything atomically. On failure, fix the reported entry and retry.

Design intent: keep each agent invocation stateless and single-purpose — the
scratch dir is the only durable state until commit. If a step fails, drop the
scratch dir and retry.
