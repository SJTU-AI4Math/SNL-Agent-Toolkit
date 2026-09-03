import { assertSafeKindName } from '@sjtu-ai4math/snl-basics';
import fulcrumMathNotes from './init-preset-packages/fulcrum-math-notes.json' with { type: 'json' };
import lean4Document from './init-preset-packages/lean4-document.json' with { type: 'json' };
import react from './init-preset-packages/react.json' with { type: 'json' };
import {
  CURRENT_MACRO_SCHEMA_VERSION,
  CURRENT_PACKAGE_SCHEMA_VERSION,
  MACRO_STORAGE_VERSION,
  PACKAGE_STORAGE_VERSION,
  UNPACKAGED_PACKAGE_ID,
  macroEntityPath,
  makeEntityStorageReceipt,
  packageManifestPath,
  type MacroEnvelope,
  type PackageManifest,
} from './entity-storage.ts';

const i18n = (en: string, zhCN: string) => ({
  type: 'i18n' as const,
  default_language: 'en',
  values: { en, 'zh-CN': zhCN },
});
const coloring = (lightStroke: string, lightBackground: string, darkStroke: string, darkBackground = '#313131') => ({
  light: { stroke: lightStroke, background: lightBackground },
  dark: { stroke: darkStroke, background: darkBackground },
});

export const DEFAULT_ENTRY_KINDS = Object.freeze([
  {
    id: 'section', name: i18n('Section', '节'),
    description: i18n('A section that organizes related entries.', '用于组织相关条目的章节。'),
    coloring: coloring('#475569', '#F1F5F9', '#CBD5E1'),
    defaultCounterName: 'section', style: 'section',
  },
  {
    id: 'subsection', name: i18n('Subsection', '小节'),
    description: i18n('A subsection within a section.', '章节中的子章节。'),
    coloring: coloring('#64748B', '#F8FAFC', '#94A3B8'),
    defaultCounterName: 'subsection', style: 'section',
  },
  {
    id: 'entry', name: i18n('Entry', '条目'),
    description: i18n('A general SNL entry.', '通用 SNL 条目。'),
    coloring: coloring('#0369A1', '#E0F2FE', '#7DD3FC'),
    defaultCounterName: 'entry', style: '',
  },
]);

export const DEFAULT_MACRO_KINDS = Object.freeze([
  {
    id: 'fvar', name: 'Free variable', description: 'Free variables not defined by an active Macro Package.',
    coloring: coloring('#B0001C', '#FFD6DC', '#FB7185'),
  },
  {
    id: 'binder', name: 'Binder', description: 'Binding sites such as quantified variables and lambda parameters.',
    coloring: coloring('#0E7490', '#CFFAFE', '#67E8F9'),
  },
  {
    id: 'const', name: 'Const', description: 'Constants and defined terms.',
    coloring: coloring('#005B9C', '#DAF0FF', '#60A5FA'),
  },
  {
    id: 'bvar', name: 'Bound variable', description: 'Bound-variable occurrences.',
    coloring: coloring('#7700E4', '#EFDFFF', '#C084FC'),
  },
  {
    id: 'sub', name: 'Sub', description: 'Structural helper subtree that is not a complete syntactic node.',
    coloring: {
      light: { stroke: 'inherit', background: 'transparent' },
      dark: { stroke: 'inherit', background: 'transparent' },
    },
  },
]);

const synthesis = () => ({ mode: 'formula', macro: '' });
function template(
  mode: 'text' | 'block' | 'formula_display',
  body: string,
  options: { separator?: string; block_template_name?: string; markdown?: string } = {},
) {
  return {
    mode,
    body,
    ...(options.separator === undefined ? {} : { separator: options.separator }),
    ...(options.block_template_name === undefined ? {} : { block_template_name: options.block_template_name }),
    typst: { built_in: '', synthesis: synthesis() },
    latex: { built_in: '', synthesis: synthesis() },
    markdown: options.markdown ?? '',
    text: '',
  };
}
function style(styleName: string, value: ReturnType<typeof template>) {
  return { style_name: styleName, tags: [], template: value };
}
function macro(
  name: string,
  dynamicArity: boolean,
  styles: ReturnType<typeof style>[],
  description: string,
) {
  return {
    description,
    source: { entries: [], urls: [] },
    kind: 'sub',
    dynamic_arity: dynamicArity,
    styles,
    tags: [],
    name,
  };
}

export const DEFAULT_MACROS = Object.freeze([
  macro('__enum__', true, [
    style('num', template('block', '#*', { separator: '', block_template_name: 'enumerate' })),
    style('dot', template('block', '#*', { separator: '', block_template_name: 'list' })),
  ], 'Ordered list; the dot style renders an unordered list.'),
  macro('__list__', true, [
    style('default', template('text', '#*', { separator: ', ' })),
  ], 'Inline comma-separated list.'),
  macro('__table__', true, [
    style('default', template('block', '#*', { separator: '', block_template_name: 'table' })),
  ], 'Table container.'),
  macro('__row__', true, [
    style('default', template('block', '#*', { separator: '' })),
  ], 'Table row.'),
  macro('__center__', false, [
    style('default', template('block', '#0', { block_template_name: 'centered' })),
  ], 'Centered block.'),
  macro('__right__', false, [
    style('default', template('block', '#0', { block_template_name: 'right' })),
  ], 'Right-aligned block.'),
  macro('__display__', false, [
    style('default', template('formula_display', '#0', { markdown: '$$#0$$' })),
  ], 'Promote one formula to display mode.'),
]);

export const BASIC_MACROS_PACKAGE_ID = 'BasicMacros';

export function defaultPackageManifests(): Array<{ relativePath: string; value: PackageManifest }> {
  return [
    {
      relativePath: packageManifestPath(UNPACKAGED_PACKAGE_ID),
      value: {
        format: 'snl-package', version: PACKAGE_STORAGE_VERSION,
        schema_version: CURRENT_PACKAGE_SCHEMA_VERSION,
        id: UNPACKAGED_PACKAGE_ID, name: 'Unpackaged', description: '', entry_ids: [],
      },
    },
    {
      relativePath: packageManifestPath(BASIC_MACROS_PACKAGE_ID),
      value: {
        format: 'snl-package', version: PACKAGE_STORAGE_VERSION,
        schema_version: CURRENT_PACKAGE_SCHEMA_VERSION,
        id: BASIC_MACROS_PACKAGE_ID, name: 'Basic Macros',
        description: 'Markdown-native structural macros installed by snl init.', entry_ids: [],
      },
    },
  ];
}

export function defaultMacroEnvelopes(): Array<{ relativePath: string; value: MacroEnvelope }> {
  return DEFAULT_MACROS.map(value => ({
    relativePath: macroEntityPath(BASIC_MACROS_PACKAGE_ID, value.name),
    value: {
      format: 'snl-macro', version: MACRO_STORAGE_VERSION,
      schema_version: CURRENT_MACRO_SCHEMA_VERSION,
      package: BASIC_MACROS_PACKAGE_ID,
      macro: value,
    },
  }));
}

export interface InitPresetPackage {
  schema: 'snl.init-preset';
  version: 1;
  id: string;
  entryKinds: Array<Record<string, unknown>>;
  macroKinds: Array<Record<string, unknown>>;
  packages: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
  macros: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
  libraries: Array<Record<string, unknown>>;
}

const PRESET_KEYS = [
  'schema', 'version', 'id', 'entryKinds', 'macroKinds', 'packages',
  'entries', 'macros', 'relationships', 'libraries',
] as const;
const ARRAY_KEYS = [
  'entryKinds', 'macroKinds', 'packages', 'entries', 'macros', 'relationships', 'libraries',
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniqueBy(values: Array<Record<string, unknown>>, identity: (value: Record<string, unknown>) => string, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = identity(value);
    if (!id || seen.has(id)) throw new TypeError(`${label} contains an empty or duplicate identity ${JSON.stringify(id)}.`);
    seen.add(id);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertCanonicalPresetId(id: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new TypeError('Preset id must be canonical lower-kebab-case.');
  }
}

function assertValidLocalizedField(value: unknown, label: string): void {
  if (typeof value === 'string') return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a string or I18N map.`);
  }
  const record = value as Record<string, unknown>;
  if (record.type !== 'i18n' || typeof record.default_language !== 'string' || !record.default_language ||
      !record.values || typeof record.values !== 'object' || Array.isArray(record.values)) {
    throw new TypeError(`${label} must be a valid I18N map.`);
  }
  const values = record.values as Record<string, unknown>;
  if (typeof values[record.default_language] !== 'string' || !(values[record.default_language] as string)) {
    throw new TypeError(`${label} must define a non-empty value for default_language.`);
  }
  for (const [language, text] of Object.entries(values)) {
    if (!language || typeof text !== 'string' || !text) {
      throw new TypeError(`${label} I18N values must use non-empty language keys and text.`);
    }
  }
}

function assertPresetKinds(preset: InitPresetPackage): void {
  for (const [family, items] of [['Entry', preset.entryKinds], ['Macro', preset.macroKinds]] as const) {
    for (const item of items) {
      if (typeof item.id !== 'string') throw new TypeError(`${family} Kind requires a string id.`);
      const id = item.id;
      try { assertSafeKindName(id); }
      catch (error) { throw new TypeError(`${family} Kind id ${JSON.stringify(id)} is invalid: ${error instanceof Error ? error.message : String(error)}`); }
      assertValidLocalizedField(item.name, `${family} Kind ${JSON.stringify(id)} name`);
      if (Object.hasOwn(item, 'description')) {
        assertValidLocalizedField(item.description, `${family} Kind ${JSON.stringify(id)} description`);
      }
    }
  }
}

function assertPackageMembership(preset: InitPresetPackage): void {
  const expectedByPackage = new Map<string, string[]>();
  for (const entry of preset.entries) {
    const pkg = typeof entry.package === 'string' ? entry.package : '';
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (pkg && id) expectedByPackage.set(pkg, [...(expectedByPackage.get(pkg) ?? []), id]);
  }
  for (const pkg of preset.packages) {
    if (typeof pkg.id !== 'string' || !pkg.id) throw new TypeError('Package requires a non-empty string id.');
    const packageId = pkg.id;
    if (!Object.hasOwn(pkg, 'entry_ids')) continue;
    if (!Array.isArray(pkg.entry_ids) || pkg.entry_ids.some(id => typeof id !== 'string' || !id)) {
      throw new TypeError(`Package ${JSON.stringify(packageId)} entry_ids must be an array of non-empty strings.`);
    }
    const declared = [...pkg.entry_ids].sort();
    const expected = [...(expectedByPackage.get(packageId) ?? [])].sort();
    if (new Set(declared).size !== declared.length || JSON.stringify(declared) !== JSON.stringify(expected)) {
      throw new TypeError(`Package ${JSON.stringify(packageId)} entry_ids must exactly match its preset Entries.`);
    }
  }
}

export function normalizeInitPreset(value: unknown): InitPresetPackage {
  if (!record(value)) throw new TypeError('Init Preset Package must be an object.');
  const unknown = Object.keys(value).filter(key => !(PRESET_KEYS as readonly string[]).includes(key));
  if (unknown.length) throw new TypeError(`Init Preset Package has unknown key(s): ${unknown.join(', ')}.`);
  if (value.schema !== 'snl.init-preset' || value.version !== 1 || typeof value.id !== 'string' || !value.id.trim() || value.id !== value.id.trim()) {
    throw new TypeError('Init Preset Package requires schema snl.init-preset, version 1, and a canonical non-empty id.');
  }
  const normalized: Record<string, unknown> = { schema: value.schema, version: value.version, id: value.id };
  for (const key of ARRAY_KEYS) {
    const items = value[key] ?? [];
    if (!Array.isArray(items) || items.some(item => !record(item))) throw new TypeError(`${key} must be an array of objects.`);
    normalized[key] = structuredClone(items);
  }
  const preset = normalized as unknown as InitPresetPackage;
  assertCanonicalPresetId(preset.id);
  uniqueBy(preset.entryKinds, item => typeof item.id === 'string' ? item.id : '', 'entryKinds');
  uniqueBy(preset.macroKinds, item => typeof item.id === 'string' ? item.id : '', 'macroKinds');
  uniqueBy(preset.packages, item => typeof item.id === 'string' ? item.id : '', 'packages');
  uniqueBy(preset.entries, item => typeof item.id === 'string' ? item.id : '', 'entries');
  uniqueBy(preset.macros, item => typeof item.package === 'string' && typeof item.name === 'string' ? `${item.package}\0${item.name}` : '', 'macros');
  uniqueBy(preset.relationships, item => typeof item.id === 'string' ? item.id : '', 'relationships');
  uniqueBy(preset.libraries, item => typeof item.slug === 'string' ? item.slug : '', 'libraries');
  if (preset.macroKinds.some(item => item.id === 'partial' || item.name === 'Partial') ||
      preset.macros.some(item => item.kind === 'partial')) {
    throw new TypeError('partial is obsolete; use the sub Macro Kind and Sub label.');
  }
  const canonicalMacroKinds = new Map(
    DEFAULT_MACRO_KINDS.map(item => [item.id, stableJson(item)]),
  );
  for (const kind of preset.macroKinds) {
    const canonical = typeof kind.id === 'string' ? canonicalMacroKinds.get(kind.id) : undefined;
    if (canonical !== undefined && stableJson(kind) !== canonical) {
      throw new TypeError(`Default Macro Kind ${JSON.stringify(kind.id)} is reserved and cannot be overridden by a preset.`);
    }
  }
  assertPresetKinds(preset);
  assertPackageMembership(preset);
  return preset;
}

export const BUILTIN_INIT_PRESET_DESCRIPTORS = Object.freeze([
  { id: 'fulcrum-math-notes', label: "Fulcrum's Math Notes" },
  { id: 'lean4-document', label: 'Lean 4 documentation' },
  { id: 'react', label: 'React' },
]);

export const BUILTIN_INIT_PRESETS: ReadonlyMap<string, InitPresetPackage> = new Map(
  [fulcrumMathNotes, lean4Document, react]
    .map(value => {
      const preset = normalizeInitPreset(value);
      return [preset.id, preset] as const;
    }),
);

function overlayById(
  base: ReadonlyArray<Record<string, unknown>>,
  overlay: ReadonlyArray<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const byId = new Map(base.map(value => [String(value.id), structuredClone(value)]));
  for (const value of overlay) byId.set(String(value.id), structuredClone(value));
  return [...byId.values()];
}

export function defaultConfig(preset?: InitPresetPackage) {
  return {
    version: '0.1.0',
    entry_kinds: overlayById(DEFAULT_ENTRY_KINDS, preset?.entryKinds ?? []),
    macro_kinds: overlayById(DEFAULT_MACRO_KINDS, preset?.macroKinds ?? []),
    active_macro_packages: [BASIC_MACROS_PACKAGE_ID],
    entity_storage: {
      version: 1,
      legacy_backup_version: '0.0.5',
      entry_default_package: UNPACKAGED_PACKAGE_ID,
      receipt: makeEntityStorageReceipt(null, new Map(), false),
    },
  };
}
