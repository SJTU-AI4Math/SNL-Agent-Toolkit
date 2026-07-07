# SNL syntax primer

_Placeholder — micro-reference for the SNL surface syntax an agent needs to
generate. To be filled in the next iteration._

Rough outline of what will go here:

- Tokens & escaping
- `\macro` invocation, `[style]` variant, `(child, child, ...)` children, `#*`
  variadic children
- Formula vs text vs block modes (from `MacroPackageStyle.mode`)
- Round-trip examples: raw prose → SNL source → rendered output
- Common pitfalls (whitespace-sensitive spots, escaping backslashes in JSON, etc.)

For the authoritative spec see the [SNL-Basics](https://github.com/SJTU-AI4Math/SNL_Basics)
repo. This primer is a distilled subset aimed at agents who just need enough to
emit valid content.
