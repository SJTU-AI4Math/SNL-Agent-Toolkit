/**
 * Adapt an on-disk Toolkit macro package from Macro v6 to current v8.
 *
 * SNL-Basics migrates a flat `Record<string, MacroV6>` whose values contain
 * `name`. Toolkit package files instead store the macro identity only as the
 * `macros` map key. This adapter restores that key as a transient `name`, runs
 * the canonical Basics migration, then removes the redundant name again.
 * Package metadata and non-schema extension fields are preserved; the wrapper
 * version becomes `8`.
 */
import {
  migrateMacroV6toV7,
  migrateMacroV7toV8,
  type MacroStyleV6,
  type MacroV6,
} from '../external/SNL-Basics/src/schema/migrate-macro.ts';
import type {
  MacroPackageEntryWithoutName,
  MacroPackageFile,
  MacroPackageOutputBackends,
} from './snl-doc-schema.ts';

export type MacroPackageStyleV6 = MacroStyleV6 & MacroPackageOutputBackends & Record<string, unknown>;
export type MacroPackageEntryV6WithoutName = Omit<MacroV6, 'name' | 'styles'> & {
  /** A stale redundant name is ignored; the package map key is authoritative. */
  name?: string;
  styles: MacroPackageStyleV6[];
  [key: string]: unknown;
};
export interface MacroPackageFileV6 {
  version: string;
  name: string;
  description?: string;
  macros: Record<string, MacroPackageEntryV6WithoutName>;
  [key: string]: unknown;
}

export function migrateMacroPackageV6toV8(raw: unknown): MacroPackageFile {
  if (!isRecord(raw)) throw new TypeError('macro package must be an object');
  if (!isRecord(raw.macros)) throw new TypeError('macro package macros must be an object map');

  const macros: Record<string, MacroPackageEntryWithoutName> = {};
  for (const [mapName, rawMacro] of Object.entries(raw.macros)) {
    const macroPath = `macros.${mapName}`;
    if (!isRecord(rawMacro)) throw new TypeError(`${macroPath} must be an object`);
    if (!Array.isArray(rawMacro.styles)) throw new TypeError(`${macroPath}.styles must be an array`);
    rawMacro.styles.forEach((style, index) => {
      if (!isRecord(style)) throw new TypeError(`${macroPath}.styles[${index}] must be an object`);
    });

    // Put `name` last so a stale/redundant value cannot override the map key.
    const migratedV7 = migrateMacroV6toV7({ ...rawMacro, name: mapName } as unknown as MacroV6);
    const migrated = migrateMacroV7toV8(migratedV7);
    const { name: _transientName, ...migratedWithoutName } = migrated;
    const {
      name: _staleName,
      styles: oldStyles,
      ...preservedMacroFields
    } = rawMacro;

    macros[mapName] = {
      ...preservedMacroFields,
      ...migratedWithoutName,
      styles: migrated.styles.map((style, index) => {
        const {
          tag: _tag,
          style_name: _styleName,
          variadic_left: _left,
          variadic_join: _join,
          variadic_right: _right,
          react_renderer_key: _renderer,
          block_template_name: _blockTemplate,
          ...preservedStyleFields
        } = oldStyles[index] as MacroPackageStyleV6;
        return { ...preservedStyleFields, ...style };
      }),
    } as MacroPackageEntryWithoutName;
  }

  return { ...raw, version: '8', macros } as unknown as MacroPackageFile;
}

/** @deprecated Use migrateMacroPackageV6toV8. */
export const migrateMacroPackageV6toV7 = migrateMacroPackageV6toV8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
