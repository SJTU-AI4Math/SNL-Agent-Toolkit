import { createServer, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { watchWorkspaceChanges, WATCH_UNAVAILABLE, type WatchOptions, type WorkspaceChange } from './changes';
import { readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_DEFAULT_PORT = 4911;
export const WEB_HOST = '127.0.0.1';
export interface WorkspaceReader {
  getWorkspace(): Promise<unknown>;
  getSnapshot(slug: string): Promise<unknown>;
}
export class WebHostError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

/** Programmatic test seams; startWebReader always uses the production defaults. */
export interface WebWatchOptions { root?: string; watch?: WatchOptions; heartbeatMs?: number }

/** HTTP owns no global cwd or mutable current-workspace singleton. */
export async function serveWorkspace(reader: WorkspaceReader, assetsDirectory: string, port = WEB_DEFAULT_PORT, options: WebWatchOptions = {}) {
  const assets = new Map<string, { body: Buffer; type: string }>();
  for (const [name, type] of [['index.html', 'text/html'], ['reader.js', 'text/javascript'], ['reader.css', 'text/css']] as const) {
    try { assets.set(name === 'index.html' ? '/' : '/__snl/static/' + name, { body: await readFile(path.join(assetsDirectory, name)), type }); }
    catch { throw new WebHostError('web.assets-missing', 'Prebuilt reader assets are missing. For a source checkout run npm run build:web; reinstall an incomplete npm package.'); }
  }
  const changes = options.root ? await watchWorkspaceChanges(options.root, options.watch) : undefined;
  const disabledRevision = `${randomUUID()}:0`;
  const clients = new Set<ServerResponse>();
  let heartbeat: NodeJS.Timeout | undefined;
  let disposal: Promise<void> | undefined;
  const removeClient = (res: ServerResponse) => {
    clients.delete(res);
    if (!clients.size && heartbeat) { clearInterval(heartbeat); heartbeat = undefined; }
  };
  // Never queue events behind a slow consumer. A backpressured stream reconnects
  // and receives the latest revision; file data/path names never enter this wire.
  const write = (res: ServerResponse, frame: string) => {
    if (res.destroyed || res.writableEnded) { removeClient(res); return; }
    if (!res.write(frame)) { removeClient(res); res.destroy(); }
  };
  const frame = (event: WorkspaceChange) => `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
  const unsubscribe = changes?.subscribe(event => { for (const res of clients) write(res, frame(event)); });
  const dispose = () => {
    if (disposal) return disposal;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    unsubscribe?.();
    for (const res of clients) res.destroy();
    clients.clear();
    disposal = changes?.close() ?? Promise.resolve();
    return disposal;
  };
  let origin = '';
  let actualPort = port;
  const server: Server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send = (status: number, body: string | Buffer, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type + '; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const error = (status: number, code: string, message: string) => send(status, JSON.stringify({ ok: false, error: { code, message } }));
    const host = req.headers.host;
    if (host !== `${WEB_HOST}:${actualPort}` && host !== `localhost:${actualPort}`) return error(403, 'web.host-denied', 'Unrecognized local Host.');
    if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return error(403, 'web.origin-denied', 'Cross-origin access is not allowed.');
    if (req.method !== 'GET' && req.method !== 'HEAD') { req.resume(); return error(405, 'web.read-only', 'This service is read-only.'); }
    try {
      const raw = req.url ?? '/';
      if (!raw.startsWith('/') || raw.startsWith('//') || /%2e|%2f|%5c|\\|(?:^|\/)\.\.(?:\/|$)/i.test(raw.split('?')[0])) return error(400, 'web.invalid-path', 'Invalid request path.');
      const url = new URL(raw, origin);
      if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
      const asset = assets.get(url.pathname);
      if (asset) return send(200, asset.body, asset.type);
      if (url.pathname === '/__snl/api/events') {
        if (req.method === 'HEAD') return send(200, '', 'text/event-stream');
        if (clients.size >= 64) return error(503, 'web.events-busy', 'Too many update subscribers.');
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no' });
        clients.add(res);
        res.once('close', () => removeClient(res));
        res.once('error', () => { removeClient(res); res.destroy(); });
        write(res, frame({ event: 'change', data: { revision: changes?.revision ?? disabledRevision } }));
        if (!changes?.available) write(res, frame({ event: 'unavailable', data: { message: WATCH_UNAVAILABLE } }));
        if (clients.size && !heartbeat) {
          heartbeat = setInterval(() => { for (const client of clients) write(client, ': heartbeat\n\n'); }, options.heartbeatMs ?? 15000);
          heartbeat.unref();
        }
        return;
      }
      if (url.pathname === '/__snl/api/workspace') return send(200, JSON.stringify(await reader.getWorkspace()));
      if (url.pathname === '/__snl/api/snapshot') {
        const slugs = url.searchParams.getAll('library');
        if (slugs.length !== 1 || !slugs[0]) return error(400, 'web.library-required', 'Select one Library.');
        return send(200, JSON.stringify(await reader.getSnapshot(slugs[0])));
      }
      return error(404, 'web.not-found', 'No such reader resource.');
    } catch (e) {
      return error(400, 'web.read-failed', e instanceof Error ? e.message : 'Workspace read failed.');
    }
  });
  // The 'close' event alone is too late: persistent SSE responses otherwise
  // prevent it from firing. Dispose as soon as either public close API is called.
  const closeServer = server.close.bind(server);
  server.close = callback => {
    const disposed = dispose();
    return closeServer(error => { void disposed.then(() => callback?.(error)); });
  };
  server.once('close', () => { void dispose(); });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, WEB_HOST, () => { server.off('error', reject); resolve(); });
  }).catch(async (e: NodeJS.ErrnoException) => {
    await dispose();
    if (e.code === 'EADDRINUSE') throw new WebHostError('web.port-in-use', `Port ${port} is already in use; choose another with --port. No port was changed automatically.`);
    throw e;
  });
  const address = server.address();
  if (!address || typeof address === 'string') { await dispose(); server.close(); throw new Error('No TCP listening address.'); }
  actualPort = address.port;
  origin = `http://${WEB_HOST}:${actualPort}`;
  return {
    server, url: origin,
    close: () => new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); }),
  };
}

export async function startWebReader(root: string, port = WEB_DEFAULT_PORT) {
  let canonical: string;
  try {
    canonical = await realpath(root);
    if (!(await lstat(canonical)).isDirectory() || !(await lstat(path.join(canonical, '.SNL_Doc'))).isDirectory()) throw new Error('Not a workspace');
  } catch { throw new WebHostError('web.workspace-missing', `No SNL workspace at ${path.resolve(root)}. Use snl init --root <directory> first, or specify an existing workspace with --root.`); }
  const assetsDirectory = fileURLToPath(new URL('../../dist/web/', import.meta.url));
  try {
    for (const name of ['index.html', 'reader.js', 'reader.css', 'model.mjs']) if (!(await lstat(path.join(assetsDirectory, name))).isFile()) throw new Error('Missing artifact');
  } catch { throw new WebHostError('web.assets-missing', 'Prebuilt reader assets are missing. For a source checkout run npm run build:web; reinstall an incomplete npm package.'); }
  const { createWorkspaceReader } = await import('./workspace');
  const reader = await createWorkspaceReader(canonical, path.join(assetsDirectory, 'model.mjs'));
  await reader.getWorkspace();
  return { ...await serveWorkspace(reader, assetsDirectory, port, { root: canonical }), root: canonical };
}
