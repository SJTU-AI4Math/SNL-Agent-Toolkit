// Native subset of Extension 76acedbc src/derivedCache.ts (MIT).
// Deliberate changes: strict file-only publication, no .gitignore write and
// no shared-result cleanup; see docs/relationship-generation.md.
import { constants, promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';

/** Internal, trusted calculators only. This API is not a user-script sandbox. */
export type CacheRoot = string | { readonly uri: string };
export interface CacheScope { library: string }
export interface CacheDescriptor<T> {
  id: string;
  version: string;
  input: unknown;
  scope?: CacheScope;
  validate(value: unknown): value is T;
}
export interface CacheRequest<T> extends CacheDescriptor<T> {
  generate(): T | Promise<T>;
  signal?: AbortSignal;
}
const MAX_BYTES = 64 * 1024 * 1024;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** JSON semantics with canonical own-key ordering; never locale-sensitive. */
export function cacheFingerprint(value: unknown): string {
  const ancestors = new Set<object>();
  const canonical = (v: unknown): unknown => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v === undefined) return null;
    if (typeof v !== 'object') throw new Error('Cache inputs must be JSON data');
    if (ancestors.has(v)) throw new Error('Cyclic cache input');
    ancestors.add(v);
    let out: unknown;
    if (Array.isArray(v)) out = v.map(canonical);
    else {
      if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) throw new Error('Cache inputs must be plain JSON objects');
      const values: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(v).sort()) {
        const val = (v as Record<string, unknown>)[key];
        if (val !== undefined) values[key] = canonical(val);
      }
      out = values;
    }
    ancestors.delete(v);
    return out;
  };
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function segment(value: string): void {
  if (!value || value !== value.trim() || value.startsWith('.') || /[\\/:\0]/.test(value) || /[. ]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw new Error('Invalid cache path segment');
  }
}
export function cachePath(root: string, id: string, scope?: CacheScope): string {
  segment(id);
  if (scope) segment(scope.library);
  const base = scope ? path.join(root, '.SNL_Doc', 'libraries', scope.library) : path.join(root, '.SNL_Doc');
  return path.resolve(base, '.cache', id, 'result.json');
}

async function checkDirectory(directory: string, create: boolean): Promise<void> {
  try {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe cache directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !create) throw error;
    try { await fs.mkdir(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    await checkDirectory(directory, false);
  }
}
async function guard(root: string, id: string, scope: CacheScope | undefined, create: boolean): Promise<string> {
  const file = cachePath(root, id, scope);
  let current = path.resolve(root, '.SNL_Doc');
  await checkDirectory(current, false);
  if (scope) {
    current = path.join(current, 'libraries'); await checkDirectory(current, false);
    current = path.join(current, scope.library); await checkDirectory(current, false);
  }
  current = path.join(current, '.cache'); await checkDirectory(current, create);
  await checkDirectory(path.join(current, id), create);
  try {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe cache file');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return file;
}

/** Pinned envelope and descriptor validation; actual input is mandatory. */
export async function readCache<T>(root: string, descriptor: CacheDescriptor<T>): Promise<T | undefined> {
  try {
    const file = await guard(root, descriptor.id, descriptor.scope, false);
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let text: string;
    try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > MAX_BYTES) return undefined; text = await handle.readFile('utf8'); }
    finally { await handle.close(); }
    const envelope: unknown = JSON.parse(text);
    if (!object(envelope) || envelope.format !== 'snl-derived-cache' || envelope.schema !== 1 ||
      envelope.generator !== descriptor.id || envelope.version !== descriptor.version ||
      envelope.library !== (descriptor.scope?.library ?? null) ||
      envelope.inputHash !== cacheFingerprint(descriptor.input) ||
      !descriptor.validate(envelope.value) || envelope.valueHash !== cacheFingerprint(envelope.value)) return undefined;
    return envelope.value;
  } catch { return undefined; }
}
/** Strict native publisher. No memory fallback, clear, or unlink of the shared result.
 * beforeRename rechecks the complete Authoring input after temporary-file sync.
 * Other processes may still overwrite/clear after this boundary; readers MUST
 * supply current inputs. A late stale envelope is disposable, never current.
 */
export async function writeCache<T>(root: string, descriptor: CacheDescriptor<T>, value: T, beforeRename: () => Promise<void>): Promise<void> {
  if (!descriptor.validate(value)) throw new Error('Invalid generated cache value');
  const text = JSON.stringify({ format: 'snl-derived-cache', schema: 1, generator: descriptor.id,
    version: descriptor.version, library: descriptor.scope?.library ?? null,
    inputHash: cacheFingerprint(descriptor.input), valueHash: cacheFingerprint(value), value });
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Cache output exceeds size limit');
  const file = await guard(root, descriptor.id, descriptor.scope, true);
  const temporary = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(text + '\n'); await handle.sync(); } finally { await handle.close(); }
    await beforeRename();
    await guard(root, descriptor.id, descriptor.scope, false);
    await fs.rename(temporary, file);
    const directory = await fs.open(path.dirname(file), constants.O_RDONLY);
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
