import assert from 'node:assert/strict';
import { constants, promises as fs } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, mock } from 'node:test';
import { applyBatch, checkBatch } from '../lib/batch.ts';
import { withWorkspaceDataLock, DATA_WRITE_LOCK_FILENAME } from '../lib/workspace-data-lock.ts';

// This is an admission-state replay, NOT a pause inside the original pathname
// open syscall. Pin a real parent fd, perform a real batch exchange/commit,
// remove the retired lock at the cleanup seam, then return a real old-parent
// O_EXCL fd via /proc/self/fd. The substitution is explicit and test-local.
for (const syncFailure of [false, true]) {
  test(`pinned-parent replay rejects retired acquisition and preserves live owner (sync failure=${syncFailure})`, { skip: process.platform !== 'linux' }, async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'snl-lock-parent-'));
    const open = fs.open, remove = fs.rm;
    let parent: Awaited<ReturnType<typeof fs.open>> | undefined;
    let cTask: Promise<void> | undefined;
    let releaseC = () => {};
    let liveToken: string | undefined;
    let cActive = false, bEntered = false, overlap = false, intercepted = false;
    const lockPath = path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME);
    try {
      await fs.cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
      const receipt = await checkBatch(root, []);
      mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
        if (!intercepted && args[0] === lockPath && args[1] === 'wx') {
          intercepted = true;
          parent = await open(path.dirname(lockPath), constants.O_RDONLY | constants.O_DIRECTORY);
          // A is the actual batch implementation, including journal unlink and
          // token-based release of its copied live-generation lock.
          const a = await applyBatch(root, [], receipt.checkedDigest, receipt.expectedWorkspaceRevision, {
            afterExchange: async () => {
              mock.method(fs, 'rm', async (...rmArgs: Parameters<typeof fs.rm>) => {
                if (String(rmArgs[0]).startsWith(root + '/.snl-batch-')) {
                  await fs.unlink(path.join(String(rmArgs[0]), '.SNL_Doc', DATA_WRITE_LOCK_FILENAME));
                  throw Error('retain old directory after real retired-lock unlink');
                }
                return remove(...rmArgs);
              });
            },
          });
          assert.ok(a.diagnostics.some(d => d.code === 'batch.backup-cleanup-failed'));
          await assert.rejects(fs.lstat(path.join(root, '.snl-batch-transaction.json')), { code: 'ENOENT' });
          const pinned = await parent.stat(), live = await fs.lstat(path.dirname(lockPath));
          assert.notEqual(pinned.ino, live.ino);
          let cReady = () => {};
          const ready = new Promise<void>(resolve => { cReady = resolve; });
          const hold = new Promise<void>(resolve => { releaseC = resolve; });
          cTask = withWorkspaceDataLock(root, 'C live writer', async () => {
            cActive = true; cReady(); await hold; cActive = false;
          });
          await Promise.race([ready, cTask.then(() => { throw Error('C never admitted'); })]);
          liveToken = JSON.parse(await fs.readFile(lockPath, 'utf8')).token;
          const handle = await open(`/proc/self/fd/${parent.fd}/${DATA_WRITE_LOCK_FILENAME}`, 'wx', 0o600);
          assert.notEqual((await handle.stat()).ino, (await fs.lstat(lockPath)).ino);
          if (syncFailure) handle.sync = async () => { throw Error('injected retired-fd sync failure'); };
          return handle;
        }
        return open(...args);
      });
      syncBuiltinESMExports();
      let rejected: unknown;
      try {
        await withWorkspaceDataLock(root, 'B late writer', async () => {
          bEntered = true; overlap = cActive;
        });
      } catch (error) { rejected = error; }
      // Check the other writer's lock before releasing C, also on failed init.
      assert.equal(await fs.readFile(lockPath, 'utf8').then(v => JSON.parse(v).token).catch(() => 'missing'), liveToken);
      assert.equal(bEntered, false, `retired writer entered; concurrent with real C task=${overlap}`);
      assert.ok(rejected instanceof Error);
      assert.match(rejected.message, syncFailure ? /injected retired-fd sync failure/ : /lock.*changed|changed.*lock/i);
      assert.equal(intercepted, true);
    } finally {
      mock.restoreAll(); syncBuiltinESMExports();
      releaseC(); await cTask;
      await parent?.close();
      await remove(root, { recursive: true, force: true });
    }
  });
}

test('ordinary lock excludes nested writers and removes its own lock', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'snl-lock-normal-'));
  try {
    await fs.mkdir(path.join(root, '.SNL_Doc'));
    await withWorkspaceDataLock(root, 'ordinary', async () => {
      await assert.rejects(withWorkspaceDataLock(root, 'other', async () => assert.fail('must not enter')), /locked/);
    });
    await assert.rejects(fs.lstat(path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME)), { code: 'ENOENT' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
