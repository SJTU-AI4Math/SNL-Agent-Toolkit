import type { FileHandle } from 'node:fs/promises';

export class FileSizeLimitError extends Error {}

/** Read at most the size limit plus one byte, even if the file grows mid-read. */
export async function readBoundedFile(handle: FileHandle, limit: number): Promise<Buffer> {
  const { size } = await handle.stat();
  if (size > limit) throw new FileSizeLimitError();

  const chunks: Buffer[] = [];
  let length = 0;
  while (length <= limit) {
    const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, limit - length + 1));
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, length);
    if (bytesRead === 0) return Buffer.concat(chunks, length);
    length += bytesRead;
    if (length > limit) break;
    chunks.push(chunk.subarray(0, bytesRead));
  }
  throw new FileSizeLimitError();
}
