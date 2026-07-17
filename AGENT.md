# AGENT.md — SNL Agent Toolkit

> Entry point for agents working with SNL documents or this Toolkit.

## Principle

`AGENT.md` is navigation, not a manual. Concrete knowledge and workflows live in [`Skills/`](Skills/) folder.

## Start

1. Identify whether the task is reading, building, or maintaining an SNL Library.
2. Load the relevant foundational references from [`Skills/Basics/`](Skills/Basics/README.md).
3. Load the matching HowTo guide.
4. Follow that guide's validation steps before committing.

## Rules (IMPORTANT)

1. Always read json schema in [`Skills/Basics/Json_Schema.md`](Skills/Basics/Json_Schema.md) before editing json files.
2. Always refer to syntax guide in [`Skills/Basics/SNL_Macro.md`](Skills/Basics/SNL_Macro.md) and [`Skills/Basics/SNL_DSL.md`](Skills/Basics/SNL_DSL.md) when editing SNL Macros and SNL DSL strings.
3. Always run linting tools in [`CLI_Scripts/`](CLI_Scripts/) to check for data validity before committing. If any data is corrupted, fix it.

## Routing

- SNL Macro syntax, styles, templates, and arity → [`Skills/Basics/SNL_Macro.md`](Skills/Basics/SNL_Macro.md)
- SNL DSL grammar and `content.snl` → [`Skills/Basics/SNL_DSL.md`](Skills/Basics/SNL_DSL.md)
- `.SNL_Doc` JSON file shapes → [`Skills/Basics/Json_Schema.md`](Skills/Basics/Json_Schema.md)
- Inspect an existing Library → [`Skills/HowToRead/`](Skills/HowToRead/README.md)
- Build a large NL → SNL Library → [`Skills/HowToBuild/`](Skills/HowToBuild/README.md)
- Modify or optimize an existing Library → [`Skills/HowToMaintain/`](Skills/HowToMaintain/README.md)

The authoritative full index is [`Skills/README.md`](Skills/README.md). Add concrete instructions there, not here.
