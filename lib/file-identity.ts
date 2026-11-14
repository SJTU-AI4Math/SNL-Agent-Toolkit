/** Windows/libuv can omit the volume ID in lstat even when fstat returns it.
 * Only relax the path-to-handle check on that platform; callers still check
 * the containing directory and require a nonzero, exact file ID. */
export function matchesPathFileIdentity(
  entry: { dev: bigint; ino: bigint }, opened: { dev: bigint; ino: bigint },
): boolean {
  return entry.ino !== 0n && entry.ino === opened.ino &&
    (entry.dev === opened.dev || (process.platform === 'win32' && entry.dev === 0n));
}
