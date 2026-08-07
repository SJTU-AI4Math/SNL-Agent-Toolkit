# Few-shot examples

Minimal business drafts for the agent-facing write CLIs:

- `package-draft.minimal.json` → `snl-add-package`;
- `macro-draft.minimal.json` → `snl-add-macro --package Topology`;
- `entry-draft.minimal.json` → `snl-add-entry`.

These are deliberately **not** storage envelopes. The CLIs add defaults, validate
against the target workspace, compute canonical hash-derived paths, and write the
live entities. Copy a draft to a scratch location and adapt its business fields;
do not add `format`, storage `version`, or a filename.

Future larger examples may use `NNN-<topic>/` directories with source material,
drafts, expected Library graph fragments, and notes.
