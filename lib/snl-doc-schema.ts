/**
 * Vendored SNL-Doc on-disk schema types.
 *
 * Source of truth:
 *   SJTU-AI4Math/SNL-Doc-Extension, commit 78ef2f9a (2026-07-07).
 *   Files: src/snlDoc.ts, src/libraryGraph.ts.
 *
 * This file is a HAND-COPIED SUBSET of the extension's TypeScript
 * interfaces, with all `vscode`-dependent runtime code stripped. The
 * toolkit's CLIs read/write `.SNL_Doc/` using these shapes.
 *
 * Agent-facing schema reference and sync procedure:
 *   ../Skills/Basics/Json_Schema.md
 *
 * ---------------------------------------------------------------------------
 * On-disk layout (mirrored from snlDoc.ts jsdoc):
 *
 *   .SNL_Doc/
 *   ├── config.json            { version, entry_kinds, macro_kinds,
 *   │                            active_macro_packages }
 *   ├── entries.json           shared entry pool — bare JSON array of EntryData
 *   ├── relationships.json    pool-wide semantic relationships (optional)
 *   ├── term_macros/<pkg>.json macro packages (one file per package)
 *   └── libraries/<slug>/
 *       ├── meta.json          { title, description? }
 *       ├── graph.json         { nodes: GraphNode[], relationships: GraphRelationship[] }
 *       └── counters.json      { counters: CounterNode[] }
 * ---------------------------------------------------------------------------
 */

// ===========================================================================
// config.json
// ===========================================================================

/**
 * One category of Entry the user defines (e.g. "Definition", "Theorem",
 * "Example"). Stored under `config.json#entry_kinds`.
 *
 * - `id`: stable identifier used in cross-references (EntryData.kind).
 * - `name`: display name.
 * - `coloring.stroke`: any CSS colour; `''` / `'auto'` → theme foreground.
 * - `coloring.background`: `''` / `'transparent'` / `'none'` → transparent.
 * - `defaultCounterName`: name of a Library-scoped counter.
 * - `numbering`: legacy compatibility field; current writers use counters.json.
 * - `style`: free-text style hint (currently unused by the renderer).
 */
export interface EntryKind {
  id: string;
  name: string;
  coloring: { stroke: string; background: string };
  defaultCounterName?: string;
  /** Legacy pre-counter-tree compatibility field. */
  numbering?: string;
  style: string;
}

/**
 * The semantic category a macro declares via its top-level `kind` field.
 * Macro kinds carry no numbering — only palette. Stored under
 * `config.json#macro_kinds`.
 */
export interface MacroKind {
  id: string;
  name: string;
  description: string;
  coloring: { stroke: string; background: string };
}

/** Root of `.SNL_Doc/config.json`. */
export interface SnlConfig {
  version: string;
  /**
   * DEPRECATED (2026-07-06): superseded by disk-walk in listLibraries().
   * Kept as an optional field so older configs still parse.
   */
  libraries?: Array<{ slug: string; title: string }>;
  entry_kinds?: EntryKind[];
  macro_kinds?: MacroKind[];
  /**
   * Bare filenames (no `.json`) of currently-active macro packages. Missing
   * = treat every on-disk package as active (backwards-compat).
   */
  active_macro_packages?: string[];
}

// ===========================================================================
// entries.json — shared entry pool
// ===========================================================================

/**
 * One entry in the shared pool. `id` is the primary key; graph nodes point
 * at entries via `props.entryId`.
 *
 * `content` is a discriminated bag of source dialects — SNL is the
 * canonical one; the others (typst / latex / markdown / text) are optional
 * mirror/export surfaces.
 *
 * `contribution_info` and `pointer` are typed `unknown` because the
 * extension leaves their shape open for downstream consumers. Toolkits
 * should pass them through untouched on read/write.
 */
export interface EntryData {
  id: string;
  kind: string;
  title: string;
  content: {
    snl?: string;
    typst?: string;
    latex?: string;
    markdown?: string;
    text?: string;
  };
  contribution_info: unknown;
  pointer: unknown;
}

// ===========================================================================
// libraries/<slug>/meta.json
// ===========================================================================

export interface LibraryMetaFile {
  title?: string;
  description?: string;
}

// ===========================================================================
// libraries/<slug>/graph.json — Library Graph v2
// (mirrors src/libraryGraph.ts)
// ===========================================================================

/** The only Node label v2 understands; others survive read-only w/ warning. */
export type NodeLabel = 'Entry';

/** The only relationship label v2 understands; others ignored w/ warning. */
export type RelLabel = 'branch';

export interface GraphNode {
  /** Unique WITHIN this library — a local handle, not the shared pool id. */
  id: string;
  /** Loose-typed so unknown labels can be detected & warned. */
  label: string;
  props: {
    /**
     * Optional — unset = placeholder node. Set = reference into
     * entries.json's shared pool.
     */
    entryId?: string;
    [key: string]: unknown;
  };
}

export interface GraphRelationship {
  from: string;
  to: string;
  /** Loose-typed so unknown labels can be detected & warned. */
  label: string;
}

/** Root of `libraries/<slug>/graph.json`. */
export interface LibraryGraph {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

// ===========================================================================
// term_macros/<pkg>.json — Macro v7 (SNL-Basics 0.10.0)
// ===========================================================================

/**
 * Macro v7 is owned by SNL-Basics. Re-export its canonical runtime types and
 * migration functions rather than maintaining a second, drifting schema.
 */
export type {
  SnlMacro,
  SnlMacroSource,
  SnlMacroStyle,
} from '../external/SNL-Basics/src/snl-macro/types.ts';
export type {
  MacroStyleV6,
  MacroV6,
} from '../external/SNL-Basics/src/schema/migrate-macro.ts';
export {
  isMacroDocumentV7,
  migrateMacroDocument,
  migrateMacroV6toV7,
  migrateStyleV6toV7,
} from '../external/SNL-Basics/src/schema/migrate-macro.ts';

import type {
  SnlMacro,
  SnlMacroStyle,
} from '../external/SNL-Basics/src/snl-macro/types.ts';

/** Consumer-owned output backends preserved by Toolkit package operations. */
export interface MacroPackageOutputBackends {
  typst?: {
    built_in: string;
    synthesis: { mode: 'formula' | 'text'; macro: string };
  };
  latex?: {
    built_in: string;
    synthesis: { mode: 'formula' | 'text'; macro: string };
  };
  markdown?: string;
  text?: string;
}

/** Canonical SNL-Basics v7 style plus Toolkit-preserved output backends. */
export type MacroPackageStyle = SnlMacroStyle & MacroPackageOutputBackends;

/** Canonical SNL-Basics v7 macro with backend-extended styles. */
export type MacroPackageEntry = Omit<SnlMacro, 'styles'> & {
  styles: MacroPackageStyle[];
};

/** MacroPackageEntry without redundant `name` (the name is the map key). */
export type MacroPackageEntryWithoutName = Omit<MacroPackageEntry, 'name'>;

/** Root of `.SNL_Doc/term_macros/<pkg>.json`. */
export interface MacroPackageFile {
  version: string;
  name: string;
  description?: string;
  /** key = macro.name; the on-disk value omits the redundant name field. */
  macros: Record<string, MacroPackageEntryWithoutName>;
}

/** Safe package-shape adapter around SNL-Basics's flat-record v6→v7 migration. */
export { migrateMacroPackageV6toV7 } from './migrate-macro-package.ts';
export type {
  MacroPackageEntryV6WithoutName,
  MacroPackageFileV6,
  MacroPackageStyleV6,
} from './migrate-macro-package.ts';
