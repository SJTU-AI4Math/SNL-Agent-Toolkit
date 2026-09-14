import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm, writeFile, symlink, lstat, readlink, chmod, unlink } from 'node:fs/promises';
import { promises as fs } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test, mock } from 'node:test';
import { applyBatch, parseBatchJson } from '../lib/batch.ts';
import { DATA_WRITE_LOCK_FILENAME, BATCH_JOURNAL_FILENAME } from '../lib/workspace-data-lock.ts';
import { createManagedEntity } from '../lib/entity-crud.ts';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';

const roots: string[] = [];
afterEach(async () => { mock.restoreAll(); syncBuiltinESMExports(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-batch-test-'));
  roots.push(root);
  await cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  return root;
}
async function tree(root: string) {
  const result: Array<[string, string]> = [];
  async function visit(dir: string) {
    for (const item of (await readdir(path.join(root, dir), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const name = path.join(dir, item.name);
      const mode = (await lstat(path.join(root, name))).mode & 0o777;
      if (item.isDirectory()) { result.push([name, `directory:${mode}`]); await visit(name); }
      else if (item.isSymbolicLink()) result.push([name, `link:${await readlink(path.join(root, name))}`]);
      else { assert.ok(item.isFile()); result.push([name, `${mode}:${(await readFile(path.join(root, name))).toString('base64')}`]); }
    }
  }
  await visit('');
  return result;
}
const tags = ['中文', '', '__proto__', 'repeat', 'repeat'];
const operations = [
  { command: 'entry/create', arguments: { value: { id: 'batch.dependent', package: 'Batch', kind: 'definition', tags, content: { snl: '' } } } },
  { command: 'entry-package/create', arguments: { value: { id: 'Batch' } } },
];
async function call(root: string, command: string, args: Record<string, unknown> = {}) {
  return executeOperation({ protocol: OPERATION_PROTOCOL, root, command, arguments: args });
}
function success(result: Awaited<ReturnType<typeof call>>) {
  assert.equal(result.exitCode, 0, JSON.stringify(result.response));
  assert.ok(result.response.ok);
  return result.response.data as Record<string, any>;
}

test('public batch check is read-only; apply creates dependents atomically and retains tags', async () => {
  const root = await fixture();
  const before = await tree(root);
  const checked = success(await call(root, 'batch/check', { operations }));
  assert.deepEqual(await tree(root), before);
  const applied = success(await call(root, 'batch/apply', { operations: checked.normalizedOperations, checkedDigest: checked.checkedDigest, expectedWorkspaceRevision: checked.expectedWorkspaceRevision }));
  assert.equal(applied.results.length, 2);
  assert.equal(applied.publication, 'linux-directory-exchange');
  const entry = success(await call(root, 'entry/get', { id: 'batch.dependent' })).entity;
  assert.deepEqual(entry.value.tags, tags);
  assert.deepEqual((await readdir(root)).sort(), ['.SNL_Doc']);
  assert.equal(success(await call(root, 'validate', { scope: 'workspace' })).valid, true);
});


test('all seven create families resolve against complete candidate, including first relationship pool', async () => {
  const root = await fixture();
  const config = JSON.parse(await readFile(path.join(root, '.SNL_Doc', 'config.json'), 'utf8'));
  const macros = success(await call(root, 'macro/list', { limit: 100 })).entities;
  assert.ok(macros.length);
  const macro = macros[0].value;
  await assert.rejects(readFile(path.join(root, '.SNL_Doc', 'relationships.json')), { code: 'ENOENT' });
  const ops = [
    { command: 'macro/create', arguments: { value: { ...macro, name: 'BatchMacro', package: 'MacroBatch', source: { entries: ['all.dependent'], urls: [] }, kind: 'batch-const' } } },
    { command: 'entry/create', arguments: { value: { id: 'all.dependent', package: 'EntryBatch', kind: 'batch-definition', tags, content: { snl: '' } } } },
    { command: 'relationship/create', arguments: { value: { id: 'all.relationship', from: 'all.dependent', to: 'entry.localized', label: 'depends' } } },
    { command: 'macro-package/create', arguments: { value: { id: 'MacroBatch' } } },
    { command: 'entry-package/create', arguments: { value: { id: 'EntryBatch' } } },
    { command: 'entry-kind/create', arguments: { value: { ...config.entry_kinds.find((v: any) => v.id === 'definition'), id: 'batch-definition' } } },
    { command: 'macro-kind/create', arguments: { value: { ...config.macro_kinds.find((v: any) => v.id === macro.kind), id: 'batch-const' } } },
  ];
  const before = await tree(root);
  const checked = success(await call(root, 'batch/check', { operations: ops }));
  assert.deepEqual(await tree(root), before);
  const applied = success(await call(root, 'batch/apply', receipt(checked)));
  assert.equal(applied.results.length, 7);
  for (const result of applied.results) {
    const entity = success(await call(root, `${result.entity.type}/get`, { id: result.entity.id })).entity;
    assert.deepEqual(entity, result.entity, 'result must match canonical public readback, including revision');
  }
  assert.equal(success(await call(root, 'validate', { scope: 'workspace' })).valid, true);
});

function receipt(checked: Record<string, any>) {
  return { operations: checked.normalizedOperations, checkedDigest: checked.checkedDigest, expectedWorkspaceRevision: checked.expectedWorkspaceRevision };
}
function failure(result: Awaited<ReturnType<typeof call>>, code?: string, exit?: number) {
  assert.equal(result.response.ok, false, JSON.stringify(result.response));
  assert.ok(!result.response.ok);
  if (code) assert.equal(result.response.error.code, code, result.response.error.message);
  if (exit) assert.equal(result.exitCode, exit);
}

test('discovery preserves current init and reader, with exactly seven creates and no generation', async () => {
  const root = await fixture();
  const data = success(await call(root, 'batch'));
  assert.deepEqual(data.operationCommands, ['entry-kind/create','macro-kind/create','entry-package/create','macro-package/create','entry/create','macro/create','relationship/create']);
  assert.deepEqual(data.commands.map((d: any) => [d.command, d.access]), [['batch/check','read'],['batch/apply','write']]);
  const help = success(await call(root, 'help'));
  assert.equal(help.web.readOnly, true);
  assert.ok(help.initHelp.defaultEntryKinds.includes('entry'));
  assert.ok(help.commands.includes('batch/check'));
  assert.ok(!help.commands.includes('relationship/generate'));
  failure(await call(root, 'relationship/generate'), 'command.unknown', 2);
});

test('digest tampering, operation tampering, stale workspace receipt and replay reject without residue', async () => {
  const root = await fixture();
  const checked = success(await call(root, 'batch/check', { operations }));
  const good = receipt(checked);
  for (const args of [ { ...good, checkedDigest: 'tampered' }, { ...good, operations: [] }, { ...good, expectedWorkspaceRevision: 'stale' } ]) {
    const before = await tree(root);
    failure(await call(root, 'batch/apply', args), args.expectedWorkspaceRevision === 'stale' ? 'batch.workspace-conflict' : 'batch.digest-conflict', 1);
    assert.deepEqual(await tree(root), before);
  }
  const entity = success(await call(root, 'entry/get', { id: 'entry.localized' })).entity;
  success(await call(root, 'entry/update', { id: entity.id, value: { ...entity.value, title: 'Concurrent edit' }, expectedRevision: entity.revision }));
  const before = await tree(root);
  failure(await call(root, 'batch/apply', good), 'batch.workspace-conflict', 1);
  assert.deepEqual(await tree(root), before);
  const fresh = receipt(success(await call(root, 'batch/check', { operations })));
  success(await call(root, 'batch/apply', fresh));
  const committed = await tree(root);
  failure(await call(root, 'batch/apply', fresh), 'batch.workspace-conflict', 1);
  assert.deepEqual(await tree(root), committed);
  failure(await call(root, 'entry/update', { id: entity.id, value: entity.value, expectedRevision: entity.revision }));
  assert.deepEqual(await tree(root), committed);
});

test('all malformed nested commands and invalid candidates reject as a whole, without residue', async () => {
  const root = await fixture();
  const before = await tree(root);
  for (const invalid of [
    {}, null, [null], new Array(1),
    [{ command: 'library/create', arguments: { value: { id: 'no' } } }],
    [{ command: 'entry/update', arguments: { value: {} } }],
    [{ command: 'relationship/generate', arguments: { value: {} } }],
    [{ ...operations[0], extra: true }],
    [{ command: 'entry/create', arguments: { value: {}, extra: true } }],
    [operations[1], operations[1]],
    [operations[0]],
    [operations[1], { command: 'macro-package/create', arguments: { value: { id: 'Batch' } } }],
    [{ command: 'entry-package/create', arguments: { value: { id: '../escape' } } }],
    [{ command: 'entry-package/create', arguments: { value: { id: 'Bad', entry_ids: ['manual'] } } }],
    [{ command: 'entry-package/create', arguments: { value: { id: 'Bad', macros: {} } } }],
    [{ command: 'relationship/create', arguments: { value: { id: 'dangling', from: 'entry.localized', to: 'missing', label: 'depends' } } }],
    ...[null, 1, 'bad', [1], new Array(1)].map(tags => [operations[1], { ...operations[0], arguments: { value: { ...operations[0].arguments.value, tags } } }]),
  ]) {
    failure(await call(root, 'batch/check', { operations: invalid }));
    assert.deepEqual(await tree(root), before);
  }
  failure(await call(root, 'batch/check', { operations, extra: true }), 'operation.invalid-arguments', 2);
  assert.deepEqual(await tree(root), before);
});

test('strict JSON rejects duplicate/escaped keys, comments, trailing commas and active JS data', async () => {
  for (const text of ['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '[1,]', '[/*comment*/1]']) assert.throws(() => parseBatchJson(text), SyntaxError);
  const root = await fixture(); const before = await tree(root);
  let accessed = false;
  const value = Object.defineProperty({}, 'id', { enumerable: true, get() { accessed = true; throw Error('getter executed'); } });
  for (const bad of [value, new Proxy({}, { ownKeys() { accessed = true; throw Error('proxy executed'); } }), { id: NaN }, { id: undefined }, new Date()]) {
    failure(await call(root, 'batch/check', { operations: [{ command: 'entry/create', arguments: { value: bad } }] }), 'operation.invalid-arguments', 2);
  }
  assert.equal(accessed, false);
  assert.deepEqual(await tree(root), before);
});

test('own prototype-colliding extension keys survive dependent creation and receipts are stable', async () => {
  const root = await fixture();
  const value = JSON.parse('{"id":"__proto__","kind":"definition","tags":["constructor"],"__proto__":{"retained":true},"constructor":"data"}');
  const ops = [{ command: 'entry/create', arguments: { value } }];
  const a = success(await call(root, 'batch/check', { operations: ops }));
  const b = success(await call(root, 'batch/check', { operations: JSON.parse(JSON.stringify(ops)) }));
  assert.deepEqual(a, b);
  success(await call(root, 'batch/apply', receipt(a)));
  const entity = success(await call(root, 'entry/get', { id: '__proto__' })).entity;
  assert.ok(Object.hasOwn(entity.value, '__proto__'));
  assert.deepEqual(entity.value.__proto__, { retained: true });
  assert.equal(entity.value.constructor, 'data');
  assert.equal(({} as Record<string, unknown>).retained, undefined);
});

test('lock, retained journal, symlinks, nested temp directories and schema errors fail closed', async () => {
  const root = await fixture();
  const good = receipt(success(await call(root, 'batch/check', { operations })));
  for (const file of [path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME), path.join(root, BATCH_JOURNAL_FILENAME)]) {
    await writeFile(file, '{}');
    const before = await tree(root);
    failure(await call(root, 'batch/check', { operations }));
    failure(await call(root, 'batch/apply', good));
    assert.deepEqual(await tree(root), before);
    await unlink(file);
  }
  const link = path.join(root, '.SNL_Doc', 'unsafe');
  await symlink('/tmp', link);
  const before = await tree(root);
  failure(await call(root, 'batch/check', { operations }), 'workspace.unsafe-path', 2);
  failure(await call(root, 'batch/apply', good), 'workspace.unsafe-path', 2);
  assert.deepEqual(await tree(root), before); await unlink(link);
  const prior = process.env.TMPDIR;
  try { process.env.TMPDIR = root; failure(await call(root, 'batch/check', { operations }), 'batch.unsafe-temp-directory', 2); }
  finally { if (prior === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = prior; }
  const file = path.join(root, '.SNL_Doc', 'config.json');
  const config = JSON.parse(await readFile(file, 'utf8')); config.version = '99.0.0'; await writeFile(file, JSON.stringify(config));
  const invalid = await tree(root);
  failure(await call(root, 'batch/check', { operations }), 'workspace.unsupported-schema', 2);
  assert.deepEqual(await tree(root), invalid);
});

test('unsupported publication platform and missing python fail before exchange with no residue', async () => {
  const root = await fixture();
  const checked = success(await call(root, 'batch/check', { operations }));
  const before = await tree(root);
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  try {
    Object.defineProperty(process, 'platform', { ...platform, value: 'darwin' });
    failure(await call(root, 'batch/apply', receipt(checked)), 'batch.publication-unsupported', 2);
  } finally { Object.defineProperty(process, 'platform', platform); }
  assert.deepEqual(await tree(root), before);
  const oldPath = process.env.PATH;
  try {
    process.env.PATH = '/nonexistent-snl-batch-test';
    failure(await call(root, 'batch/apply', receipt(checked)), 'workspace.operation-failed', 2);
  } finally { if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath; }
  assert.deepEqual(await tree(root), before);
});

for (const seam of ['beforeExchange', 'afterExchange', 'beforeParentSync', 'readback', 'fsync'] as const) {
  test(`injected ${seam} failure restores exact bytes/modes and leaves no lock, journal or stage`, async () => {
    const root = await fixture();
    await chmod(path.join(root, '.SNL_Doc', 'config.json'), 0o640);
    const checked = success(await call(root, 'batch/check', { operations }));
    const before = await tree(root);
    let invoked = false;
    const fault = async () => { invoked = true; throw Error(`injected ${seam}`); };
    let hooks: Parameters<typeof applyBatch>[4];
    if (seam === 'readback') hooks = { afterExchange: async () => {
      invoked = true;
      // Valid extra file changes the revision without relying on a validation failure.
      await writeFile(path.join(root, '.SNL_Doc', 'unexpected.txt'), 'readback corruption');
    } };
    else if (seam === 'fsync') hooks = { beforeParentSync: async () => {
      const open = fs.open;
      mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
        const handle = await open(...args);
        if (!invoked && args[0] === root) { invoked = true; handle.sync = async () => { throw Error('injected fsync'); }; }
        return handle;
      });
    } };
    else hooks = { [seam]: fault };
    await assert.rejects(applyBatch(root, checked.normalizedOperations, checked.checkedDigest, checked.expectedWorkspaceRevision, hooks), /injected|Published workspace/);
    mock.restoreAll(); syncBuiltinESMExports();
    assert.equal(invoked, true);
    assert.deepEqual(await tree(root), before);
  });
}

test('uncertain rollback retains complete candidate, lock/journal/stage and blocks ordinary CRUD', async () => {
  const root = await fixture(); const checked = success(await call(root, 'batch/check', { operations }));
  await assert.rejects(applyBatch(root, checked.normalizedOperations, checked.checkedDigest, checked.expectedWorkspaceRevision, {
    afterExchange: async () => {
      const stat = fs.stat;
      mock.method(fs, 'stat', async (...args: Parameters<typeof fs.stat>) => { if (args[0] === path.join(root, '.SNL_Doc')) throw Error('rollback unavailable'); return stat(...args); });
      throw Error('primary fault');
    },
  }), (error: any) => error.code === 'batch.recovery-required');
  mock.restoreAll(); syncBuiltinESMExports();
  const journal = JSON.parse(await readFile(path.join(root, BATCH_JOURNAL_FILENAME), 'utf8'));
  assert.ok(journal.stage.startsWith(root + '/.snl-batch-'));
  assert.ok(await readFile(path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME)));
  assert.ok(await readFile(path.join(journal.stage, '.SNL_Doc', 'config.json')));
  const before = await tree(root);
  await assert.rejects(createManagedEntity(root, 'entry', { id: 'blocked', kind: 'definition' }), /batch recovery required/);
  assert.deepEqual(await tree(root), before);
  assert.deepEqual(success(await call(root, 'entry/get', { id: 'batch.dependent' })).entity.value.tags, tags);
});

test('committed backup and lock cleanup failures must never be reported as uncommitted', async () => {
  for (const kind of ['backup', 'lock']) {
    const root = await fixture(); const checked = success(await call(root, 'batch/check', { operations }));
    const hooks = { afterExchange: async () => {
      if (kind === 'backup') {
        const remove = fs.rm;
        mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => { if (String(args[0]).startsWith(root + '/.snl-batch-')) throw Error('backup cleanup fault'); return remove(...args); });
      } else {
        const remove = fs.unlink;
        mock.method(fs, 'unlink', async (...args: Parameters<typeof fs.unlink>) => { if (args[0] === path.join(root, '.SNL_Doc', DATA_WRITE_LOCK_FILENAME)) throw Error('lock cleanup fault'); return remove(...args); });
        syncBuiltinESMExports();
      }
    } };
    if (kind === 'backup') {
      const applied = await applyBatch(root, checked.normalizedOperations, checked.checkedDigest, checked.expectedWorkspaceRevision, hooks);
      assert.ok(applied.diagnostics.some(i => i.code === 'batch.backup-cleanup-failed'));
      assert.ok(applied.recoveryPath);
    } else {
      await assert.rejects(applyBatch(root, checked.normalizedOperations, checked.checkedDigest, checked.expectedWorkspaceRevision, hooks), (error: any) => error.code === 'batch.committed-cleanup-failed' && typeof error.details.resultingWorkspaceRevision === 'string');
    }
    mock.restoreAll(); syncBuiltinESMExports();
    assert.deepEqual(success(await call(root, 'entry/get', { id: 'batch.dependent' })).entity.value.tags, tags);
    await assert.rejects(readFile(path.join(root, BATCH_JOURNAL_FILENAME)), { code: 'ENOENT' });
  }
});
