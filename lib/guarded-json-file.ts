import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

type DirectoryIdentity = { dev: number; ino: number };

async function readCanonicalDirectoryIdentity(directory: string): Promise<DirectoryIdentity> {
  const resolved = path.resolve(directory);
  const stat = await fs.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(resolved) !== resolved) {
    throw new Error(`${resolved} must be a canonical, non-symlink directory.`);
  }
  return { dev: stat.dev, ino: stat.ino };
}

async function assertCanonicalDirectory(directory: string, expected?: DirectoryIdentity): Promise<DirectoryIdentity> {
  const observed = await readCanonicalDirectoryIdentity(directory);
  if (expected && (observed.dev !== expected.dev || observed.ino !== expected.ino)) {
    throw new Error(`${path.resolve(directory)} changed concurrently; refusing to use a replacement directory.`);
  }
  return observed;
}

export async function readRegularText(file: string): Promise<{ text: string; mode: number; dev: number; ino: number; directoryDev: number; directoryIno: number }> {
  const directory = path.dirname(file);
  const directoryIdentity = await assertCanonicalDirectory(directory);
  let handle;
  try {
    handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    await assertCanonicalDirectory(directory, directoryIdentity);
    if (!stat.isFile()) throw new Error(`${file} must be a regular, non-symlink file.`);
    return {
      text: await handle.readFile('utf8'), mode: stat.mode & 0o777,
      dev: stat.dev, ino: stat.ino,
      directoryDev: directoryIdentity.dev, directoryIno: directoryIdentity.ino,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP')
      throw new Error(`${file} must be a regular, non-symlink file.`, { cause: error });
    throw error;
  } finally {
    await handle?.close();
  }
}

async function syncDirectory(
  directory: string,
  beforeSync?: () => void | Promise<void>,
  expected?: DirectoryIdentity,
): Promise<void> {
  await beforeSync?.();
  await assertCanonicalDirectory(directory, expected);
  const handle = await fs.open(directory, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  try {
    const stat = await handle.stat();
    if (expected && (stat.dev !== expected.dev || stat.ino !== expected.ino))
      throw new Error(`${directory} changed concurrently before directory sync.`);
    await handle.sync();
    await assertCanonicalDirectory(directory, expected);
  } finally {
    await handle.close();
  }
}

async function sameInode(left: string, right: string): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([fs.lstat(left), fs.lstat(right)]);
    return a.dev === b.dev && a.ino === b.ino;
  } catch {
    return false;
  }
}
async function quarantineAndRemoveOwnedPath(file: string, ownedLink: string): Promise<boolean> {
  const quarantine = path.join(path.dirname(file), `.${path.basename(file)}.snl-rollback-${process.pid}-${randomUUID()}.captured`);
  try { await fs.rename(file, quarantine); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (await sameInode(quarantine, ownedLink)) {
    await fs.rm(quarantine);
    return true;
  }
  // We captured an unrelated concurrent replacement. Restore it without
  // clobbering any newer canonical writer; otherwise preserve the quarantine.
  try {
    await fs.link(quarantine, file);
    if (await sameInode(quarantine, file)) await fs.rm(quarantine);
  } catch { /* Preserve the unrelated inode at the reported private path. */ }
  return false;
}

export async function installNewJson(
  file: string,
  value: unknown,
  hooks: { beforeDirectorySync?: () => void | Promise<void>; beforeRollbackQuarantine?: () => void | Promise<void> } = {},
): Promise<void> {
  const directory = path.dirname(file);
  const directoryIdentity = await assertCanonicalDirectory(directory);
  const temp = path.join(
    directory,
    `.${path.basename(file)}.snl-create-${process.pid}-${randomUUID()}.tmp`,
  );
  let handle;
  let installed = false;
  try {
    handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o644);
    await handle.writeFile(jsonText(value), 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await assertCanonicalDirectory(directory, directoryIdentity);
    await fs.link(temp, file);
    installed = true;
    try {
      await syncDirectory(directory, hooks.beforeDirectorySync, directoryIdentity);
    } catch (error) {
      await hooks.beforeRollbackQuarantine?.();
      if (await quarantineAndRemoveOwnedPath(file, temp)) installed = false;
      throw error;
    }
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.rm(temp, { force: true }).catch(() => undefined);
    if (installed) {
      // The canonical hard link is the committed file; temp cleanup is private.
    }
  }
}

async function restoreCapturedPath(captured: string, target: string): Promise<void> {
  try {
    await fs.link(captured, target);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${target} changed while guarded mutation was in flight; the captured file was preserved at ${captured} because restoration failed: ${detail}`,
      { cause: error },
    );
  }
  await fs.rm(captured);
}

/**
 * Replace one regular JSON file without a pathname check-to-rename seam.
 * The canonical path is first moved to a private same-directory capture. The
 * captured bytes are then checked. A concurrent replacement is restored (or
 * preserved at the reported capture path) rather than overwritten.
 */
export async function replaceJsonIfUnchanged(
  file: string,
  expected: string,
  value: unknown,
  hooks: { beforeCapture?: () => void | Promise<void>; afterParentCheckBeforeCapture?: () => void | Promise<void>; afterCapture?: () => void | Promise<void>; beforeDirectorySync?: () => void | Promise<void>; beforeRollbackQuarantine?: () => void | Promise<void> } = {},
): Promise<void> {
  const current = await readRegularText(file);
  if (current.text !== expected) throw new Error(`${file} changed concurrently; refusing to overwrite it.`);
  const directory = path.dirname(file);
  const expectedDirectory = { dev: current.directoryDev, ino: current.directoryIno };
  const nonce = `${process.pid}-${randomUUID()}`;
  const temp = path.join(directory, `.${path.basename(file)}.snl-write-${nonce}.tmp`);
  const captured = path.join(directory, `.${path.basename(file)}.snl-write-${nonce}.captured`);
  let handle;
  let capturedPresent = false;
  let installed = false;
  try {
    handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, current.mode);
    // fs.open applies the process umask even when an exact existing mode is
    // supplied. Restore the captured mode explicitly before publication.
    await handle.chmod(current.mode);
    await handle.writeFile(jsonText(value), 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;

    await hooks.beforeCapture?.();
    await assertCanonicalDirectory(directory, expectedDirectory);
    await hooks.afterParentCheckBeforeCapture?.();
    await fs.rename(file, captured);
    capturedPresent = true;
    await assertCanonicalDirectory(directory, expectedDirectory);
    await hooks.afterCapture?.();
    const observed = await readRegularText(captured);
    if (observed.text !== expected || observed.dev !== current.dev || observed.ino !== current.ino) {
      await restoreCapturedPath(captured, file);
      capturedPresent = false;
      throw new Error(`${file} changed concurrently; refusing to overwrite it.`);
    }

    try {
      await fs.link(temp, file);
      installed = true;
    } catch (error) {
      try {
        await restoreCapturedPath(captured, file);
        capturedPresent = false;
      } catch (restoreError) {
        throw new Error(
          `${file} changed while installing its replacement. ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
          { cause: error },
        );
      }
      throw error;
    }

    try {
      await syncDirectory(directory, hooks.beforeDirectorySync, expectedDirectory);
    } catch (error) {
      await hooks.beforeRollbackQuarantine?.();
      if (!await quarantineAndRemoveOwnedPath(file, temp)) {
        throw new Error(
          `${file} changed before its replacement could be durably committed; the captured original remains at ${captured}.`,
          { cause: error },
        );
      }
      installed = false;
      await restoreCapturedPath(captured, file);
      capturedPresent = false;
      throw error;
    }
    // The replacement is durably named. Failure to remove the private old hard
    // link must not be reported as a failed logical mutation.
    try {
      await fs.rm(captured);
      capturedPresent = false;
    } catch {
      // Leave a same-directory recovery link rather than report false failure.
    }
  } catch (error) {
    if (capturedPresent && !installed) {
      try {
        await restoreCapturedPath(captured, file);
        capturedPresent = false;
      } catch (restoreError) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} Recovery failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
          { cause: error },
        );
      }
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
    // A private temp cleanup failure cannot reverse or invalidate the
    // already-decided canonical transaction outcome.
    await fs.rm(temp, { force: true }).catch(() => undefined);
  }
}

/**
 * Remove one regular JSON file by capturing the canonical path first. If the
 * captured bytes are not the expected bytes, the concurrent file is restored
 * or retained at a reported recovery path; it is never unlinked as the target.
 */
export async function removeJsonIfUnchanged(
  file: string,
  expected: string,
  hooks: { beforeCapture?: () => void | Promise<void>; afterParentCheckBeforeCapture?: () => void | Promise<void>; afterCapture?: () => void | Promise<void>; beforeDirectorySync?: () => void | Promise<void> } = {},
): Promise<void> {
  const current = await readRegularText(file);
  if (current.text !== expected) throw new Error(`${file} changed concurrently; refusing to remove it.`);
  const directory = path.dirname(file);
  const expectedDirectory = { dev: current.directoryDev, ino: current.directoryIno };
  const captured = path.join(
    directory,
    `.${path.basename(file)}.snl-remove-${process.pid}-${randomUUID()}.captured`,
  );
  await hooks.beforeCapture?.();
  await assertCanonicalDirectory(directory, expectedDirectory);
  await hooks.afterParentCheckBeforeCapture?.();
  await fs.rename(file, captured);
  let observed: { text: string; mode: number; dev: number; ino: number; directoryDev: number; directoryIno: number };
  try {
    await assertCanonicalDirectory(directory, expectedDirectory);
    await hooks.afterCapture?.();
    observed = await readRegularText(captured);
  } catch (error) {
    try {
      await restoreCapturedPath(captured, file);
    } catch (restoreError) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} Recovery failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
        { cause: error },
      );
    }
    throw error;
  }
  if (observed.text !== expected || observed.dev !== current.dev || observed.ino !== current.ino) {
    await restoreCapturedPath(captured, file);
    throw new Error(`${file} changed concurrently; refusing to remove it.`);
  }
  try {
    // Persist the canonical-name removal while the captured hard link still
    // exists, so an fsync failure can restore the original safely.
    await syncDirectory(directory, hooks.beforeDirectorySync, expectedDirectory);
  } catch (error) {
    try {
      await restoreCapturedPath(captured, file);
    } catch (restoreError) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} Recovery failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
        { cause: error },
      );
    }
    throw error;
  }
  try {
    await fs.rm(captured);
  } catch {
    // Canonical deletion is committed; retain a private recovery link rather
    // than report a false operation failure.
  }
}
