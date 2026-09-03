# SNL Authoring TODO

This file tracks authoring requirements and deferred design work that are not yet fully settled in the shipped Skills or in existing SNL libraries.

## Open design work

- [ ] Audit the Entry ID and Macro ID naming of the foundational linear-algebra slice. Check kind-segment agreement, namespace shape, semantic lifetime, and whether notation identities should be renamed before wider reuse.
- [ ] Continue small visual and wording refinements after the foundational linear-algebra presentation is accepted; keep each follow-up narrow and verify its rendered effect.

## Accepted authoring requirements

These requirements are documented in `Skills/RefineNL2SNL/SKILL.md` and must remain covered there:

- [x] Write Greek letters as TeX formula tokens such as `$\alpha$`; bare `alpha` is not automatically rendered as `α`.
- [x] Prefer conventional mathematical notation such as `[n]` for a finite index set when it reads better than `Fin(n)`.
- [x] Preserve project conventions such as a blackboard-bold field symbol `$\mathbb{K}$`.
- [x] Give operations dedicated binary Macros; do not model Lean-style operator arguments with templates such as `#1 #0 #2`.
- [x] Use a newline-separated, enumerate-backed dynamic block Macro as the root of multiline Context Entries.
- [x] Keep Contexts limited to shared declarations; bind one-off variables locally to avoid repeated irrelevant hypotheses.
- [x] Keep semantic predicate Macros compact instead of spelling every implicit ambient parameter in display text.
- [x] Prefer symbolic equality with a dedicated zero Macro over a redundant prose-only zero-vector predicate Macro.
- [x] Treat Library Counters as required authoring work: define the Counter tree, assign resolvable `counterId` values, and verify the numbered tree.

## Maintenance rule

When author feedback changes an accepted SNL authoring convention, update both this ledger and the owning shipped Skill in the same commit. Keep unresolved policy questions in the open section rather than silently choosing an identity or schema convention.
