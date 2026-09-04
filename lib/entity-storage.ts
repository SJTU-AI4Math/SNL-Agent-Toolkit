import { createHash } from 'node:crypto';

export const PACKAGE_STORAGE_VERSION = 1 as const;
export const ENTRY_STORAGE_VERSION = 1 as const;
export const MACRO_STORAGE_VERSION = 1 as const;
export const CURRENT_PACKAGE_SCHEMA_VERSION = 2 as const;
export const CURRENT_ENTRY_SCHEMA_VERSION = 1 as const;
export const CURRENT_MACRO_SCHEMA_VERSION = 1 as const;
export const UNPACKAGED_PACKAGE_ID = '_unpackaged' as const;

export type EntityIdentityKind = 'package' | 'entry' | 'macro';

/** Locale-independent ordering for persisted canonical identities. */
export function compareCanonicalIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface EntityStorageReceipt {
  legacy_backup_present: boolean;
  legacy_entries_present: boolean;
  entry_count: number;
  macro_package_count: number;
  macro_count: number;
  entries_digest: string;
  macro_packages_digest: string;
}

function semanticDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Exact legacy-backup receipt contract introduced by Extension workspace data 0.0.6. */
export function makeEntityStorageReceipt(
  entries: unknown,
  macroPackages: Map<string, unknown>,
  legacyBackupPresent: boolean,
): EntityStorageReceipt {
  const entryList = Array.isArray(entries) ? entries : [];
  const packages = [...macroPackages].sort(([left], [right]) => left.localeCompare(right));
  return {
    legacy_backup_present: legacyBackupPresent,
    legacy_entries_present: legacyBackupPresent && Array.isArray(entries),
    entry_count: entryList.length,
    macro_package_count: packages.length,
    macro_count: packages.reduce((count, [, value]) =>
      count + (value && typeof value === 'object' && !Array.isArray(value) &&
        (value as Record<string, unknown>).macros &&
        typeof (value as Record<string, unknown>).macros === 'object' &&
        !Array.isArray((value as Record<string, unknown>).macros)
        ? Object.keys((value as { macros: Record<string, unknown> }).macros).length : 0), 0),
    entries_digest: semanticDigest(entryList),
    macro_packages_digest: semanticDigest(packages),
  };
}

export interface PackageManifest {
  [key: string]: unknown;
  format: 'snl-package';
  version: typeof PACKAGE_STORAGE_VERSION;
  schema_version?: typeof CURRENT_PACKAGE_SCHEMA_VERSION;
  id: string;
  name: string;
  description: string;
  entry_ids?: string[];
}

export interface EntryEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  format: 'snl-entry';
  version: typeof ENTRY_STORAGE_VERSION;
  schema_version?: typeof CURRENT_ENTRY_SCHEMA_VERSION;
  package: string;
  entry: T;
}

export interface MacroEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  format: 'snl-macro';
  version: typeof MACRO_STORAGE_VERSION;
  schema_version?: typeof CURRENT_MACRO_SCHEMA_VERSION;
  package: string;
  macro: T;
}

const PACKAGE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const WINDOWS_DEVICE_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function assertPackageId(packageId: string): void {
  if (
    packageId !== UNPACKAGED_PACKAGE_ID &&
    (!PACKAGE_ID_RE.test(packageId) || packageId.toLowerCase().endsWith('.json'))
  ) {
    throw new Error(
      `Package id ${JSON.stringify(packageId)} must be 1-64 ASCII letters, digits, dots, underscores, or hyphens, start with a letter or digit, and not end in .json.`,
    );
  }
  if (WINDOWS_DEVICE_RE.test(packageId)) {
    throw new Error(`Package id ${JSON.stringify(packageId)} is a reserved Windows device name.`);
  }
}

export function entityIdentityHash(kind: EntityIdentityKind, ...segments: string[]): string {
  if (segments.some((segment) => segment.includes('\0'))) {
    throw new Error('Entity identities may not contain NUL characters.');
  }
  return createHash('sha256')
    .update(Buffer.from(`snl-doc/v1\0${kind}\0${segments.join('\0')}`, 'utf8'))
    .digest('hex')
    .slice(0, 20);
}

export function packageManifestPath(packageId: string): string {
  assertPackageId(packageId);
  return `packages/${packageId}-${entityIdentityHash('package', packageId)}.json`;
}

export function entryEntityPath(packageId: string, entryId: string): string {
  assertPackageId(packageId);
  if (!entryId) throw new Error('Entry id must be non-empty.');
  return `entries/${packageId}-${entityIdentityHash('entry', packageId, entryId)}.json`;
}

export function macroEntityPath(packageId: string, macroName: string): string {
  assertPackageId(packageId);
  if (!macroName) throw new Error('Macro name must be non-empty.');
  return `macros/${packageId}-${entityIdentityHash('macro', packageId, macroName)}.json`;
}

export function assertCanonicalEntryIds(value: unknown, label = 'Package entry_ids'): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((entryId) => typeof entryId !== 'string' || !entryId || entryId !== entryId.trim()) ||
    new Set(value).size !== value.length ||
    value.some((entryId, index) => index > 0 && compareCanonicalIds(value[index - 1], entryId) > 0)
  ) {
    throw new Error(`${label} must be a sorted array of unique, non-empty canonical Entry ids.`);
  }
}

export function assertCompatibleSchemaMarker(
  value: Record<string, unknown>,
  current: number,
  label: string,
  required = false,
): void {
  if (!Object.hasOwn(value, 'schema_version')) {
    if (required) throw new Error(`${label} must carry schema_version ${current}.`);
    return;
  }
  if (!Number.isInteger(value.schema_version) || (value.schema_version as number) < 1) {
    throw new Error(`${label} schema_version must be a positive integer.`);
  }
  if ((value.schema_version as number) > current) {
    throw new Error(
      `${label} schema version ${String(value.schema_version)} is newer than this Toolkit supports (${current}).`,
    );
  }
  if ((value.schema_version as number) < current) {
    throw new Error(
      `${label} schema_version ${String(value.schema_version)} has no registered migration to ${current}.`,
    );
  }
}
