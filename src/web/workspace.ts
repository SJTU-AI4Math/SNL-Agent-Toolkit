import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { assertSnlDoc, readConfig, readEntries, readActiveMacros, readLibraryMeta, readLibraryGraph, readLibraryCounters } from '../../lib/snl-doc.ts';
import { listManagedEntities, validateManagedWorkspace } from '../../lib/entity-crud.ts';
import type { CounterNode, EntryData, EntryKind, LibraryGraph, LibraryMetaFile, MacroKind, MacroPackageEntry, SnlConfig } from '../../lib/snl-doc-schema.ts';

export interface WorkspaceReaderInput {
  config: SnlConfig;
  entries: EntryData[];
  entryKinds: EntryKind[];
  macros: Record<string, MacroPackageEntry>;
  macroKinds: MacroKind[];
  relationships: Array<{ id: string; from: string; to: string; label: string; metadata?: unknown }>;
  library: { slug: string; metadata: LibraryMetaFile | null; graph: LibraryGraph; counters: CounterNode[] };
}
/** Structural wire contract of the Extension's FrozenReaderSnapshot. */
export interface WorkspaceReaderSnapshot {
  version: 1;
  renderSnapshotId: string;
  library: { slug: string; title: string; description?: string; outline: WorkspaceOutlineNode[]; warnings: string[] };
  entries: EntryData[];
  entryKinds: EntryKind[];
  entryPackages: Record<string, string>;
  macros: Record<string, MacroPackageEntry>;
  macroKinds: MacroKind[];
  relationships: WorkspaceReaderInput['relationships'];
  preferences: { language: string; color_scheme: string; motion: string };
  contentLanguage: string;
  languages: Array<{ id: string; display_name: string }>;
  resources: Record<string, { url: string; text?: string; revision: string }>;
}
export interface WorkspaceOutlineNode {
  nodeId: string; entry: EntryData | null; kind: EntryKind | null; counterLabel: string | null; children: WorkspaceOutlineNode[];
}
export interface WorkspaceReaderModel {
  buildWorkspaceReaderSnapshot(input: WorkspaceReaderInput): WorkspaceReaderSnapshot;
  readerAssetPaths(snapshot: WorkspaceReaderSnapshot): string[];
}
export interface LocalWorkspace {
  id: 'local'; name: string; root: string; libraries: Array<{ slug: string; title: string; entryCount: number | null; relationshipCount: number | null }>; capabilities: { edit: false };
}
export interface WorkspaceReader {
  getWorkspace(): Promise<LocalWorkspace>;
  getSnapshot(slug: string): Promise<WorkspaceReaderSnapshot>;
}
/** Host-owned module location, never a URL or request-supplied import path. */
export async function createWorkspaceReader(root: string, modelSource: string | WorkspaceReaderModel): Promise<WorkspaceReader> {
  root = await fs.realpath(path.resolve(root));
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Workspace root must be an existing directory.');
  await assertSnlDoc(root);
  const validation = await validateManagedWorkspace(root);
  if (!validation.valid) throw new Error('Invalid .SNL_Doc workspace: ' + validation.issues.filter(issue => issue.severity === 'error').map(issue => issue.message).join('; '));
  if (typeof modelSource === 'string' && !path.isAbsolute(modelSource)) throw new Error('Reader model path must be absolute.');
  const model: WorkspaceReaderModel = typeof modelSource === 'string'
    ? await import(pathToFileURL(modelSource).href) : modelSource;
  if (typeof model?.buildWorkspaceReaderSnapshot !== 'function' || typeof model?.readerAssetPaths !== 'function') {
    throw new Error('Reader model must export buildWorkspaceReaderSnapshot and readerAssetPaths.');
  }
  const libraries = async (): Promise<LocalWorkspace['libraries']> => {
    await assertSnlDoc(root);
    return (await listManagedEntities(root, 'library')).map(({ id, value }) => {
      assertSlug(id);
      const title = (value.meta as LibraryMetaFile | undefined)?.title;
      // Match Dashboard's Library table: occurrence IDs and structural edges,
      // not shared Entry identities or workspace semantic relationships.
      const graph = value.graph as LibraryGraph | undefined;
      const entryCount = graph ? new Set(graph.nodes.filter(node => node.label === 'Entry').map(node => node.id)).size : null;
      return { slug: id, title: title || id, entryCount, relationshipCount: graph?.relationships.length ?? null };
    });
  };
  return {
    async getWorkspace() {
      return { id: 'local', name: path.basename(root), root, libraries: await libraries(), capabilities: { edit: false } };
    },
    async getSnapshot(slug) {
      assertSlug(slug);
      if (!(await libraries()).some(library => library.slug === slug)) throw new Error(`Library not found: ${slug}`);
      const [config, entries, macros, relationships, metadata, graph, counters] = await Promise.all([
        readConfig(root), readEntries(root), readActiveMacros(root), listManagedEntities(root, 'relationship'),
        readLibraryMeta(root, slug), readLibraryGraph(root, slug), readLibraryCounters(root, slug),
      ]);
      const snapshot = model.buildWorkspaceReaderSnapshot({ config, entries, macros, entryKinds: config.entry_kinds ?? [], macroKinds: config.macro_kinds ?? [],
        relationships: relationships.map(row => row.value as WorkspaceReaderInput['relationships'][number]),
        library: { slug, metadata, graph: graph ?? { nodes: [], relationships: [] }, counters } });
      // No general file route: only references enumerated by the shared renderer
      // may obtain bytes, and only from this workspace's assets directory.
      snapshot.resources = Object.create(null);
      for (const asset of model.readerAssetPaths(snapshot)) {
        try {
          const bytes = await readAsset(root, asset);
          const resource = { url: `data:${assetMime(asset)};base64,${bytes.toString('base64')}`,
            revision: 'sha256:' + createHash('sha256').update(bytes).digest('hex'),
            ...(asset.toLowerCase().endsWith('.svg') ? { text: bytes.toString('utf8') } : {}) };
          Object.defineProperty(snapshot.resources, asset, { value: resource, enumerable: true, writable: true, configurable: true });
        } catch {
          snapshot.library.warnings.push(`Asset unavailable: ${asset}`);
        }
      }
      // Include captured resources, so refresh notices changes to image bytes too.
      snapshot.renderSnapshotId = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
      return snapshot;
    },
  };
}

function assertSlug(slug: string): void {
  if (typeof slug !== 'string' || !slug || slug !== slug.trim() || slug.startsWith('.') || /[\\/\\\\:%\u0000-\u001f\u007f-\u009f]/u.test(slug)) {
    throw new Error('Invalid Library slug: expected one safe path segment.');
  }
}
function assetMime(asset: string): string {
  const mimes: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon' };
  return mimes[path.extname(asset).toLowerCase()] ?? 'application/octet-stream';
}
async function readAsset(root: string, asset: string): Promise<Buffer> {
  if (!asset || /[:\\\\%\u0000-\u001f\u007f-\u009f]/u.test(asset) || asset.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid asset path.');
  }
  // Linux descriptor-relative traversal pins every parent, including .SNL_Doc
  // and assets. A concurrently swapped parent cannot redirect a child read.
  const handles: Awaited<ReturnType<typeof fs.open>>[] = [];
  try {
    let current = root;
    const parts = ['.SNL_Doc', 'assets', ...asset.split('/')];
    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      if (process.platform !== 'linux' && await fs.realpath(current) !== current) throw new Error('Symlink asset parent.');
      const handle = await fs.open(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      handles.push(handle);
      if (!(await handle.stat()).isDirectory()) throw new Error('Invalid asset directory.');
      if (process.platform === 'linux') current = `/proc/self/fd/${handle.fd}`;
    }
    const filename = path.join(current, parts.at(-1)!);
    // O_NOFOLLOW is not available on every supported platform (notably Windows).
    // Reject leaf links explicitly as well, and bind the opened file to that entry.
    const before = await fs.lstat(filename);
    if (!before.isFile() || before.isSymbolicLink()) throw new Error('Asset must be a regular non-symlink file.');
    if (process.platform !== 'linux' && await fs.realpath(filename) !== filename) throw new Error('Symlink asset file.');
    const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    handles.push(handle);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino) throw new Error('Asset changed while opening.');
    return await handle.readFile();
  } finally {
    for (const handle of handles.reverse()) await handle.close();
  }
}
