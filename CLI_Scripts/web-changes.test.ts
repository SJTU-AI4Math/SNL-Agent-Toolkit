import assert from 'node:assert/strict';
import { watch, realpathSync, renameSync, symlinkSync, type FSWatcher } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm, rename, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { watchWorkspaceChanges, WATCH_UNAVAILABLE, type WorkspaceChange, type WatchOptions } from '../src/web/changes.ts';

const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean, message: string, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (!check()) { assert.ok(Date.now() < deadline, message); await pause(10); }
}
async function fixture(options: WatchOptions = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-web-changes-'));
  const doc = path.join(root, '.SNL_Doc');
  await mkdir(doc);
  await writeFile(path.join(doc, 'config.json'), '{}');
  const source = await watchWorkspaceChanges(root, { debounceMs: 40, retryMs: 70, ...options });
  const events: WorkspaceChange[] = [];
  source.subscribe(event => events.push(event));
  return { root, doc, source, events, async cleanup() { await source.close(); await rm(root, { recursive: true, force: true }); } };
}
async function changed(f: Awaited<ReturnType<typeof fixture>>, mutate: () => Promise<unknown>) {
  const before = f.source.revision;
  await mutate();
  await until(() => f.source.available && f.source.revision !== before, 'real fs mutation produces a fresh live revision');
}

test('real directory watches cover canonical families, atomic file replace, new nested directories, deletion and root replacement/recreation', { timeout: 15000 }, async () => {
  const f = await fixture();
  try {
    assert.equal(f.source.available, true);
    for (const relative of ['config.json', 'entries/a.json', 'packages/P/manifest.json', 'macros/P/m.json', 'libraries/L/graph.json', 'assets/cache/deep/icon.svg']) {
      await changed(f, async () => {
        await mkdir(path.dirname(path.join(f.doc, relative)), { recursive: true });
        await writeFile(path.join(f.doc, relative), 'initial');
      });
      await changed(f, () => writeFile(path.join(f.doc, relative), 'edited'));
    }
    await changed(f, async () => {
      await writeFile(path.join(f.doc, 'entries/.a.json.tmp'), 'atomic');
      await rename(path.join(f.doc, 'entries/.a.json.tmp'), path.join(f.doc, 'entries/a.json'));
    });
    await changed(f, () => rm(path.join(f.doc, 'entries/a.json')));
    await changed(f, () => rm(path.join(f.doc, 'assets'), { recursive: true }));
    const replacement = path.join(f.root, 'replacement');
    await mkdir(replacement); await writeFile(path.join(replacement, 'config.json'), 'new root');
    await changed(f, async () => { await rename(f.doc, path.join(f.root, 'old-root')); await rename(replacement, f.doc); });
    await changed(f, () => writeFile(path.join(f.doc, 'config.json'), 'after root swap'));
    await rm(f.doc, { recursive: true });
    await until(() => !f.source.available, 'deleted root advertises unavailability');
    const unavailable = f.events.at(-1)!;
    assert.deepEqual(unavailable, { event: 'unavailable', data: { message: WATCH_UNAVAILABLE } });
    await changed(f, async () => { await mkdir(f.doc); await writeFile(path.join(f.doc, 'config.json'), 'recreated'); });
    await changed(f, () => writeFile(path.join(f.doc, 'config.json'), 'still followed'));
  } finally { await f.cleanup(); }
});

test('cache/locks/editor temps and file/directory symlinks are not followed or announced', { timeout: 10000 }, async () => {
  const watched: string[] = [];
  const pendingPaths: Promise<void>[] = [];
  const f = await fixture({ watchDirectory(directory, changed) {
    pendingPaths.push(realpath(directory).then(value => { watched.push(value); }));
    return watch(directory, (_event, name) => changed(name?.toString() ?? null));
  } });
  try {
    const before = f.source.revision;
    const outside = path.join(f.root, 'external');
    await mkdir(outside); await writeFile(path.join(outside, 'secret.json'), 'private');
    await mkdir(path.join(f.doc, '.cache/deep'), { recursive: true });
    await mkdir(path.join(f.doc, 'cache/deep'), { recursive: true });
    await symlink(outside, path.join(f.doc, 'linked-dir'), 'dir');
    await symlink(path.join(outside, 'secret.json'), path.join(f.doc, 'linked-file.json'));
    for (const name of ['.cache/deep/render.json', 'cache/deep/snapshot.json', '.data-write.lock', '.config.json.snl-write-nonce.tmp', 'config.json.swp', 'config.json~']) {
      await writeFile(path.join(f.doc, name), 'derived');
    }
    await pause();
    await writeFile(path.join(outside, 'secret.json'), 'changed outside');
    await writeFile(path.join(outside, 'new.json'), 'outside addition');
    await rm(path.join(f.doc, '.cache'), { recursive: true });
    await rm(path.join(f.doc, 'linked-dir')); await rm(path.join(f.doc, 'linked-file.json'));
    await pause();
    await Promise.all(pendingPaths);
    assert.equal(f.source.revision, before);
    assert.deepEqual(f.events, []);
    assert.deepEqual(watched.sort(), [f.root, f.doc].sort());
    await changed(f, () => writeFile(path.join(f.doc, 'config.json'), 'real edit'));
  } finally { await f.cleanup(); }
});

test('a root replaced by a symlink is unavailable, does not follow it, and recovers after a real root returns', { timeout: 10000 }, async () => {
  const f = await fixture();
  try {
    const outside = path.join(f.root, 'external'); await mkdir(outside);
    await rename(f.doc, path.join(f.root, 'saved'));
    await symlink(outside, f.doc, 'dir');
    await until(() => !f.source.available, 'root link is unavailable');
    const revision = f.source.revision;
    await writeFile(path.join(outside, 'config.json'), 'private');
    await pause();
    assert.equal(f.source.revision, revision);
    await changed(f, async () => { await rm(f.doc); await rename(path.join(f.root, 'saved'), f.doc); });
  } finally { await f.cleanup(); }
});

test('watch installation and asynchronous watch errors fail closed, retry once healthy, and cleanup every real handle', { timeout: 10000 }, async () => {
  const active = new Set<FSWatcher>();
  let failing = true;
  let attempts = 0;
  const f = await fixture({ watchDirectory(directory, changed) {
    attempts++;
    if (failing) throw Object.assign(new Error('/private/path: ENOSPC'), { code: 'ENOSPC' });
    const watcher = watch(directory, (_event, name) => changed(name?.toString() ?? null));
    active.add(watcher); watcher.once('close', () => active.delete(watcher));
    return watcher;
  } });
  try {
    assert.equal(f.source.available, false);
    assert.equal(attempts, 1);
    failing = false;
    await until(() => f.source.available, 'retry restores watcher');
    assert.equal(active.size, 2);
    const firstRevision = f.source.revision;
    failing = true;
    [...active][0].emit('error', new Error('/private/path: inotify failure'));
    assert.equal(f.source.available, false);
    assert.deepEqual(f.events.at(-1), { event: 'unavailable', data: { message: WATCH_UNAVAILABLE } });
    await pause();
    assert.equal(f.source.available, false);
    assert.equal(f.source.revision, firstRevision);
    failing = false;
    await until(() => f.source.available && f.source.revision !== firstRevision, 'recovery invalidates clients even with unchanged files');
    failing = true;
    [...active][0].close();
    await until(() => !f.source.available, 'unexpected native watch closure must not leave a false live status');
    failing = false;
    await until(() => f.source.available, 'closed native watcher is reinstalled');
    await f.source.close();
    await until(() => active.size === 0, 'all watcher handles closed');
    const count = attempts;
    await writeFile(path.join(f.doc, 'config.json'), 'after close'); await pause();
    assert.equal(attempts, count);
  } finally { await f.cleanup(); }
});

test('burst edits coalesce to one revision and closing during a pending debounce cancels publication', { timeout: 10000 }, async () => {
  const f = await fixture({ debounceMs: 100 });
  try {
    await writeFile(path.join(f.doc, 'config.json'), 'one');
    await pause(15);
    await writeFile(path.join(f.doc, 'config.json'), 'two');
    await pause(15);
    await writeFile(path.join(f.doc, 'config.json'), 'three');
    await until(() => f.events.length > 0, 'coalesced event'); await pause();
    assert.equal(f.events.length, 1);
    await writeFile(path.join(f.doc, 'config.json'), 'cancelled');
    await f.source.close(); await pause();
    assert.equal(f.events.length, 1);
  } finally { await f.cleanup(); }
});

test('Linux descriptor-relative traversal never watches an external target during a concurrent directory-to-symlink swap', { timeout: 10000, skip: process.platform !== 'linux' }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-web-watch-race-'));
  const doc = path.join(root, '.SNL_Doc');
  const outside = path.join(root, 'external');
  const assets = path.join(doc, 'assets');
  await mkdir(assets, { recursive: true });
  await mkdir(path.join(outside, 'secret'), { recursive: true });
  let swapped = false;
  const watched: string[] = [];
  const source = await watchWorkspaceChanges(root, { debounceMs: 40, retryMs: 70, watchDirectory(directory, changed) {
    const actual = realpathSync(directory);
    if (actual === assets && !swapped) {
      swapped = true;
      renameSync(assets, path.join(root, 'saved-assets'));
      symlinkSync(outside, assets, 'dir');
    }
    watched.push(realpathSync(directory));
    return watch(directory, (_event, name) => changed(name?.toString() ?? null));
  } });
  try {
    assert.equal(swapped, true);
    assert.equal(source.available, false, 'detected parent swap is not published as live');
    await pause();
    assert.ok(watched.every(directory => !directory.startsWith(outside)), JSON.stringify(watched));
    assert.ok(watched.includes(path.join(root, 'saved-assets')), 'watch installation remained pinned to the original inode');
  } finally { await source.close(); await rm(root, { recursive: true, force: true }); }
});

test('Linux root ancestor replaced by a symlink never installs external watches and recovers when the real ancestor returns', { timeout: 10000, skip: process.platform !== 'linux' }, async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'snl-web-watch-ancestor-')));
  const parent = path.join(base, 'parent');
  const savedParent = path.join(base, 'saved-parent');
  const root = path.join(parent, 'project');
  const doc = path.join(root, '.SNL_Doc');
  const outside = path.join(base, 'external');
  const outsideDoc = path.join(outside, 'project', '.SNL_Doc');
  await mkdir(doc, { recursive: true });
  await mkdir(path.join(outsideDoc, 'secret'), { recursive: true });
  await writeFile(path.join(doc, 'config.json'), 'original');
  await writeFile(path.join(outsideDoc, 'config.json'), 'private');
  const watched: string[] = [];
  let oldDocEvents = 0;
  const source = await watchWorkspaceChanges(root, { debounceMs: 40, retryMs: 70, watchDirectory(directory, changed) {
    const actual = realpathSync(directory);
    watched.push(actual);
    return watch(directory, (_event, name) => {
      if (actual === doc) oldDocEvents++;
      changed(name?.toString() ?? null);
    });
  } });
  const events: WorkspaceChange[] = [];
  source.subscribe(event => events.push(event));
  const externalWatches = () => watched.filter(directory => directory === outside || directory.startsWith(`${outside}/`));
  try {
    assert.equal(source.available, true);
    const initialRevision = source.revision;
    await rename(parent, savedParent);
    await symlink(outside, parent, 'dir');
    // Mutate the already-watched inode, not the now-redirected root pathname.
    await writeFile(path.join(savedParent, 'project', '.SNL_Doc', 'config.json'), 'trigger old doc watcher');
    await until(() => oldDocEvents > 0, 'the old native doc watcher delivers the reconciliation trigger');
    await until(() => !source.available || externalWatches().length > 0, 'ancestor replacement is reconciled');
    assert.deepEqual(externalWatches(), [], 'reconciliation must never install a watch through the replaced root ancestor');
    assert.equal(source.available, false);
    assert.deepEqual(events.at(-1), { event: 'unavailable', data: { message: WATCH_UNAVAILABLE } });
    await writeFile(path.join(outsideDoc, 'config.json'), 'private edit');
    await pause(200); // Exercise retries while the ancestor remains a symlink.
    assert.equal(source.available, false);
    assert.equal(source.revision, initialRevision);
    assert.deepEqual(externalWatches(), []);
    await rm(parent);
    await rename(savedParent, parent);
    await until(() => source.available && source.revision !== initialRevision, 'the restored real ancestor recovers on retry');
    const recoveredRevision = source.revision;
    await writeFile(path.join(doc, 'config.json'), 'still followed after recovery');
    await until(() => source.available && source.revision !== recoveredRevision, 'real doc edits remain live after ancestor recovery');
    assert.deepEqual(externalWatches(), []);
  } finally { await source.close(); await rm(base, { recursive: true, force: true }); }
});

test('close during an in-flight directory reconciliation drains newly-installed handles and suppresses publication', { timeout: 10000 }, async () => {
  const active = new Set<FSWatcher>();
  let closing: Promise<void> | undefined;
  const f = await fixture({ watchDirectory(directory, changed) {
    const watcher = watch(directory, (_event, name) => changed(name?.toString() ?? null));
    active.add(watcher); watcher.once('close', () => active.delete(watcher));
    if (realpathSync(directory).endsWith('/new-nested')) closing = f.source.close();
    return watcher;
  } });
  try {
    await mkdir(path.join(f.doc, 'new-nested'));
    await until(() => !!closing, 'close invoked from an in-flight scan');
    await closing;
    await until(() => active.size === 0, 'in-flight additions also closed');
    assert.equal(f.source.available, false);
    assert.deepEqual(f.events, []);
  } finally { await f.cleanup(); }
});
