import { constants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ENTRY_STORAGE_VERSION,
  MACRO_STORAGE_VERSION,
  PACKAGE_STORAGE_VERSION,
  UNPACKAGED_PACKAGE_ID,
  assertPackageId,
  entryEntityPath,
  macroEntityPath,
  packageManifestPath,
  type EntryEnvelope,
  type MacroEnvelope,
  type PackageManifest,
} from './entity-storage.ts';
import { lintEntry } from './lint-entry.ts';
import { lintPackage } from './lint-package.ts';
import type { LintIssue } from './lint-report.ts';
import {
  readActiveMacros,
  readAllMacroPackages,
  readConfig,
  readEntries,
  readEntryKinds,
  snlDocRoot,
  configPath,
  usesEntityStorage,
} from './snl-doc.ts';
import { withWorkspaceDataLock } from './workspace-data-lock.ts';

export type AddEntryResult =
  | {
      status: 'created';
      entity: 'entry';
      id: string;
      package: string;
      path: string;
      issues: LintIssue[];
    }
  | { status: 'invalid'; entity: 'entry'; issues: LintIssue[] }
  | { status: 'conflict'; entity: 'entry'; code: string; message: string };

export type AddMacroResult =
  | {
      status: 'created'; entity: 'macro'; name: string; package: string;
      path: string; issues: LintIssue[];
    }
  | { status: 'invalid'; entity: 'macro'; issues: LintIssue[] }
  | { status: 'conflict'; entity: 'macro'; code: string; message: string };

export type AddEntityResult = AddEntryResult | AddMacroResult;

export type AddPackageResult =
  | { status: 'created'; entity: 'package'; id: string; path: string; active: boolean }
  | { status: 'invalid'; entity: 'package'; issues: LintIssue[] }
  | { status: 'conflict'; entity: 'package'; code: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertCurrentWriteConfig(config: unknown, cli: string): asserts config is Record<string, unknown> {
  if (!usesEntityStorage(config)) {
    throw new Error(`${cli} requires current workspace data 0.0.6 per-entity storage.`);
  }
  if (!isRecord(config) || !Array.isArray(config.entry_kinds)) {
    throw new Error('Current config.json entry_kinds must be an array.');
  }
  if (!Array.isArray(config.macro_kinds)) {
    throw new Error('Current config.json macro_kinds must be an array.');
  }
}

function effectiveActivePackageIds(
  config: Record<string, unknown>,
  packages: Record<string, unknown>,
): Set<string> {
  const configured = config.active_macro_packages;
  return new Set(Array.isArray(configured)
    ? configured.filter((id): id is string => typeof id === 'string')
    : Object.keys(packages).filter((id) => id !== UNPACKAGED_PACKAGE_ID));
}

async function canonicalWriteWorkspaceRoot(workspaceRoot: string): Promise<string> {
  const resolved = path.resolve(workspaceRoot);
  const real = await fs.realpath(resolved);
  const stat = await fs.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || real !== resolved) {
    throw new Error(`Workspace root ${resolved} must be a canonical, non-symlink directory.`);
  }
  return resolved;
}

function normalizeEntryDraft(raw: unknown, packageOverride?: string): Record<string, unknown> | unknown {
  if (!isRecord(raw)) return raw;
  const normalizedOverride = typeof packageOverride === 'string' ? packageOverride.trim() : packageOverride;
  const packageId = normalizedOverride !== undefined
    ? normalizedOverride
    : raw.package !== undefined
      ? typeof raw.package === 'string' ? raw.package.trim() : raw.package
      : UNPACKAGED_PACKAGE_ID;
  return {
    ...raw,
    id: raw.id === undefined ? raw.id : typeof raw.id === 'string' ? raw.id.trim() : raw.id,
    package: packageId,
    kind: raw.kind === undefined ? raw.kind : typeof raw.kind === 'string' ? raw.kind.trim() : raw.kind,
    title: raw.title === undefined ? '' : typeof raw.title === 'string' ? raw.title.trim() : raw.title,
    content: raw.content === undefined ? {} : raw.content,
    contribution_info: Object.prototype.hasOwnProperty.call(raw, 'contribution_info')
      ? raw.contribution_info : null,
    pointer: Object.prototype.hasOwnProperty.call(raw, 'pointer') ? raw.pointer : null,
  };
}

function templateUsesVariadic(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  for (let index = 0; index < value.length - 1; index += 1) {
    if (value[index] !== '#' || value[index + 1] !== '*') continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) return true;
  }
  return false;
}

function normalizeMacroDraft(raw: unknown): Record<string, unknown> | unknown {
  if (!isRecord(raw)) return raw;
  const styles = Array.isArray(raw.styles)
    ? raw.styles.map((style) => isRecord(style)
      ? { ...style, tags: style.tags === undefined ? [] : style.tags }
      : style)
    : raw.styles;
  const firstStyle = Array.isArray(styles) && isRecord(styles[0]) &&
    typeof styles[0].style_name === 'string' ? styles[0].style_name : undefined;
  const source = raw.source === undefined ? {} : raw.source;
  const normalizedSource = isRecord(source)
    ? {
        ...source,
        entries: source.entries === undefined ? [] : source.entries,
        urls: source.urls === undefined ? [] : source.urls,
      }
    : source;
  return {
    ...raw,
    description: raw.description === undefined ? '' : raw.description,
    source: normalizedSource,
    dynamic_arity: raw.dynamic_arity === undefined
      ? Array.isArray(styles) && styles.some((style) => isRecord(style) && templateUsesVariadic(style.template))
      : raw.dynamic_arity,
    default_style: raw.default_style === undefined
      ? (firstStyle ? { en: firstStyle } : undefined)
      : raw.default_style,
    tags: raw.tags === undefined ? [] : raw.tags,
    styles,
  };
}

async function installNewJson(docRoot: string, relativePath: string, value: unknown): Promise<void> {
  const target = path.join(docRoot, relativePath);
  const directory = path.dirname(target);
  const dirStat = await fs.lstat(directory);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) {
    throw new Error(`${directory} must be a regular, non-symlink directory.`);
  }
  const temp = path.join(directory, `.${path.basename(target)}.snl-add-${process.pid}-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o644);
    await handle.writeFile(jsonText(value), 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.link(temp, target);
  } finally {
    await handle?.close();
    await fs.rm(temp, { force: true });
  }
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readRegularText(file: string): Promise<{ text: string; mode: number }> {
  let handle;
  try {
    handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${file} must be a regular, non-symlink file.`);
    return { text: await handle.readFile('utf8'), mode: stat.mode & 0o777 };
  } finally {
    await handle?.close();
  }
}

async function replaceJsonIfUnchanged(file: string, expected: string, value: unknown): Promise<void> {
  const current = await readRegularText(file);
  if (current.text !== expected) throw new Error(`${file} changed during Package creation; refusing to overwrite it.`);
  const directory = path.dirname(file);
  const temp = path.join(directory, `.${path.basename(file)}.snl-add-${process.pid}-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, current.mode);
    await handle.writeFile(jsonText(value), 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    if ((await readRegularText(file)).text !== expected) {
      throw new Error(`${file} changed during Package creation; refusing to overwrite it.`);
    }
    await fs.rename(temp, file);
  } finally {
    await handle?.close();
    await fs.rm(temp, { force: true });
  }
}

async function removeJsonIfUnchanged(file: string, expected: unknown): Promise<'removed' | 'missing' | 'preserved'> {
  try {
    if ((await readRegularText(file)).text !== jsonText(expected)) return 'preserved';
    await fs.unlink(file);
    return 'removed';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
}

export async function addEntryEntity(
  workspaceRoot: string,
  raw: unknown,
  options: { package?: string; strictMacros?: boolean } = {},
): Promise<AddEntryResult> {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, 'add Entry entity', async () => {
    const config = await readConfig(workspaceRoot);
    assertCurrentWriteConfig(config, 'snl-add-entry');
    const [entries, entryKinds, macros, packages] = await Promise.all([
      readEntries(workspaceRoot),
      readEntryKinds(workspaceRoot),
      readActiveMacros(workspaceRoot),
      readAllMacroPackages(workspaceRoot),
    ]);
    const normalized = normalizeEntryDraft(raw, options.package);
    const issues: LintIssue[] = [];
    if (isRecord(raw) && options.package !== undefined &&
        Object.prototype.hasOwnProperty.call(raw, 'package') &&
        (typeof raw.package !== 'string' || raw.package.trim() !== options.package.trim())) {
      issues.push({
        severity: 'error',
        code: 'entry.package-mismatch',
        message: `Draft package ${JSON.stringify(raw.package)} disagrees with --package ${JSON.stringify(options.package)}.`,
        path: 'package',
      });
    }
    const report = lintEntry(normalized, {
      entryKinds,
      macros,
      siblingEntries: entries,
      strictMacros: options.strictMacros,
    });
    issues.push(...report.issues);
    const packageValue = isRecord(normalized) ? normalized.package : undefined;
    let packageId = '';
    if (typeof packageValue !== 'string' || packageValue.length === 0) {
      issues.push({
        severity: 'error', code: 'entry.bad-package',
        message: 'Entry package must be a non-empty Package ID string.', path: 'package',
      });
    } else {
      packageId = packageValue;
      try {
        assertPackageId(packageId);
      } catch (error) {
        issues.push({
          severity: 'error', code: 'entry.bad-package',
          message: error instanceof Error ? error.message : String(error), path: 'package',
        });
      }
    }
    if (packageId && !Object.prototype.hasOwnProperty.call(packages, packageId)) {
      issues.push({
        severity: 'error',
        code: 'entry.package-not-found',
        message: `Package ${JSON.stringify(packageId)} does not exist. Create it first or use _unpackaged.`,
        path: 'package',
      });
    }
    if (issues.some((issue) => issue.code === 'entry.duplicate-id')) {
      const id = isRecord(normalized) && typeof normalized.id === 'string' ? normalized.id : '';
      return {
        status: 'conflict', entity: 'entry', code: 'entry.duplicate-id',
        message: `Entry id ${JSON.stringify(id)} already exists.`,
      };
    }
    if (issues.some((issue) => issue.severity === 'error')) {
      return { status: 'invalid', entity: 'entry', issues };
    }
    const entry = normalized as Record<string, unknown> & { id: string; package: string };
    const relativePath = entryEntityPath(entry.package, entry.id);
    const envelope: EntryEnvelope = {
      format: 'snl-entry',
      version: ENTRY_STORAGE_VERSION,
      package: entry.package,
      entry,
    };
    try {
      await installNewJson(snlDocRoot(workspaceRoot), relativePath, envelope);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return {
          status: 'conflict', entity: 'entry', code: 'entry.duplicate-id',
          message: `Entry id ${JSON.stringify(entry.id)} already exists.`,
        };
      }
      throw error;
    }
    return {
      status: 'created', entity: 'entry', id: entry.id,
      package: entry.package, path: relativePath, issues,
    };
  });
}

export async function addMacroEntity(
  workspaceRoot: string,
  packageId: string,
  raw: unknown,
  options: { checkKatex?: boolean } = {},
): Promise<AddMacroResult> {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, 'add Macro entity', async () => {
    const config = await readConfig(workspaceRoot);
    assertCurrentWriteConfig(config, 'snl-add-macro');
    const packages = await readAllMacroPackages(workspaceRoot);
    const issues: LintIssue[] = [];
    if (packageId === UNPACKAGED_PACKAGE_ID) {
      issues.push({
        severity: 'error', code: 'macro.system-package',
        message: 'Macros cannot be added to the system _unpackaged Package.', path: 'package',
      });
    } else if (!Object.prototype.hasOwnProperty.call(packages, packageId)) {
      issues.push({
        severity: 'error', code: 'macro.package-not-found',
        message: `Package ${JSON.stringify(packageId)} does not exist. Create it first with snl-add-package.`,
        path: 'package',
      });
    }
    const normalized = normalizeMacroDraft(raw);
    const name = isRecord(normalized) && typeof normalized.name === 'string' ? normalized.name : '';
    if (!name || /[@#$%\s()[\]{}]/u.test(name)) {
      issues.push({
        severity: 'error', code: 'macro.bad-name',
        message: 'Macro name must be non-empty and must not contain @, #, $, %, whitespace, parentheses, brackets, or braces.',
        path: 'name',
      });
    }
    const macroBody = isRecord(normalized)
      ? Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== 'name'))
      : normalized;
    const packageExists = Object.prototype.hasOwnProperty.call(packages, packageId);
    const synthetic = {
      version: '8',
      name: packageExists ? packages[packageId].name : packageId,
      description: packageExists ? packages[packageId].description : '',
      macros: name ? { [name]: macroBody } : {},
    };
    issues.push(...lintPackage(synthetic, { checkKatex: options.checkKatex !== false }).issues);
    if (packageExists && !effectiveActivePackageIds(config, packages).has(packageId)) {
      issues.push({
        severity: 'info',
        code: 'macro.package-inactive',
        message: `Package ${JSON.stringify(packageId)} is not active; the Macro is stored but will not resolve until the Package is activated.`,
        path: 'package',
      });
    }
    if (name && packageExists && Object.prototype.hasOwnProperty.call(packages[packageId].macros, name)) {
      return {
        status: 'conflict', entity: 'macro', code: 'macro.duplicate-name',
        message: `Macro ${JSON.stringify(name)} already exists in Package ${JSON.stringify(packageId)}.`,
      };
    }
    if (issues.some((issue) => issue.severity === 'error')) {
      return { status: 'invalid', entity: 'macro', issues };
    }
    const macro = normalized as Record<string, unknown> & { name: string };
    const relativePath = macroEntityPath(packageId, macro.name);
    const envelope: MacroEnvelope = {
      format: 'snl-macro', version: MACRO_STORAGE_VERSION, package: packageId, macro,
    };
    try {
      await installNewJson(snlDocRoot(workspaceRoot), relativePath, envelope);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return {
          status: 'conflict', entity: 'macro', code: 'macro.duplicate-name',
          message: `Macro ${JSON.stringify(macro.name)} already exists in Package ${JSON.stringify(packageId)}.`,
        };
      }
      throw error;
    }
    return {
      status: 'created', entity: 'macro', name: macro.name,
      package: packageId, path: relativePath, issues,
    };
  });
}

export async function addPackageEntity(
  workspaceRoot: string,
  raw: unknown,
  options: { beforeConfigInstall?: () => void | Promise<void> } = {},
): Promise<AddPackageResult> {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, 'add Package manifest', async () => {
    const configFile = configPath(workspaceRoot);
    const originalConfig = await readRegularText(configFile);
    const config: unknown = JSON.parse(originalConfig.text);
    assertCurrentWriteConfig(config, 'snl-add-package');
    const packages = await readAllMacroPackages(workspaceRoot);
    const issues: LintIssue[] = [];
    if (!isRecord(raw)) {
      issues.push({ severity: 'error', code: 'package.not-object', message: 'Package draft must be a JSON object.' });
      return { status: 'invalid', entity: 'package', issues };
    }
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id || id === UNPACKAGED_PACKAGE_ID) {
      issues.push({
        severity: 'error', code: 'package.bad-id',
        message: 'Package id must be a non-empty user Package ID and cannot be _unpackaged.', path: 'id',
      });
    } else {
      try {
        assertPackageId(id);
      } catch (error) {
        issues.push({
          severity: 'error', code: 'package.bad-id',
          message: error instanceof Error ? error.message : String(error), path: 'id',
        });
      }
    }
    const name = raw.name === undefined ? id
      : typeof raw.name === 'string' ? raw.name.trim() : raw.name;
    const description = raw.description === undefined ? ''
      : typeof raw.description === 'string' ? raw.description.trim() : raw.description;
    if (typeof name !== 'string' || !name) {
      issues.push({ severity: 'error', code: 'package.bad-name', message: 'Package name must be a non-empty string.', path: 'name' });
    }
    if (typeof description !== 'string') {
      issues.push({ severity: 'error', code: 'package.bad-description', message: 'Package description must be a string.', path: 'description' });
    }
    const collision = Object.keys(packages).find((existing) => existing.toLowerCase() === id.toLowerCase());
    if (collision) {
      return {
        status: 'conflict', entity: 'package', code: 'package.duplicate-id',
        message: `Package id ${JSON.stringify(id)} conflicts with existing Package ${JSON.stringify(collision)}.`,
      };
    }
    if (issues.some((issue) => issue.severity === 'error')) {
      return { status: 'invalid', entity: 'package', issues };
    }
    const manifest: PackageManifest = {
      ...raw,
      format: 'snl-package', version: PACKAGE_STORAGE_VERSION,
      id, name: name as string, description: description as string,
    };
    const relativePath = packageManifestPath(id);
    await installNewJson(snlDocRoot(workspaceRoot), relativePath, manifest);
    const configRecord = config as Record<string, unknown>;
    const currentActive = effectiveActivePackageIds(configRecord, packages);
    const nextConfig = {
      ...configRecord,
      active_macro_packages: [...new Set([...currentActive, id])]
        .sort((left, right) => left.localeCompare(right)),
    };
    try {
      if (options.beforeConfigInstall) await options.beforeConfigInstall();
      await replaceJsonIfUnchanged(configFile, originalConfig.text, nextConfig);
    } catch (error) {
      const manifestFile = path.join(snlDocRoot(workspaceRoot), relativePath);
      try {
        const rollback = await removeJsonIfUnchanged(manifestFile, manifest);
        if (rollback === 'preserved') {
          throw new Error(
            `${error instanceof Error ? error.message : String(error)} Rollback kept a concurrently changed Package manifest; workspace may contain an inactive Package.`,
            { cause: error },
          );
        }
      } catch (rollbackError) {
        if (rollbackError instanceof Error && rollbackError.cause === error) throw rollbackError;
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} Rollback failed for ${manifestFile}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}. Workspace may be inconsistent.`,
          { cause: error },
        );
      }
      throw error;
    }
    return { status: 'created', entity: 'package', id, path: relativePath, active: true };
  });
}
