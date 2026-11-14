import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { isIP } from 'node:net';
import { loadWorkspaceReader, WebHostError } from './server';
import type { WorkspaceReader } from './workspace';

const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_ACTIVE_READS = 4;
const tokenPattern = /^[A-Za-z0-9_-]{32,256}$/;
const digest = (value: string) => createHash('sha256').update(value).digest();

interface RemoteOptions {
  host: string;
  port: number;
  token: string;
  key: Buffer;
  cert: Buffer;
}

export async function serveRemoteReader(reader: WorkspaceReader, options: RemoteOptions) {
  if (!isIP(options.host)) throw new WebHostError('web.invalid-host', 'Use an IPv4 or IPv6 bind address.');
  if (!tokenPattern.test(options.token)) {
    throw new WebHostError('web.token-required', 'Set SNL_READER_TOKEN to a random token of 32 to 256 base64url characters.');
  }
  const expected = digest(options.token);
  let activeReads = 0;
  const server = createServer({ key: options.key, cert: options.cert, minVersion: 'TLSv1.2', headersTimeout: 10_000, requestTimeout: 15_000 }, async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status: number, json: string) => {
      if (!res.destroyed) { res.writeHead(status); res.end(json); }
    };
    const error = (status: number, message: string) => send(status, JSON.stringify({ error: message }));
    const authorization = req.headers.authorization ?? '';
    if (!authorization.startsWith('Bearer ') || !timingSafeEqual(expected, digest(authorization.slice(7)))) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return error(401, 'A valid Reader token is required.');
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return error(405, 'This service is read-only.');
    }
    const rawPath = req.url ?? '';
    const [pathname] = rawPath.split('?', 1);
    if (pathname !== '/__snl/api/workspace' && pathname !== '/__snl/api/snapshot') return error(404, 'Unknown Reader resource.');
    const slugs = new URLSearchParams(rawPath.slice(pathname.length)).getAll('library');
    if (pathname.endsWith('/snapshot') && (slugs.length !== 1 || !slugs[0])) return error(400, 'Select one Library.');
    if (activeReads >= MAX_ACTIVE_READS) return error(503, 'The Reader service is busy. Try again.');
    activeReads++;
    try {
      let value: unknown;
      if (pathname.endsWith('/workspace')) {
        const { name, libraries } = await reader.getWorkspace();
        value = { id: 'remote', name, libraries, capabilities: { edit: false } };
      } else {
        value = await reader.getSnapshot(slugs[0]);
      }
      const json = JSON.stringify(value);
      if (Buffer.byteLength(json) > MAX_RESPONSE_BYTES) return error(413, 'Reader response exceeds 64 MiB.');
      send(200, json);
    } catch {
      error(422, 'Could not read the requested workspace data.');
    } finally {
      activeReads--;
    }
  });
  // A slow client must release its connection; there is no streaming endpoint.
  server.setTimeout(30_000);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP listening address.');
  const host = isIP(options.host) === 6 ? `[${options.host}]` : options.host;
  return {
    url: `https://${host}:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}

export async function startRemoteReader(root: string, options: { host: string; port: number; keyFile: string; certFile: string; token: string }) {
  if (!tokenPattern.test(options.token)) {
    throw new WebHostError('web.token-required', 'Set SNL_READER_TOKEN to a random token of 32 to 256 base64url characters.');
  }
  const [key, cert] = await Promise.all([readFile(options.keyFile), readFile(options.certFile)]);
  const { reader } = await loadWorkspaceReader(root, ['model.mjs']);
  return serveRemoteReader(reader, { host: options.host, port: options.port, token: options.token, key, cert });
}
