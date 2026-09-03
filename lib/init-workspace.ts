import { randomUUID } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { createManagedEntity, validateManagedWorkspace, type ManagedEntityType } from './entity-crud.ts';
import { jsonText } from './guarded-json-file.ts';
import {
  BUILTIN_INIT_PRESETS,
  defaultConfig,
  defaultMacroEnvelopes,
  defaultPackageManifests,
  normalizeInitPreset,
  type InitPresetPackage,
} from './init-presets.ts';

export class InitWorkspaceError extends Error {
  constructor(
    readonly code: string,
    readonly exitCode: 1 | 2,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'InitWorkspaceError';
  }
}

async function pathKind(target: string): Promise<'missing' | 'present'> {
  try {
    await fs.lstat(target);
    return 'present';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
}

async function canonicalExistingDirectory(root: string): Promise<string> {
  const resolved = path.resolve(root);
  let stat;
  try {
    stat = await fs.lstat(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new InitWorkspaceError('workspace.root-not-found', 2, `Workspace root ${resolved} does not exist.`);
    }
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(resolved) !== resolved) {
    throw new InitWorkspaceError(
      'workspace.root-not-canonical', 2,
      `Workspace root ${resolved} must be a canonical, non-symlink directory.`,
    );
  }
  return resolved;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, jsonText(value), { encoding: 'utf8', flag: 'wx', mode: 0o644 });
}

async function listRelativeFiles(root: string, current = root): Promise<string[]> {
  const names = await fs.readdir(current, { withFileTypes: true });
  const out: string[] = [];
  for (const item of names.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(current, item.name);
    if (item.isDirectory()) out.push(...await listRelativeFiles(root, absolute));
    else out.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return out;
}

async function releaseOwnedLock(lockPath: string, token: string): Promise<void> {
  try {
    if (await fs.readFile(lockPath, 'utf8') === `${token}\n`) await fs.unlink(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function createPresetEntities(stageRoot: string, preset: InitPresetPackage): Promise<void> {
  const groups: Array<[ManagedEntityType, Array<Record<string, unknown>>]> = [
    ['entry-package', preset.packages],
    ['entry', preset.entries],
    ['macro', preset.macros],
    ['relationship', preset.relationships],
    ['library', preset.libraries],
  ];
  for (const [type, values] of groups) {
    for (const value of values) {
      let result;
      try {
        result = await createManagedEntity(stageRoot, type, value);
      } catch (error) {
        throw new InitWorkspaceError(
          'init.invalid-preset', 1,
          `${type} preset entity is invalid: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (result.status !== 'ok') {
        throw new InitWorkspaceError('init.invalid-preset', 1, result.message, { type, code: result.code });
      }
    }
  }
}

export interface InitWorkspaceResult {
  root: string;
  version: string;
  preset: string | null;
  createdPaths: string[];
  counts: Record<string, number>;
  valid: true;
}

function resolvePreset(presetId: string | undefined, presetValue: unknown): InitPresetPackage | undefined {
  if (presetId !== undefined && presetValue !== undefined) {
    throw new InitWorkspaceError(
      'operation.invalid-arguments', 2,
      'Choose either one built-in preset identity or --input, not both.',
    );
  }
  if (presetValue !== undefined) {
    try {
      return normalizeInitPreset(presetValue);
    } catch (error) {
      throw new InitWorkspaceError(
        'init.invalid-preset', 1,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  if (presetId === undefined) return undefined;
  const preset = BUILTIN_INIT_PRESETS.get(presetId);
  if (!preset) {
    throw new InitWorkspaceError(
      'init.preset-not-found', 1,
      `Unknown built-in init preset ${JSON.stringify(presetId)}. Choose fulcrum-math-notes, lean4-document, or react.`,
    );
  }
  return normalizeInitPreset(preset);
}

export async function initializeWorkspace(
  root: string,
  presetId?: string,
  presetValue?: unknown,
): Promise<InitWorkspaceResult> {
  const preset = resolvePreset(presetId, presetValue);
  const canonicalRoot = await canonicalExistingDirectory(root);
  const targetDoc = path.join(canonicalRoot, '.SNL_Doc');
  if (await pathKind(targetDoc) === 'present') {
    throw new InitWorkspaceError(
      'workspace.already-initialized', 1,
      `${targetDoc} already exists; snl init never reinitializes or overwrites a workspace.`,
    );
  }

  const token = randomUUID();
  const lockPath = path.join(canonicalRoot, '.SNL_Doc.init.lock');
  let lock;
  try {
    lock = await fs.open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await lock.writeFile(`${token}\n`, 'utf8');
    await lock.sync();
  } catch (error) {
    await lock?.close().catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new InitWorkspaceError(
        'workspace.locked', 2,
        `Another snl init already owns ${lockPath}; concurrent initialization is not allowed.`,
      );
    }
    throw error;
  }

  const stageRoot = path.join(canonicalRoot, `.snl-init-stage-${token}`);
  const stageDoc = path.join(stageRoot, '.SNL_Doc');
  let published = false;
  try {
    if (await pathKind(targetDoc) === 'present') {
      throw new InitWorkspaceError(
        'workspace.already-initialized', 1,
        `${targetDoc} appeared while initialization was starting; refusing to overwrite it.`,
      );
    }
    await Promise.all(['entries', 'macros', 'packages', 'libraries']
      .map(directory => fs.mkdir(path.join(stageDoc, directory), { recursive: true })));
    await Promise.all([
      ...defaultPackageManifests().map(item => writeJson(path.join(stageDoc, item.relativePath), item.value)),
      ...defaultMacroEnvelopes().map(item => writeJson(path.join(stageDoc, item.relativePath), item.value)),
      writeJson(path.join(stageDoc, 'relationships.json'), { version: 1, relationships: [] }),
    ]);
    const config = defaultConfig(preset);
    await writeJson(path.join(stageDoc, 'config.json'), config);
    if (preset) {
      await createPresetEntities(stageRoot, preset);
      const macroPackages = [...new Set(preset.macros
        .map(value => value.package)
        .filter((value): value is string => typeof value === 'string'))]
        .filter(value => value !== 'BasicMacros')
        .sort((left, right) => left.localeCompare(right));
      config.active_macro_packages = ['BasicMacros', ...macroPackages];
      await fs.writeFile(path.join(stageDoc, 'config.json'), jsonText(config), 'utf8');
    }

    const validation = await validateManagedWorkspace(stageRoot);
    if (!validation.valid) {
      throw new InitWorkspaceError(
        'init.invalid-candidate', 1,
        'The staged default workspace did not pass whole-workspace validation.', validation,
      );
    }
    if (await pathKind(targetDoc) === 'present') {
      throw new InitWorkspaceError(
        'workspace.already-initialized', 1,
        `${targetDoc} appeared before publication; refusing to overwrite it.`,
      );
    }
    await fs.rename(stageDoc, targetDoc);
    published = true;
    const createdPaths = (await listRelativeFiles(targetDoc)).map(item => `.SNL_Doc/${item}`);
    return {
      root: canonicalRoot,
      version: config.version,
      preset: preset?.id ?? null,
      createdPaths,
      counts: validation.counts,
      valid: true,
    };
  } finally {
    await lock.close().catch(() => undefined);
    await fs.rm(stageRoot, { recursive: true, force: true }).catch(() => undefined);
    await releaseOwnedLock(lockPath, token);
    if (!published && await pathKind(targetDoc) === 'present') {
      // A competing writer owns this path; never remove it during rollback.
    }
  }
}
