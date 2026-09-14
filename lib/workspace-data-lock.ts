import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { lstat, open, readFile, unlink, type FileHandle } from 'node:fs/promises';
import * as path from 'node:path';

export const DATA_WRITE_LOCK_FILENAME = '.data-write.lock';
export const BATCH_JOURNAL_FILENAME = '.snl-batch-transaction.json';

async function hasBatchJournal(root: string): Promise<boolean> {
  try { await lstat(path.join(root, BATCH_JOURNAL_FILENAME)); return true; }
  catch (error) { if (errorCode(error) === 'ENOENT') return false; throw error; }
}

interface LockRecord {
  version: 1;
  pid: number;
  hostname: string;
  token: string;
  purpose: string;
  createdAt: string;
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function isLockRecord(value: unknown): value is LockRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<LockRecord>;
  return record.version === 1 && Number.isInteger(record.pid) &&
    typeof record.hostname === 'string' && typeof record.token === 'string' &&
    typeof record.purpose === 'string' && typeof record.createdAt === 'string';
}

function localProcessIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== 'ESRCH';
  }
}

async function readLock(lockPath: string): Promise<LockRecord | null> {
  try {
    const value: unknown = JSON.parse(await readFile(lockPath, 'utf8'));
    return isLockRecord(value) ? value : null;
  } catch {
    return null;
  }
}

type Identity = { dev: bigint; ino: bigint };
const sameIdentity = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;

/** An O_EXCL success can belong to a parent retired by a directory exchange. */
async function isCanonicalAcquisition(handle: FileHandle, lockPath: string, parent: Identity): Promise<boolean> {
  try {
    const currentParent = await lstat(path.dirname(lockPath), { bigint: true });
    const current = await lstat(lockPath, { bigint: true });
    const held = await handle.stat({ bigint: true });
    return currentParent.isDirectory() && sameIdentity(parent, currentParent) &&
      current.isFile() && held.isFile() && sameIdentity(held, current);
  } catch (error) {
    if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR') return false;
    throw error;
  }
}

async function acquireLock(
  workspaceRoot: string,
  purpose: string,
): Promise<{ handle: FileHandle; lockPath: string; record: LockRecord; parent: Identity }> {
  const lockPath = path.join(workspaceRoot, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME);
  const parent = await lstat(path.dirname(lockPath), { bigint: true });
  if (!parent.isDirectory()) throw new Error('SNL workspace lock parent must be a non-symlink directory.');
  const record: LockRecord = {
    version: 1,
    pid: process.pid,
    hostname: hostname(),
    token: randomUUID(),
    purpose,
    createdAt: new Date().toISOString(),
  };
  try {
    const handle = await open(lockPath, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
      return { handle, lockPath, record, parent };
    } catch (error) {
      // Initialization may have failed on a retired fd. Never unlink a newer
      // canonical owner's lock, even if our partial record cannot be parsed.
      try {
        if (await isCanonicalAcquisition(handle, lockPath, parent) && !await hasBatchJournal(workspaceRoot)) {
          await unlink(lockPath);
        }
      } catch { /* Preserve the initialization error; uncertain residue is retained. */ }
      finally { await handle.close(); }
      throw error;
    }
  } catch (error) {
    if (errorCode(error) !== 'EEXIST') throw error;
    const existing = await readLock(lockPath);
    const stale = existing !== null && existing.hostname === hostname() &&
      !localProcessIsAlive(existing.pid);
    if (stale) {
      throw new Error(
        `SNL workspace data has a stale ${existing.purpose} lock from pid ${existing.pid}. ` +
        `After confirming no writer is active, remove ${lockPath} and retry.`,
      );
    }
    const owner = existing
      ? `${existing.purpose} by pid ${existing.pid} on ${existing.hostname}`
      : 'an unreadable lock (remove it only after confirming no writer is active)';
    throw new Error(`SNL workspace data is locked for ${owner}.`);
  }
}

/** Coordinate Toolkit writes with the Extension's authoritative writer lock. */
export async function withWorkspaceDataLock<T>(
  workspaceRoot: string,
  purpose: string,
  task: () => Promise<T>,
): Promise<T> {
  if (await hasBatchJournal(workspaceRoot)) throw new Error(`SNL batch recovery required: inspect ${BATCH_JOURNAL_FILENAME} before any write or stale-lock removal.`);
  const acquired = await acquireLock(workspaceRoot, purpose);
  try {
    if (await hasBatchJournal(workspaceRoot)) throw new Error(`SNL batch recovery required: inspect ${BATCH_JOURNAL_FILENAME}.`);
    if (!await isCanonicalAcquisition(acquired.handle, acquired.lockPath, acquired.parent) ||
        (await readLock(acquired.lockPath))?.token !== acquired.record.token) {
      throw new Error('SNL workspace lock changed during acquisition; no write was admitted. Retry against the current workspace.');
    }
    return await task();
  } finally {
    await acquired.handle.close();
    // An admitted batch intentionally exchanges the parent and copies its token
    // to a new inode. Release by token, not pre-exchange inode, after the task.
    const current = await readLock(acquired.lockPath);
    if (current?.token === acquired.record.token && !await hasBatchJournal(workspaceRoot)) {
      try {
        await unlink(acquired.lockPath);
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
      }
    }
  }
}
