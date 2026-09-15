import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, writeFile, rm, chmod, lstat, readdir, readFile, symlink } from 'node:fs/promises';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { mock } from 'node:test';
import { applyBatch, checkBatch } from '../lib/batch.ts';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
import { BATCH_JOURNAL_FILENAME, DATA_WRITE_LOCK_FILENAME } from '../lib/workspace-data-lock.ts';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { captureWorkspaceRevision } from '../lib/batch.ts';

const roots: string[] = [];
afterEach(async () => { mock.restoreAll(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

async function physical(root: string) {
  const rows: Array<[string, number, string]> = [];
  async function visit(relative: string) {
    if (relative === DATA_WRITE_LOCK_FILENAME) return;
    const file = path.join(root, '.SNL_Doc', relative); const s = await lstat(file);
    rows.push([relative, s.mode, s.isDirectory() ? 'directory' : (await readFile(file)).toString('base64')]);
    if (s.isDirectory()) for (const name of (await readdir(file)).sort()) await visit(relative ? `${relative}/${name}` : name);
  }
  await visit(''); return rows;
}
async function publicCall(root: string, command: string, args: Record<string, unknown>) {
  return executeOperation({ protocol: OPERATION_PROTOCOL, root, command, arguments: args });
}
function success(result: Awaited<ReturnType<typeof publicCall>>) {
  assert.equal(result.exitCode, 0, JSON.stringify(result.response)); assert.ok(result.response.ok);
  return result.response.data as Record<string, any>;
}
const operations = [{ command: 'entry/create', arguments: { value: { id: 'revision.new', kind: 'definition' } } }];
function receipt(check: Awaited<ReturnType<typeof checkBatch>>) {
  return { operations: check.normalizedOperations, checkedDigest: check.checkedDigest, expectedWorkspaceRevision: check.expectedWorkspaceRevision };
}

test('all reserved global and Library cache lifecycles leave Authoring identity alone', async () => {
  const root = await fixture();
  const library = success(await publicCall(root, 'library/list', {})).entities[0].id;
  const cold = await captureWorkspaceRevision(root);
  for (const base of ['.cache/pagerank', '.cache/pointer-inverse', '.cache/ssi', '.cache/dependencies', `libraries/${library}/.cache/graph-layout`]) {
    await put(root, `${base}/result.json`, 'corrupt but disposable cache');
    await chmod(path.join(root, '.SNL_Doc', base), 0o750);
    assert.equal(await captureWorkspaceRevision(root), cold);
    await put(root, `${base}/result.json`, 'rebuilt');
    await chmod(path.join(root, '.SNL_Doc', base, 'result.json'), 0o600);
    assert.equal(await captureWorkspaceRevision(root), cold);
    await rm(path.join(root, '.SNL_Doc', base.split('/').slice(0, -1).join('/')), { recursive: true });
    assert.equal(await captureWorkspaceRevision(root), cold);
  }
});

test('unknown author assets, cache-like paths, genuine entity content and modes remain authority', async () => {
  const root = await fixture();
  // Establish distinct preimages; checkout/archive modes are not portable fixtures.
  await chmod(path.join(root, '.SNL_Doc/config.json'), 0o644);
  await chmod(path.join(root, '.SNL_Doc/entries'), 0o755);
  const library = success(await publicCall(root, 'library/list', {})).entities[0].id;
  let previous = await captureWorkspaceRevision(root);
  for (const relative of ['assets/.cache/dependencies/result.json', '.cache-like/result.json', 'unknown/author.txt', `libraries/${library}/assets/.cache/result.json`, 'libraries/not-a-library/deeper/.cache/result.json', 'libraries/.hidden/.cache/result.json']) {
    await put(root, relative, 'authored');
    const now = await captureWorkspaceRevision(root); assert.notEqual(now, previous, relative); previous = now;
    await put(root, relative, 'changed');
    const edited = await captureWorkspaceRevision(root); assert.notEqual(edited, previous, relative); previous = edited;
  }
  await chmod(path.join(root, '.SNL_Doc/config.json'), 0o600);
  assert.notEqual(await captureWorkspaceRevision(root), previous);
  previous = await captureWorkspaceRevision(root);
  await chmod(path.join(root, '.SNL_Doc/entries'), 0o700);
  assert.notEqual(await captureWorkspaceRevision(root), previous);
  previous = await captureWorkspaceRevision(root);
  const entity = success(await publicCall(root, 'entry/get', { id: 'entry.localized' })).entity;
  success(await publicCall(root, 'entry/update', { id: entity.id, value: { ...entity.value, title: 'real Authoring edit' }, expectedRevision: entity.revision }));
  assert.notEqual(await captureWorkspaceRevision(root), previous);
});

for (const mutation of ['create', 'update', 'delete'] as const) test(`public checked batch accepts intervening cache ${mutation} and preserves the current full cache tree`, async () => {
  const root = await fixture();
  const library = success(await publicCall(root, 'library/list', {})).entities[0].id;
  const paths = ['.cache/dependencies/result.json', `libraries/${library}/.cache/graph-layout/result.json`];
  if (mutation !== 'create') for (const file of paths) await put(root, file, 'old cache');
  const checked = await checkBatch(root, operations);
  for (const file of paths) {
    if (mutation === 'delete') await rm(path.dirname(path.join(root, '.SNL_Doc', file)), { recursive: true });
    else { await put(root, file, 'current cache'); await chmod(path.join(root, '.SNL_Doc', file), 0o640); }
  }
  assert.equal(await captureWorkspaceRevision(root), checked.expectedWorkspaceRevision);
  const cached = (await physical(root)).filter(([name]) => name.includes('.cache'));
  const applied = success(await publicCall(root, 'batch/apply', receipt(checked)));
  assert.deepEqual((await physical(root)).filter(([name]) => name.includes('.cache')), cached);
  assert.equal(await captureWorkspaceRevision(root), applied.resultingWorkspaceRevision);
  assert.notEqual(applied.resultingWorkspaceRevision, checked.expectedWorkspaceRevision);
  assert.deepEqual(await readdir(root), ['.SNL_Doc']);
});

test('old whole-tree receipt is rejected explicitly even cold; fresh no-op batch is stable', async () => {
  const root = await fixture(); const checked = await checkBatch(root, []);
  // Independent legacy-v1 serialization oracle on actual full st_mode/bytes.
  const hash = createHash('sha256').update(`snl.batch.workspace/v1\0${root}\0`);
  for (const [name, mode, data] of await physical(root)) {
    const directory = data === 'directory'; const bytes = directory ? Buffer.alloc(0) : Buffer.from(data, 'base64');
    hash.update(JSON.stringify([name, directory ? 'directory' : 'file', mode & 0o777, bytes.length]) + '\0');
    if (!directory) hash.update(bytes);
  }
  const before = await physical(root);
  const result = await publicCall(root, 'batch/apply', { ...receipt(checked), expectedWorkspaceRevision: hash.digest('hex') });
  assert.equal(result.exitCode, 1); assert.ok(!result.response.ok);
  assert.equal(result.response.error.code, 'batch.workspace-conflict');
  assert.match(result.response.error.message, /retired whole-tree token/);
  assert.deepEqual(await physical(root), before);
  const applied = success(await publicCall(root, 'batch/apply', receipt(checked)));
  assert.equal(applied.resultingWorkspaceRevision, checked.expectedWorkspaceRevision);
});

for (const target of ['.cache/dependencies/result.json', 'config.json']) test(`pre-exchange ${target} churn is accurately classified and never discarded`, async () => {
  const root = await fixture(); await put(root, '.cache/dependencies/result.json', 'old');
  await chmod(path.join(root, '.SNL_Doc', target), 0o644);
  const checked = await checkBatch(root, operations);
  await assert.rejects(applyBatch(root, checked.normalizedOperations, checked.checkedDigest, checked.expectedWorkspaceRevision, {
    beforeExchange: async () => { await chmod(path.join(root, '.SNL_Doc', target), 0o600); },
  }), { code: target.startsWith('.cache') ? 'batch.physical-conflict' : 'batch.workspace-conflict' });
  assert.equal((await lstat(path.join(root, '.SNL_Doc', target))).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(root), ['.SNL_Doc']);
});

for (const seam of ['afterExchange', 'beforeParentSync'] as const) test(`cache readback corruption at ${seam} rolls back exact full physical preimage`, async () => {
  const root = await fixture(); await put(root, '.cache/dependencies/result.json', 'preimage');
  await chmod(path.join(root, '.SNL_Doc/.cache/dependencies/result.json'), 0o640);
  const checked = await checkBatch(root, operations); const before = await physical(root);
  await assert.rejects(applyBatch(root, checked.normalizedOperations, checked.checkedDigest, checked.expectedWorkspaceRevision, {
    [seam]: async () => { await put(root, '.cache/dependencies/result.json', 'foreign candidate cache'); },
  }), { code: 'batch.readback-failed' });
  assert.deepEqual(await physical(root), before); assert.deepEqual(await readdir(root), ['.SNL_Doc']);
});

test('cache corruption in retained preimage cannot pass Authoring-only rollback verification', async () => {
  const root = await fixture(); await put(root, '.cache/dependencies/result.json', 'preimage');
  const checked = await checkBatch(root, operations);
  await assert.rejects(applyBatch(root, checked.normalizedOperations, checked.checkedDigest, checked.expectedWorkspaceRevision, {
    afterExchange: async () => {
      const journal = JSON.parse(await readFile(path.join(root, BATCH_JOURNAL_FILENAME), 'utf8'));
      assert.equal(typeof journal.originalPhysicalRevision, 'string');
      assert.equal(typeof journal.resultingPhysicalRevision, 'string');
      await put(journal.stage, '.cache/dependencies/result.json', 'changed retired generation');
      throw Error('injected failure');
    },
  }), (e: any) => e.code === 'batch.recovery-required' && /Rollback physical revision mismatch/.test(e.details.rollback));
  assert.ok((await readdir(root)).includes(BATCH_JOURNAL_FILENAME));
  await assert.rejects(captureWorkspaceRevision(root), { code: 'batch.recovery-required' });
});

test('cache copy failure is I/O failure, not Authoring conflict, and leaves live bytes intact', async () => {
  const root = await fixture(); await put(root, '.cache/dependencies/result.json', 'preimage');
  const checked = await checkBatch(root, operations); const before = await physical(root); const write = fs.writeFile;
  let invoked = false;
  mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).startsWith(root + '/.snl-batch-') && String(args[0]).endsWith('/.cache/dependencies/result.json')) {
      invoked = true; throw Object.assign(Error('cache stage write denied'), { code: 'EACCES' });
    }
    return write(...args);
  });
  const result = await publicCall(root, 'batch/apply', receipt(checked));
  assert.ok(!result.response.ok); assert.equal(result.response.error.code, 'workspace.operation-failed'); assert.equal(result.exitCode, 2);
  assert.equal(invoked, true); assert.deepEqual(await physical(root), before); assert.deepEqual(await readdir(root), ['.SNL_Doc']);
});

for (const unsafe of ['symlink', 'special-mode'] as const) test(`Authoring capture ignores unsafe cache but physical batch fails closed: ${unsafe}`, async () => {
  const root = await fixture(); const checked = await checkBatch(root, []); const revision = await captureWorkspaceRevision(root);
  if (unsafe === 'symlink') await symlink('/tmp', path.join(root, '.SNL_Doc/.cache'));
  else { await put(root, '.cache/dependencies/result.json', 'cache'); await chmod(path.join(root, '.SNL_Doc/.cache'), 0o1700); }
  assert.equal(await captureWorkspaceRevision(root), revision);
  for (const [command, args] of [['batch/check', { operations: [] }], ['batch/apply', receipt(checked)]] as const) {
    const result = await publicCall(root, command, args);
    assert.ok(!result.response.ok); assert.equal(result.exitCode, 2);
    assert.equal(result.response.error.code, unsafe === 'symlink' ? 'workspace.unsafe-path' : 'workspace.unsupported-mode');
  }
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-revision-test-')); roots.push(root);
  await cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  success(await publicCall(root, 'library/create', { value: { slug: 'book', meta: { title: 'Book' }, graph: { nodes: [], relationships: [] }, counters: { counters: [] } } }));
  return root;
}
async function put(root: string, relative: string, bytes: string) {
  const file = path.join(root, '.SNL_Doc', relative);
  await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes);
}

test('public Authoring capture remains stable across cold global cache create/update/delete', async () => {
  const root = await fixture();
  const cold = await captureWorkspaceRevision(root);
  assert.equal(await captureWorkspaceRevision(root), cold);
  await put(root, '.cache/dependencies/result.json', '{"value":[]}');
  assert.equal(await captureWorkspaceRevision(root), cold, 'cache creation is not Authoring');
  await put(root, '.cache/dependencies/result.json', '{"value":["rebuilt"]}');
  assert.equal(await captureWorkspaceRevision(root), cold, 'cache update is not Authoring');
  await rm(path.join(root, '.SNL_Doc/.cache'), { recursive: true });
  assert.equal(await captureWorkspaceRevision(root), cold, 'cache deletion is not Authoring');
});
