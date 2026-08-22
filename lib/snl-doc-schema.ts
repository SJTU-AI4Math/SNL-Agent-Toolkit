/**
 * Vendored SNL-Doc on-disk schema types.
 *
 * Source of truth:
 *   SJTU-AI4Math/SNL-Doc-Extension per-entity storage v1.
 *   Files: src/entityStorage.ts, src/entityStorageIo.ts, src/snlDoc.ts,
 *   src/libraryGraph.ts.
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
 *   ├── config.json            { version, entity_storage, entry_kinds,
 *   │                            macro_kinds, active_macro_packages }
 *   ├── packages/*.json        one Package manifest per stable Package id
 *   ├── entries/*.json         one Entry envelope per stable identity
 *   ├── macros/*.json          one Macro envelope per (Package, name)
 *   ├── relationships.json    pool-wide semantic relationships (optional)
 *   ├── entries.json           frozen pre-entity migration backup (optional)
 *   ├── term_macros/*.json     frozen pre-entity migration backups (optional)
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
  name: LocalizedString;
  description?: LocalizedString;
  coloring: ThemedColoring | LegacyColoring;
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
  coloring: ThemedColoring | LegacyColoring;
}

export interface LegacyColoring {
  stroke: string;
  background: string;
  [key: string]: unknown;
}

export interface ThemedColoring {
  light: { stroke: string; background: string; [key: string]: unknown };
  dark: { stroke: string; background: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Root of `.SNL_Doc/config.json`. */
export interface SnlConfig {
  version: string;
  entity_storage?: {
    version: 1;
    legacy_backup_version?: string;
    entry_default_package?: string;
    receipt?: unknown;
  };
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
// entries/*.json — inner Entry payload
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
export interface I18nString {
  type: 'i18n';
  default_language: string;
  values: Record<string, string>;
}

export type LocalizedString = string | I18nString;

export interface I18n<TLanguage extends string, TValue> {
  type: 'i18n';
  default_language: TLanguage;
  values: Partial<Record<TLanguage, TValue>>;
}

export interface EntryData {
  id: string;
  /** Immutable Package identity in per-entity storage. */
  package?: string;
  kind: string;
  title: LocalizedString;
  content: {
    snl?: string;
    typst?: LocalizedString;
    latex?: LocalizedString;
    markdown?: LocalizedString;
    text?: LocalizedString;
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
     * the live shared Entry entity pool.
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

/** One node in a Library-scoped counter hierarchy. */
export interface CounterNode {
  id: string;
  name: string;
  numbering: string;
  children: CounterNode[];
}

export interface LibraryCountersFile {
  counters: CounterNode[];
}

// ===========================================================================
// macros/*.json — inner Macro payload and synthetic Package compatibility view
// ===========================================================================

/** Macro v11 is owned by SNL-Basics 0.2.4. */
export interface SnlMacroSource {
  entries: string[];
  urls: string[];
}

export interface SnlMacroTemplate {
  [key: string]: unknown;
  mode: 'formula_inline' | 'formula_display' | 'text' | 'block';
  body: string;
  separator?: string;
  block_template_name?: string;
}

export interface SnlMacroStyle {
  style_name: string;
  tags: string[];
  template: SnlMacroTemplate | I18n<string, SnlMacroTemplate>;
}

export interface SnlMacro {
  name: string;
  description: string;
  source: SnlMacroSource;
  kind: string;
  dynamic_arity: boolean;
  styles: SnlMacroStyle[];
  tags: string[];
}

export type {
  MacroStyleV6,
  MacroV6,
} from '@sjtu-ai4math/snl-basics';
export {
  isMacroDocumentV7,
  isMacroDocumentV8,
  migrateMacroDocument,
  migrateMacroV6toV7,
  migrateMacroV7toV8,
  migrateStyleV6toV7,
} from '@sjtu-ai4math/snl-basics';

/** Consumer-owned output backends accepted inside Macro v11 templates. */
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

/** Compatibility style accepted from legacy Macro v8 and current Macro v11 workspaces. */
export interface MacroPackageStyle {
  style_name: string;
  tags: string[];
  template: string | SnlMacroTemplate | I18n<string, SnlMacroTemplate>;
  mode?: SnlMacroTemplate['mode'];
  separator?: string;
  block_template_name?: string;
  typst?: MacroPackageOutputBackends['typst'];
  latex?: MacroPackageOutputBackends['latex'];
  markdown?: string;
  text?: string;
}

/** Compatibility Macro view returned by Toolkit readers. */
export interface MacroPackageEntry {
  name: string;
  description: string;
  source: SnlMacroSource;
  kind?: string;
  dynamic_arity: boolean;
  default_style?: Record<string, string>;
  styles: MacroPackageStyle[];
  tags: string[];
}

/** MacroPackageEntry without redundant `name` (the name is the map key). */
export type MacroPackageEntryWithoutName = Omit<MacroPackageEntry, 'name'>;

/** Synthetic Package view assembled from one manifest plus Macro entities. */
export interface MacroPackageFile {
  version: string;
  name: string;
  description?: string;
  /** key = macro.name; the on-disk value omits the redundant name field. */
  macros: Record<string, MacroPackageEntryWithoutName>;
}

export function isMacroDocumentV11(value: unknown): value is Record<string, SnlMacro> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((macro) => {
    if (!isRecord(macro) || typeof macro.name !== 'string' ||
        typeof macro.description !== 'string' || typeof macro.kind !== 'string' ||
        !macro.kind || macro.kind === 'partial' || typeof macro.dynamic_arity !== 'boolean' ||
        !isRecord(macro.source) || !isStringArray(macro.source.entries) ||
        !isStringArray(macro.source.urls) || !isStringArray(macro.tags) ||
        macro.tags.some((tag) => tag.includes('\\')) ||
        Object.hasOwn(macro, 'default_style') || !Array.isArray(macro.styles) ||
        macro.styles.length === 0) {
      return false;
    }
    const names = new Set<string>();
    return macro.styles.every((style) => {
      if (!isRecord(style) || typeof style.style_name !== 'string' ||
          !/^[A-Za-z_][A-Za-z0-9_]*$/.test(style.style_name) ||
          names.has(style.style_name) || !isStringArray(style.tags) ||
          style.tags.some((tag) => tag.includes('\\')) ||
          Object.keys(style).some((field) => !['style_name', 'tags', 'template'].includes(field))) {
        return false;
      }
      names.add(style.style_name);
      const projections = macroV11TemplateProjections(style.template);
      if (!projections?.length) return false;
      const contracts = new Set(projections.map((projection) => {
        const placeholders = analyzePlaceholders(projection.body);
        return `${placeholders.variadic ? 'dynamic' : 'fixed'}:${placeholders.arity}`;
      }));
      return contracts.size === 1 && projections.every((projection) => {
        const placeholders = analyzePlaceholders(projection.body);
        return !placeholders.invalid && placeholders.variadic === macro.dynamic_arity;
      });
    });
  });
}

export function macroV11TemplateProjections(value: unknown): SnlMacroTemplate[] | null {
  if (isTemplate(value)) return [value];
  if (!isRecord(value) || value.type !== 'i18n' ||
      typeof value.default_language !== 'string' || !value.default_language ||
      !isRecord(value.values) || !Object.hasOwn(value.values, value.default_language) ||
      Object.keys(value).some((field) => !['type', 'default_language', 'values'].includes(field))) {
    return null;
  }
  const projections = Object.values(value.values);
  return projections.length > 0 && projections.every(isTemplate)
    ? projections as SnlMacroTemplate[]
    : null;
}

function isTemplate(value: unknown): value is SnlMacroTemplate {
  if (!isRecord(value) || Object.hasOwn(value, 'type') ||
      !['formula_inline', 'formula_display', 'text', 'block'].includes(String(value.mode)) ||
      typeof value.body !== 'string' ||
      (value.mode !== 'block' && !value.body.trim()) ||
      (value.separator !== undefined && typeof value.separator !== 'string')) {
    return false;
  }
  return value.block_template_name === undefined ||
    (value.mode === 'block' && typeof value.block_template_name === 'string');
}

function analyzePlaceholders(body: string): { variadic: boolean; arity: number; invalid: boolean } {
  let variadic = false;
  let max = -1;
  let invalid = false;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== '#' || (index > 0 && body[index - 1] === '\\')) continue;
    const next = body[index + 1];
    if (next === '*') {
      variadic = true;
      index += 1;
    } else if (next !== undefined && /\d/.test(next)) {
      let end = index + 2;
      while (end < body.length && /\d/.test(body[end])) end += 1;
      const digits = body.slice(index + 1, end);
      if (/^(?:0|[1-9]\d?)$/.test(digits)) max = Math.max(max, Number(digits));
      else invalid = true;
      index = end - 1;
    } else {
      invalid = true;
    }
  }
  return { variadic, arity: max + 1, invalid };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Safe package-shape adapter around SNL-Basics's canonical v6→v7→v8 migration. */
export { migrateMacroPackageV6toV8, migrateMacroPackageV6toV7 } from './migrate-macro-package.ts';
export type {
  MacroPackageEntryV6WithoutName,
  MacroPackageFileV6,
  MacroPackageStyleV6,
} from './migrate-macro-package.ts';
