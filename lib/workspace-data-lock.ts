import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { open, readFile, unlink, type FileHandle } from 'node:fs/promises';
import * as path from 'node:path';

export const DATA_WRITE_LOCK_FILENAME = '.data-write.lock';

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

async function acquireLock(
  workspaceRoot: string,
  purpose: string,
): Promise<{ handle: FileHandle; lockPath: string; record: LockRecord }> {
  const lockPath = path.join(workspaceRoot, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME);
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
      return { handle, lockPath, record };
    } catch (error) {
      await handle.close();
      await unlink(lockPath).catch(() => undefined);
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
  const acquired = await acquireLock(workspaceRoot, purpose);
  try {
    return await task();
  } finally {
    await acquired.handle.close();
    const current = await readLock(acquired.lockPath);
    if (current?.token === acquired.record.token) {
      try {
        await unlink(acquired.lockPath);
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
      }
    }
  }
}
