# AGENT.md — SNL Agent Toolkit

> Read this first when you are asked to write, edit, organise, validate, or develop SNL documents and tooling.

## Purpose

This file is an **entry point**, not a complete manual.

Concrete workflows do not live here. The root-level [`Skills/`](Skills/) directory contains one self-contained document for each kind of work. Load only the guides relevant to the current task, plus any shared rules they reference.

## Operating principle

- Keep `AGENT.md` short, stable, and navigational.
- Put a concrete block of functionality or workflow in its own document under `Skills/`.
- Do not copy full procedures back into this file.
- When adding a new kind of work, add or update a Skill document and register it in [`Skills/README.md`](Skills/README.md).

## Start here

1. Identify the concrete task.
2. Open [`Skills/README.md`](Skills/README.md).
3. Read the matching task guide before editing files or running Toolkit commands.
4. If the task spans several areas, load each applicable guide; do not infer one workflow from another.
5. Validate the resulting artifacts with the repository's prescribed checks before committing.

## Routing

- Building a complete SNL document → [`Skills/document-workflow.md`](Skills/document-workflow.md)
- Drafting its construction blueprint → [`Skills/draft-document.md`](Skills/draft-document.md)
- Designing kinds and terminology → [`Skills/design-terminology.md`](Skills/design-terminology.md)
- Creating Entries or writing `content.snl` → [`Skills/author-entries.md`](Skills/author-entries.md)
- Constructing a Library → [`Skills/construct-library.md`](Skills/construct-library.md)
- Building semantic source links → [`Skills/index-semantics.md`](Skills/index-semantics.md)
- Checking SNL syntax and identity rules → [`Skills/snl-language-rules.md`](Skills/snl-language-rules.md)
- Running Toolkit CLIs → [`Skills/use-toolkit-clis.md`](Skills/use-toolkit-clis.md)
- Understanding CLI workflow or roadmap → [`Skills/toolkit-workflow-and-roadmap.md`](Skills/toolkit-workflow-and-roadmap.md)
- Developing this Toolkit → [`Skills/develop-toolkit.md`](Skills/develop-toolkit.md)

The authoritative index is [`Skills/README.md`](Skills/README.md). If this routing list and that index disagree, fix both rather than letting two structures drift.
