# Author

`.SNL_Doc` owns the specification. This skill is not yet a complete authoring
workflow; the only materialized routine is SNL library change reporting.

## Change Reporting

When authored changes touch an SNL library, report them with the shared
[SNL Library Change Reporting](../Report/SKILL.md) reference. The macro content
block and the entry tree block are both required, and every Entry ID comes from a
real CLI readback. A plan is proposed state; a completion report contains only
what was read back after writing.

The canonical specification is the `Skill.Report` Entry family in `.SNL_Doc`.
