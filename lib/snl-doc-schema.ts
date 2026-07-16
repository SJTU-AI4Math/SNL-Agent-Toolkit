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
// term_macros/<pkg>.json — macro packages
// ===========================================================================

/**
 * One render style for a macro. A macro carries an ordered `styles[]`;
 * `styles[0]` is the implicit default used when SNL source omits `[tag]`.
 *
 * `mode` (v3): 4 flat values, replacing the old {mode, display?} pair.
 *   - `formula_inline`  — inline math
 *   - `formula_display` — display math
 *   - `text`            — inline text
 *   - `block`           — block-level container
 */
export interface MacroPackageStyle {
  /** Style tag — the token used in `\foo[tag](...)`. Unique per macro. */
  tag: string;
  mode: 'formula_inline' | 'formula_display' | 'text' | 'block';
  /**
   * The rendering template (KaTeX / plain-text / etc.). Uses `#N` for
   * positional children and `#*` for variadic children (only valid when
   * the parent macro has `dynamic_arity: true`).
   */
  template: string;
  /** Left delimiter for `#*` — ignored when the macro isn't dynamic_arity. */
  variadic_left?: string;
  /** Separator between `#*` children. Default: ', ' (formula), '' (text). */
  variadic_join?: string;
  /** Right delimiter for `#*` — ignored when the macro isn't dynamic_arity. */
  variadic_right?: string;
  react_renderer_key?: string;
  /** Free-text labels attached to this style (backslash forbidden). */
  tags?: string[];
  // Consumer-owned output backends (optional per style):
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

/**
 * One macro definition inside a package. The `name` field is redundant with
 * the package-map key on disk; see {@link MacroPackageEntryWithoutName}.
 */
export interface MacroPackageEntry {
  name: string;
  description: string;
  source: { entries: string[]; urls: string[] };
  /** Semantic kind (optional). Unset → rendered nodes default to `fvar`. */
  kind?: string;
  /**
   * True when the macro's child count is not fixed. Requires the default
   * template to contain `#*`.
   */
  dynamic_arity: boolean;
  /** Ordered; `styles[0]` is the default. Tags must be unique. */
  styles: MacroPackageStyle[];
  /** Free-text labels attached to the macro itself (backslash forbidden). */
  tags?: string[];
}

/** MacroPackageEntry without redundant `name` (the name is the map key). */
export type MacroPackageEntryWithoutName = Omit<MacroPackageEntry, 'name'>;

/** Root of `.SNL_Doc/term_macros/<pkg>.json`. */
export interface MacroPackageFile {
  version: string;
  name: string;
  description?: string;
  /** key = macro.name */
  macros: Record<string, MacroPackageEntryWithoutName>;
}
