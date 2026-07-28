# Author Entries (条目预制)

> Use this during large-scale NL → SNL construction to create the shared Entry pool and fill macro-first `content.snl`.

Read [`../Basics/Json_Schema.md`](../Basics/Json_Schema.md), [`../Basics/SNL_DSL.md`](../Basics/SNL_DSL.md), and [`../Basics/SNL_Macro.md`](../Basics/SNL_Macro.md) before authoring. Those files own syntax and field semantics; this guide owns the build procedure.

## Purpose

Materialize the full planned Entry set before prose writing drifts the document structure. Entry ids then become stable handles for Library nodes, macro sources, pointers, and semantic relationships.

## Inputs

- Entry blueprint from [`Drafting.md`](Drafting.md);
- kinds and concept ownership from [`Terminologization.md`](Terminologization.md);
- current shared `entries.json` pool;
- target Library outline.

## Phase A — prefabricate records

Create every planned record with identity and classification fixed:

```json
{
  "id": "topology.def.continuous",
  "kind": "definition",
  "title": "Continuous function",
  "content": {},
  "contribution_info": null,
  "pointer": null
}
```

At this phase, empty content is intentional. It lets Library construction and semantic-source planning proceed without guessing future ids.

### ID conventions

Prefer a stable semantic form:

```text
<domain>.<kind>.<slug>[.<qualifier>]
```

Examples:

- `topology.def.continuous`
- `topology.thm.continuousComposition`
- `topology.thm.continuousComposition.proof`
- `linearAlgebra.def.linearMap.pointfree`

Ids must be non-empty and globally unique in `entries.json`. Keep them ASCII, case-consistent, shell-safe, and human-readable. UUIDs are acceptable for machine-only bulk imports, not the default for hand-maintained libraries.

## Phase B — write `content.snl`

Work Entry by Entry in Library order.

### 1. Inventory required concepts

Before writing a paragraph, list every named concept it uses. Resolve each against active macro packages.

If a reusable concept is missing, stop and return to terminology design. Do not hide it in dead LaTeX or plain prose merely to finish the Entry.

### 2. Build one semantic tree

Use registered macros for concepts and operators. Use `%…%` carriers only for natural-language glue, interpolating semantic children through `#N` slots.

```snl
%For every #0, #1 is associative.%(Group,mul)
```

The complete `content.snl` must have one root. The exact grammar belongs to [`../Basics/SNL_DSL.md`](../Basics/SNL_DSL.md).

### 3. Keep one Entry = one semantic unit

Split a child paragraph when it has its own role, such as a proof, example, remark, or independently referenced result. Do not split merely to make prose shorter.

### 4. Preserve the shared-pool model

Libraries reference Entries; they do not own private copies. Reuse an existing Entry when two Libraries need the same semantic unit.

Section-heading Entries may have a title with empty body when they exist only to anchor a branch.

### 5. Add pointers only when concrete

`contribution_info` and `pointer` are pass-through fields. Keep them `null` unless real source metadata is available; never fabricate a location.

## Validation loop

A draft Entry whose id is not yet committed can be linted directly:

```bash
node bin/snl-lint-entry.mjs --root . --strict-macros draft-entry.json
```

For an Entry already present in the pool, use a temporary `.SNL_Doc` lint root with:

- the same `config.json`;
- the same active macro packages;
- an empty `entries.json`.

This avoids the expected duplicate-id diagnostic while retaining schema, macro-resolution, and Preview checks.

**`snl-lint-entry` takes one Entry object per file.** It rejects an array, so
`.SNL_Doc/entries.json` cannot be passed to it directly. To sweep the whole
pool, explode it into one file per Entry inside the temporary lint root and pass
them all in a single invocation:

```bash
python3 - <<'PY'
import json, os
src = '.SNL_Doc/entries.json'
os.makedirs('/tmp/lintroot/drafts', exist_ok=True)
for i, entry in enumerate(json.load(open(src))):
    json.dump(entry, open(f'/tmp/lintroot/drafts/e{i}.json', 'w'), ensure_ascii=False)
PY
node bin/snl-lint-entry.mjs --root /tmp/lintroot /tmp/lintroot/drafts/*.json
```

Copying the pool into the temporary root instead would resurrect the duplicate-id
diagnostic on every row, so keep that `entries.json` empty and rely on the
`snl.src-dangling` info notes to catch genuinely broken `x@entry-id` postfixes.

## Exit criteria

Entry authoring is complete when:

- every blueprint row has exactly one stable Entry record;
- all kinds resolve;
- all `content.snl` values parse as one tree;
- reusable concepts resolve to active macros;
- end-to-end KaTeX Preview checks pass;
- no Entry was duplicated merely for another Library;
- no future semantic-source id remains undecided.

Then continue with [`Construct_Library.md`](Construct_Library.md) and [`Index_Semantics.md`](Index_Semantics.md).
