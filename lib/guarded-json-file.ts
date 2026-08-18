import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readRegularText(file: string): Promise<{ text: string; mode: number }> {
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

async function syncDirectory(directory: string, beforeSync?: () => void | Promise<void>): Promise<void> {
  await beforeSync?.();
  const handle = await fs.open(directory, constants.O_RDONLY);
  try {
    await handle.sync();
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

export async function installNewJson(
  file: string,
  value: unknown,
  hooks: { beforeDirectorySync?: () => void | Promise<void> } = {},
): Promise<void> {
  const directory = path.dirname(file);
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
    await fs.link(temp, file);
    installed = true;
    try {
      await syncDirectory(directory, hooks.beforeDirectorySync);
    } catch (error) {
      if (await sameInode(file, temp)) {
        await fs.rm(file);
        installed = false;
      }
      throw error;
    }
  } finally {
    await handle?.close();
    await fs.rm(temp, { force: true });
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
  hooks: { beforeCapture?: () => void | Promise<void>; afterCapture?: () => void | Promise<void>; beforeDirectorySync?: () => void | Promise<void> } = {},
): Promise<void> {
  const current = await readRegularText(file);
  if (current.text !== expected) throw new Error(`${file} changed concurrently; refusing to overwrite it.`);
  const directory = path.dirname(file);
  const nonce = `${process.pid}-${randomUUID()}`;
  const temp = path.join(directory, `.${path.basename(file)}.snl-write-${nonce}.tmp`);
  const captured = path.join(directory, `.${path.basename(file)}.snl-write-${nonce}.captured`);
  let handle;
  let capturedPresent = false;
  let installed = false;
  try {
    handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, current.mode);
    await handle.writeFile(jsonText(value), 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;

    await hooks.beforeCapture?.();
    await fs.rename(file, captured);
    capturedPresent = true;
    await hooks.afterCapture?.();
    const observed = await readRegularText(captured);
    if (observed.text !== expected) {
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
      await syncDirectory(directory, hooks.beforeDirectorySync);
    } catch (error) {
      if (!await sameInode(file, temp)) {
        throw new Error(
          `${file} changed before its replacement could be durably committed; the captured original remains at ${captured}.`,
          { cause: error },
        );
      }
      await fs.rm(file);
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
    await handle?.close();
    await fs.rm(temp, { force: true });
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
  hooks: { beforeCapture?: () => void | Promise<void>; afterCapture?: () => void | Promise<void>; beforeDirectorySync?: () => void | Promise<void> } = {},
): Promise<void> {
  const current = await readRegularText(file);
  if (current.text !== expected) throw new Error(`${file} changed concurrently; refusing to remove it.`);
  const directory = path.dirname(file);
  const captured = path.join(
    directory,
    `.${path.basename(file)}.snl-remove-${process.pid}-${randomUUID()}.captured`,
  );
  await hooks.beforeCapture?.();
  await fs.rename(file, captured);
  await hooks.afterCapture?.();
  let observed: { text: string; mode: number };
  try {
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
  if (observed.text !== expected) {
    await restoreCapturedPath(captured, file);
    throw new Error(`${file} changed concurrently; refusing to remove it.`);
  }
  try {
    // Persist the canonical-name removal while the captured hard link still
    // exists, so an fsync failure can restore the original safely.
    await syncDirectory(directory, hooks.beforeDirectorySync);
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
