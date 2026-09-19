# Plan

`.SNL_Doc` owns the specification. This skill is not yet a complete planning
workflow; the only materialized routine is SNL library change reporting.

## Change Reporting

When a plan concerns an SNL library change — macros, entries, the entry tree, or
the library graph — report it with the shared
[SNL Library Change Reporting](../Report/SKILL.md) reference: two diff blocks
(macro content and entry tree), full real Entry IDs, and an explicit one-sided
"no change" when only one side moves.

A plan is proposed state. Anything not yet read back from the CLI is marked as
proposed, not stated as fact.

The canonical specification is the `Skill.Report` Entry family in `.SNL_Doc`.
