import { createServer, type Server } from 'node:http';
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

/** HTTP owns no global cwd or mutable current-workspace singleton. */
export async function serveWorkspace(reader: WorkspaceReader, assetsDirectory: string, port = WEB_DEFAULT_PORT) {
  const assets = new Map<string, { body: Buffer; type: string }>();
  for (const [name, type] of [['index.html', 'text/html'], ['reader.js', 'text/javascript'], ['reader.css', 'text/css']] as const) {
    try { assets.set(name === 'index.html' ? '/' : '/__snl/static/' + name, { body: await readFile(path.join(assetsDirectory, name)), type }); }
    catch { throw new WebHostError('web.assets-missing', 'Prebuilt reader assets are missing. For a source checkout run npm run build:web; reinstall an incomplete npm package.'); }
  }
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
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, WEB_HOST, () => { server.off('error', reject); resolve(); });
  }).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') throw new WebHostError('web.port-in-use', `Port ${port} is already in use; choose another with --port. No port was changed automatically.`);
    throw e;
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP listening address.');
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
  return { ...await serveWorkspace(reader, assetsDirectory, port), root: canonical };
}
