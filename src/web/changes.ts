import { randomUUID } from 'node:crypto';
import { constants, watch, type FSWatcher } from 'node:fs';
import { open, lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

export type WorkspaceChange = { event: 'change'; data: { revision: string } }
  | { event: 'unavailable'; data: { message: string } };
export interface WorkspaceChanges {
  readonly revision: string;
  readonly available: boolean;
  subscribe(listener: (event: WorkspaceChange) => void): () => void;
  close(): Promise<void>;
}
export const WATCH_UNAVAILABLE = 'Automatic updates are unavailable. Use Refresh; watching will retry.';
/** Test seams only; the CLI uses the fixed defaults below. */
export interface WatchOptions {
  debounceMs?: number;
  retryMs?: number;
  watchDirectory?: (directory: string, changed: (filename: string | null) => void) => FSWatcher;
}

function ignored(name: string, atRoot: boolean): boolean {
  return name === '.cache' || (atRoot && /^(?:cache|caches|tmp|temp)$/i.test(name))
    || name === '.DS_Store' || /(?:\.lock|\.tmp|\.temp|\.sw[opx]|~)$/i.test(name)
    || /^\.#|^#.*#$/.test(name);
}

/**
 * One non-recursive watch per real directory, shared by all browser subscribers.
 * Reconciliation reads directory entries + metadata, never file bodies/snapshots.
 * Directory timestamps are deliberately excluded: cache/lock writes must not
 * change the revision just by touching a containing directory's mtime.
 *
 * Linux traversal and watch installation use pinned directory descriptors; an
 * atomic parent swap cannot redirect a child open through a symlink. Elsewhere
 * each directory is lstat/realpath checked before and after opening/watching.
 * Native recursive watch is not used (it may follow file and directory links).
 */
export async function watchWorkspaceChanges(root: string, options: WatchOptions = {}): Promise<WorkspaceChanges> {
  root = path.resolve(root);
  const debounceMs = options.debounceMs ?? 250;
  const retryMs = options.retryMs ?? 1000;
  const watchDirectory = options.watchDirectory ?? ((directory, changed) =>
    watch(directory, { persistent: false }, (_event, filename) => changed(filename?.toString() ?? null)));
  const epoch = randomUUID();
  let generation = 0;
  let available = false;
  let closed = false;
  let initialized = false;
  let failureEpoch = 0;
  let dirty = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;
  let previous = new Map<string, string>();
  const listeners = new Set<(event: WorkspaceChange) => void>();
  const watches = new Map<string, { identity: string; watcher: FSWatcher }>();
  const revision = () => `${epoch}:${generation}`;
  const emit = (event: WorkspaceChange) => { for (const listener of listeners) listener(event); };
  const stopWatches = () => {
    const retired = [...watches.values()];
    watches.clear();
    for (const { watcher } of retired) watcher.close();
  };
  function schedule(delay = debounceMs) {
    if (closed) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void reconcile(); }, delay);
    timer.unref();
  }
  function unavailable() {
    if (closed) return;
    const announce = available || !initialized;
    available = false;
    failureEpoch++;
    initialized = true;
    stopWatches();
    if (announce) emit({ event: 'unavailable', data: { message: WATCH_UNAVAILABLE } });
    schedule(retryMs);
  }
  async function scan() {
    const startedEpoch = failureEpoch;
    const next = new Map<string, string>();
    const found = new Set<string>();
    const visit = async (filename: string, relative: string, workspaceParent = false): Promise<void> => {
      // O_NOFOLLOW rejects the final directory link. On Linux filename is
      // descriptor-relative, so ALL earlier components are pinned as well.
      const before = await lstat(filename, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink()) throw new Error('Directory unavailable');
      if (process.platform !== 'linux' && await realpath(filename) !== filename) throw new Error('Directory link');
      const handle = await open(filename, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat({ bigint: true });
        const identity = `${stat.dev}:${stat.ino}`;
        if (!stat.isDirectory() || stat.dev !== before.dev || stat.ino !== before.ino) throw new Error('Directory changed');
        const pinned = process.platform === 'linux' ? `/proc/self/fd/${handle.fd}` : filename;
        const key = workspaceParent ? '..' : relative;
        found.add(key);
        if (!workspaceParent) next.set(relative, `d:${identity}`);
        const existing = watches.get(key);
        if (existing?.identity !== identity) {
          watches.delete(key);
          existing?.watcher.close();
          const watcher = watchDirectory(pinned, name => {
            if (workspaceParent && name !== null && name !== '.SNL_Doc') return;
            if (!workspaceParent && name !== null && ignored(name, relative === '')) return;
            schedule();
          });
          watches.set(key, { identity, watcher });
          const lost = () => { if (watches.get(key)?.watcher === watcher) unavailable(); };
          watcher.on('error', lost);
          watcher.on('close', lost);
        }
        if (workspaceParent) {
          await visit(path.join(pinned, '.SNL_Doc'), '');
        } else {
          for (const item of await readdir(pinned, { withFileTypes: true })) {
            if (ignored(item.name, relative === '') || item.isSymbolicLink()) continue;
            const child = path.join(pinned, item.name);
            const childRelative = relative ? `${relative}/${item.name}` : item.name;
            // lstat again rather than trusting readdir across an atomic rename.
            const childStat = await lstat(child, { bigint: true });
            if (childStat.isSymbolicLink()) continue;
            if (childStat.isDirectory()) await visit(child, childRelative);
            else if (childStat.isFile()) next.set(childRelative,
              `f:${childStat.dev}:${childStat.ino}:${childStat.size}:${childStat.mtimeNs}:${childStat.ctimeNs}`);
          }
        }
        const after = await lstat(filename, { bigint: true });
        if (after.isSymbolicLink() || after.dev !== stat.dev || after.ino !== stat.ino) throw new Error('Directory replaced');
        if (process.platform !== 'linux' && await realpath(filename) !== filename) throw new Error('Directory link');
      } finally { await handle.close(); }
    };
    if (process.platform === 'linux') {
      // The root is canonical at startup, but an ancestor can later become a
      // symlink. Pin its entire chain, not just the final root component.
      const components = root.split('/').filter(Boolean);
      const visitRootChain = async (filename: string, depth = 0): Promise<void> => {
        const handle = await open(filename, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        try {
          const pinned = `/proc/self/fd/${handle.fd}`;
          if (depth < components.length) await visitRootChain(`${pinned}/${components[depth]}`, depth + 1);
          // '/.' makes lstat inspect the pinned directory, not the proc FD link.
          else await visit(`${pinned}/.`, '', true);
        } finally { await handle.close(); }
      };
      await visitRootChain('/');
    } else {
      await visit(root, '', true);
    }
    if (closed) { stopWatches(); return; }
    if (startedEpoch !== failureEpoch) throw new Error('Watch failed during reconciliation');
    for (const [key, { watcher }] of watches) if (!found.has(key)) { watches.delete(key); watcher.close(); }
    const changed = previous.size !== next.size || [...next].some(([key, value]) => previous.get(key) !== value);
    previous = next;
    const recovered = initialized && !available;
    available = true;
    if (initialized && (changed || recovered)) {
      generation++;
      emit({ event: 'change', data: { revision: revision() } });
    }
    initialized = true;
  }
  function reconcile(): Promise<void> {
    if (closed) return Promise.resolve();
    if (running) { dirty = true; return running; }
    dirty = false;
    running = scan().catch(() => unavailable()).finally(() => {
      running = undefined;
      if (dirty && !timer && !closed) schedule();
    });
    return running;
  }
  await reconcile();
  return {
    get revision() { return revision(); },
    get available() { return available; },
    subscribe(listener) { if (!closed) listeners.add(listener); return () => { listeners.delete(listener); }; },
    async close() {
      closed = true;
      available = false;
      previous.clear();
      if (timer) clearTimeout(timer);
      timer = undefined;
      listeners.clear();
      stopWatches();
      await running;
      stopWatches();
    },
  };
}
