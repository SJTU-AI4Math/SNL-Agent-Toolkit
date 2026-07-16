/**
 * Discover the `.SNL_Doc/` folder for a given workspace root, and read its
 * canonical top-level files. Pure Node — no `vscode` dependency.
 *
 * All paths in / out are absolute (or resolved to absolute on read). This
 * mirrors the extension's src/snlDoc.ts helpers but goes through node:fs
 * so it works on any machine with a git checkout of the project.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  EntryData,
  EntryKind,
  LibraryGraph,
  LibraryMetaFile,
  MacroKind,
  MacroPackageEntry,
  MacroPackageEntryWithoutName,
  MacroPackageFile,
  SnlConfig,
} from './snl-doc-schema.ts';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Absolute path to `<workspace>/.SNL_Doc`. */
export function snlDocRoot(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, '.SNL_Doc');
}

export function configPath(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'config.json');
}

export function entriesPath(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'entries.json');
}

export function termMacrosDir(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'term_macros');
}

export function librariesDir(workspaceRoot: string): string {
  return path.join(snlDocRoot(workspaceRoot), 'libraries');
}

export function libraryDir(workspaceRoot: string, slug: string): string {
  return path.join(librariesDir(workspaceRoot), slug);
}

export function libraryGraphPath(workspaceRoot: string, slug: string): string {
  return path.join(libraryDir(workspaceRoot, slug), 'graph.json');
}

export function libraryMetaPath(workspaceRoot: string, slug: string): string {
  return path.join(libraryDir(workspaceRoot, slug), 'meta.json');
}

// ---------------------------------------------------------------------------
// Existence & read helpers
// ---------------------------------------------------------------------------

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string): Promise<T> {
  const text = await fs.readFile(p, 'utf8');
  return JSON.parse(text) as T;
}

/**
 * Assert the given directory looks like an SNL-Doc workspace root — i.e. it
 * has a `.SNL_Doc/` folder. Throws with a friendly message otherwise. Used
 * as the first line of every CLI so failures explain themselves.
 */
export async function assertSnlDoc(workspaceRoot: string): Promise<void> {
  const dir = snlDocRoot(workspaceRoot);
  if (!(await pathExists(dir))) {
    throw new Error(
      `No .SNL_Doc/ folder at ${workspaceRoot}. Point --root at the workspace that contains .SNL_Doc/.`,
    );
  }
}

/**
 * Read `.SNL_Doc/config.json` if present, else return an empty config. A
 * corrupt config is a fatal error (throws) — we don't silently mask JSON
 * damage.
 */
export async function readConfig(workspaceRoot: string): Promise<SnlConfig> {
  const p = configPath(workspaceRoot);
  if (!(await pathExists(p))) {
    return { version: '0.0.0' };
  }
  return readJson<SnlConfig>(p);
}

/**
 * Read `.SNL_Doc/entries.json` as a bare JSON array. Missing file → `[]`;
 * corrupt or non-array → throw.
 */
export async function readEntries(workspaceRoot: string): Promise<EntryData[]> {
  const p = entriesPath(workspaceRoot);
  if (!(await pathExists(p))) {
    return [];
  }
  const raw = await readJson<unknown>(p);
  if (!Array.isArray(raw)) {
    throw new Error(`${p} is not a JSON array`);
  }
  return raw as EntryData[];
}

/**
 * Read every macro package file under `.SNL_Doc/term_macros/`. Returns a
 * map from bare-package-filename (no `.json`) → MacroPackageFile. Silently
 * skips non-`.json` files but a corrupt `.json` throws (with the package
 * name in the error) so the caller can spot the offender.
 */
export async function readAllMacroPackages(
  workspaceRoot: string,
): Promise<Record<string, MacroPackageFile>> {
  const dir = termMacrosDir(workspaceRoot);
  if (!(await pathExists(dir))) {
    return {};
  }
  const names = await fs.readdir(dir);
  const out: Record<string, MacroPackageFile> = {};
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const bare = name.replace(/\.json$/i, '');
    try {
      out[bare] = await readJson<MacroPackageFile>(path.join(dir, name));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read macro package '${bare}': ${msg}`);
    }
  }
  return out;
}

/**
 * Flatten every macro across every package into a `name → entry` map,
 * respecting `config.active_macro_packages` (missing = all active).
 * Later-active packages overwrite earlier ones on name collision.
 */
export async function readActiveMacros(
  workspaceRoot: string,
): Promise<Record<string, MacroPackageEntry>> {
  const [config, packages] = await Promise.all([
    readConfig(workspaceRoot),
    readAllMacroPackages(workspaceRoot),
  ]);
  const active = config.active_macro_packages ?? Object.keys(packages);
  const flat: Record<string, MacroPackageEntry> = {};
  for (const pkgName of active) {
    const pkg = packages[pkgName];
    if (!pkg?.macros) continue;
    for (const [macroName, entry] of Object.entries(pkg.macros)) {
      const withName: MacroPackageEntry = {
        name: macroName,
        ...(entry as MacroPackageEntryWithoutName),
      };
      flat[macroName] = withName;
    }
  }
  return flat;
}

/** List every library slug on disk. Missing dir → `[]`. */
export async function listLibrarySlugs(workspaceRoot: string): Promise<string[]> {
  const dir = librariesDir(workspaceRoot);
  if (!(await pathExists(dir))) {
    return [];
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

export async function readLibraryMeta(
  workspaceRoot: string,
  slug: string,
): Promise<LibraryMetaFile | null> {
  const p = libraryMetaPath(workspaceRoot, slug);
  if (!(await pathExists(p))) return null;
  return readJson<LibraryMetaFile>(p);
}

export async function readLibraryGraph(
  workspaceRoot: string,
  slug: string,
): Promise<LibraryGraph | null> {
  const p = libraryGraphPath(workspaceRoot, slug);
  if (!(await pathExists(p))) return null;
  const raw = await readJson<unknown>(p);
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !Array.isArray((raw as LibraryGraph).nodes) ||
    !Array.isArray((raw as LibraryGraph).relationships)
  ) {
    throw new Error(`${p} is not a valid LibraryGraph shape`);
  }
  return raw as LibraryGraph;
}

// Convenience: pluck the entry_kinds / macro_kinds catalogs.

export async function readEntryKinds(workspaceRoot: string): Promise<EntryKind[]> {
  const cfg = await readConfig(workspaceRoot);
  return cfg.entry_kinds ?? [];
}

export async function readMacroKinds(workspaceRoot: string): Promise<MacroKind[]> {
  const cfg = await readConfig(workspaceRoot);
  return cfg.macro_kinds ?? [];
}
