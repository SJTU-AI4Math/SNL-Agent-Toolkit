# SNL Library Change Reporting

> This is the agent-readable implementation of the shared reporting contract for
> SNL library changes. `.SNL_Doc` is the specification authority; the canonical
> specification is the `Skill.Report` Entry family, and when the two disagree,
> `.SNL_Doc` wins. This reference deliberately covers **reporting only** — it is
> not a complete planning, authoring, or maintenance workflow.

A change report is needed whenever the subject of a plan, a confirmation of
intended content, or a result report is the SNL library itself: term macros,
entries, the entry tree, or the library graph. Pure operations work and pure code
changes are out of scope and do not need this format.

A report is a **human-readable semantic plan or report**. It is not an applyable
Git patch, not a machine mutation API, and not a replacement for the Toolkit CLI.
Never hand a block to someone as if it could be applied verbatim; mutations still
go through the official commands.

## Two Diff Blocks

Every report of an SNL library change carries **two diff blocks**, and both are
required:

1. the macro content block, and
2. the entry tree block.

If only one side actually changed, both blocks are still present and the unchanged
one says so (see [One-Sided Changes](#one-sided-changes)). Keep the prose outside
the blocks short: do not restate in paragraphs what the blocks already show.

### Macro Content Block

Show a macro content change as a diff, `-` for the old line and `+` for the new
line. Identify the macro by **package-qualified name**, and state its **style**
explicitly on both sides — for example `(style: default)`. Never silently change a
canonical macro name; a proposed name must be marked as proposed.

```diff
- MacroPackage::macroName => $C^\infty(#0)$    (style: default)
+ MacroPackage::macroName => %smoothness of order #0%    (style: default)
```

### Entry Tree Block

Show entry additions, deletions, renames, and moves as a diff whose indentation
carries the hierarchy. `+` adds, `-` removes, and every node is written
`FULL_ID => <kind> title`: the full Entry ID, the entry kind, and the title. On the
root line the full ID is the Library ID. A move keeps one Entry ID and changes its
parent, so it appears as a `-` under the old parent and a `+` under the new parent
with the same ID and title.

```diff
  DemoLib => <library> Demo library
  └── DemoLib.sec.Section => <sec> Section
+     ├── DemoLib.entry.New => <def> New entry    (proposed)
-     └── DemoLib.entry.Renamed => <ppt> Old title
+     └── DemoLib.entry.Renamed => <ppt> New title
```

Write each **full Entry ID**, exactly as read back from the CLI. Do not use a short
name, do not guess from a familiar abbreviation, and do not add a package prefix
the readback did not have. If an ID is new and has not been read back yet, mark it
explicitly as proposed. The IDs above are fictional demonstrations, not readback
from a real library; a real report must use real CLI readback.

## One-Sided Changes

"Both blocks, always" does not mean "both blocks must show change". When only one
side changed, keep the other block and write inside it that there is no change —
for example `macro content: no change`. A missing block reads as an omission and
makes the whole report ambiguous.

`no change` describes a whole block, not a single entity line. A brand-new entity
has no old side, so never pair its `+ ... (proposed)` line with a `- ... =>
(no change)` line; an addition has no deletion.

## Plan Versus Completion

A **plan** describes proposed state. It may contain entries and macros that do not
exist yet; each of those is a proposal, not a fact.

A **completion report** describes only what was actually written, read back, **and**
validated. Before a line enters a completion report, read the entity back through
the CLI **and** run the relevant validation, then report both results. A write whose
readback is missing, or whose relevant validation failed or was not run, is not
verified: report it explicitly as written but unverified, or as blocked. Never
present an intended change as if it were already done. Anything blocked or
deliberately not done is listed separately, never mixed into the verified changes.

## Entry ID and Macro Identity

Take every Entry ID from a real CLI readback (`snl entry get`, `snl entry list`,
`snl library get`, and so on). An ID assembled from a familiar abbreviation, or one
given an assumed package prefix, is not evidence. In the entry tree block, write
each node as `FULL_ID => <kind> title` and keep one Entry ID stable across a move.

For macros, state the package-qualified identity and the style on both sides. When a
change would rename a canonical macro name, mark the new name as proposed rather
than presenting it as already canonical.

## Examples

Three lightweight examples, one per common situation. Every ID below is a
fictional demonstration, not a readback from a real library.

### Planned Addition

A plan to add one macro and one entry. No entity exists yet, so the added lines are
marked `proposed`; both blocks are present. The new macro has no old side, so there
is no `-` line for it.

```diff
+ MacroPackage::macroName => %smoothness of order #0%    (style: default; proposed)
```

```diff
  DemoLib => <library> Demo library
  └── DemoLib.sec.Section => <sec> Section
+     └── DemoLib.entry.New => <def> New reference entry    (proposed)
```

### One-Sided Macro Revision

The macro template changed and the entry tree did not.

```diff
- MacroPackage::macroName => %smoothness of order #0%    (style: default)
+ MacroPackage::macroName => %smoothness of degree #0%    (style: default)
```

```diff
  (entry tree: no change)
```

### Directory Maintenance Move

A maintenance move changes the tree only. The Entry ID and title do not change; only
the parent does.

```diff
  (macro content: no change)
```

```diff
  DemoLib => <library> Demo library
  ├── DemoLib.sec.OldParent => <sec> Old parent
- │   └── DemoLib.entry.Moved => <def> Stable entry title
  └── DemoLib.sec.NewParent => <sec> New parent
+     └── DemoLib.entry.Moved => <def> Stable entry title
```
