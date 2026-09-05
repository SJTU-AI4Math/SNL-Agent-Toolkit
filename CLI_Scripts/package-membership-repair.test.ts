import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, it } from 'node:test';
import { createManagedEntity, validateManagedWorkspace } from '../lib/entity-crud.ts';
import { entryEntityPath, packageManifestPath } from '../lib/entity-storage.ts';
import { readEntries } from '../lib/snl-doc.ts';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'snl-repair-'));
  roots.push(root);
  await fs.cp(path.join(import.meta.dirname, 'fixtures/workspace-v0.1.0/.SNL_Doc'), path.join(root, '.SNL_Doc'), { recursive: true });
  for (const packageId of ['_unpackaged', 'Logic']) {
    for (const suffix of ['Z', 'a']) {
      const id = `${packageId}.${suffix}`;
      const created = await createManagedEntity(root, 'entry', {
        id, package: packageId, kind: 'definition', title: id,
        content: {}, contribution_info: null, pointer: null,
      });
      assert.equal(created.status, 'ok');
    }
  }
  for (const packageId of ['_unpackaged', 'Logic']) {
    await mutate(manifestFile(root, packageId), value => {
      value.entry_ids = (value.entry_ids as string[]).sort((a, b) => a.localeCompare(b, 'en'));
      value.vendor_extension = { retained: packageId };
    });
  }
  return root;
}

function manifestFile(root: string, id: string): string {
  return path.join(root, '.SNL_Doc', packageManifestPath(id));
}
async function mutate(file: string, update: (value: Record<string, any>) => void): Promise<void> {
  const value = JSON.parse(await fs.readFile(file, 'utf8'));
  update(value);
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function repair(root: string, id: string) {
  return executeOperation({ protocol: OPERATION_PROTOCOL, command: 'repair/package-entry-ids', root, arguments: { id } });
}
async function snapshot(root: string): Promise<Record<string, string>> {
  const doc = path.join(root, '.SNL_Doc');
  const files = await fs.readdir(doc, { recursive: true, withFileTypes: true });
  const result: Record<string, string> = {};
  for (const file of files.filter(file => file.isFile())) {
    const absolute = path.join(file.parentPath, file.name);
    result[path.relative(doc, absolute)] = await fs.readFile(absolute, 'utf8');
  }
  return result;
}

it('public repair is incremental and idempotent while another Package remains locale-sorted', async () => {
  const root = await fixture();
  const before = await snapshot(root);
  await assert.rejects(readEntries(root), /sorted array/);
  const first = await repair(root, '_unpackaged');
  assert.equal(first.exitCode, 0, JSON.stringify(first.response));
  assert.equal(first.response.ok, true);
  const afterFirst = await snapshot(root);
  const target = packageManifestPath('_unpackaged');
  const original = JSON.parse(before[target]);
  assert.deepEqual(JSON.parse(afterFirst[target]), { ...original, entry_ids: [...original.entry_ids].sort() });
  assert.deepEqual({ ...afterFirst, [target]: before[target] }, before);
  const retry = await repair(root, '_unpackaged');
  assert.equal(retry.exitCode, 0, JSON.stringify(retry.response));
  assert.deepEqual(await snapshot(root), afterFirst);
  await assert.rejects(readEntries(root), /sorted array/);
  const second = await repair(root, 'Logic');
  assert.equal(second.exitCode, 0, JSON.stringify(second.response));
  assert.equal((await readEntries(root)).length, 5);
  assert.equal((await validateManagedWorkspace(root)).valid, true);
});

it('built unified CLI repairs multiple Packages and validates without Entry-read cascades', async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, '.SNL_Doc/relationships.json'), JSON.stringify({
    version: 1, relationships: [{ id: 'valid', from: 'entry.localized', to: 'entry.localized', label: 'uses_context' }],
  }));
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [path.join(import.meta.dirname, '../dist/cli/snl.mjs'), '--root', root, '--json', ...args], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.stderr, '');
    return { status: result.status, response: JSON.parse(result.stdout) };
  };
  const invalid = run('validate');
  assert.equal(invalid.status, 1);
  assert.equal(invalid.response.error.details.valid, false);
  const codes = invalid.response.error.details.issues.map((issue: { code: string }) => issue.code);
  assert.ok(codes.includes('entry.read-failed'));
  assert.equal(codes.some((code: string) => code.startsWith('relationship.dangling-')), false);
  assert.equal(run('repair', 'package-entry-ids', '_unpackaged').status, 0);
  assert.equal(run('repair', 'package-entry-ids', '_unpackaged').response.data.changed, false);
  assert.equal(run('entry', 'list').status, 2, 'Ordinary reads must stay strict until every index is sorted');
  assert.equal(run('repair', 'package-entry-ids', 'Logic').status, 0);
  const valid = run('validate');
  assert.equal(valid.status, 0);
  assert.equal(valid.response.data.valid, true);
});

const corruptions: Array<[string, (root: string) => Promise<void>, RegExp]> = [
  ['Entry schema', root => mutate(path.join(root, '.SNL_Doc', entryEntityPath('Logic', 'Logic.Z')), value => { value.schema_version = 2; }), /canonical Entry envelope/],
  ['Entry payload', root => mutate(path.join(root, '.SNL_Doc', entryEntityPath('Logic', 'Logic.Z')), value => { delete value.entry.pointer; }), /Entry payload/],
  ['Entry Kind', root => mutate(path.join(root, '.SNL_Doc', entryEntityPath('Logic', 'Logic.Z')), value => { value.entry.kind = 'missing'; }), /missing Entry Kind/],
  ['Entry owner', root => mutate(path.join(root, '.SNL_Doc', entryEntityPath('Logic', 'Logic.Z')), value => { value.entry.package = '_unpackaged'; }), /canonical Entry envelope/],
  ['Entry path', root => fs.rename(path.join(root, '.SNL_Doc', entryEntityPath('Logic', 'Logic.Z')), path.join(root, '.SNL_Doc/entries/wrong.json')), /does not match Entry identity/],
  ['duplicate Entry identity', async root => {
    const source = path.join(root, '.SNL_Doc', entryEntityPath('Logic', 'Logic.Z'));
    const envelope = JSON.parse(await fs.readFile(source, 'utf8'));
    envelope.package = envelope.entry.package = '_unpackaged';
    await fs.writeFile(path.join(root, '.SNL_Doc', entryEntityPath('_unpackaged', 'Logic.Z')), JSON.stringify(envelope));
  }, /Duplicate Entry identity/],
  ['Package schema', root => mutate(manifestFile(root, 'Logic'), value => { value.schema_version = 3; }), /Package manifest schema_version/],
  ['Package path', root => mutate(manifestFile(root, 'Logic'), value => { value.id = 'Other'; }), /logical identity path/],
  ['Package membership', root => mutate(manifestFile(root, 'Logic'), value => { value.entry_ids.pop(); }), /does not exactly match/],
  ['duplicate membership', root => mutate(manifestFile(root, 'Logic'), value => { value.entry_ids.push(value.entry_ids[0]); }), /unique/],
  ['invalid membership type', root => mutate(manifestFile(root, 'Logic'), value => { value.entry_ids = null; }), /array/],
  ['topology receipt', root => mutate(path.join(root, '.SNL_Doc/config.json'), value => { value.entity_storage.receipt.entry_count = 99; }), /receipt/],
];
for (const [name, corrupt, expected] of corruptions) {
  it(`repair fails closed and restores the target for non-order corruption: ${name}`, async () => {
    const root = await fixture();
    await corrupt(root);
    const before = await snapshot(root);
    const result = await repair(root, '_unpackaged');
    assert.notEqual(result.exitCode, 0);
    assert.equal(result.response.ok, false);
    assert.match(JSON.stringify(result.response), expected);
    assert.deepEqual(await snapshot(root), before);
  });
}

for (const foreignEdit of [false, true]) {
  it(`revalidates Entry payload after installation; rollback respects foreign target edits=${foreignEdit}`, async t => {
    const root = await fixture();
    const file = manifestFile(root, '_unpackaged');
    const before = await fs.readFile(file, 'utf8');
    const link = fs.link;
    let injected = false;
    let foreign = '';
    t.mock.method(fs, 'link', async (...args: Parameters<typeof fs.link>) => {
      await link(...args);
      if (!injected && args[1] === file && String(args[0]).endsWith('.tmp')) {
        injected = true;
        await mutate(path.join(root, '.SNL_Doc', entryEntityPath('Logic', 'Logic.Z')), value => { delete value.entry.pointer; });
        if (foreignEdit) {
          await mutate(file, value => { value.foreign = 'retain me'; });
          foreign = await fs.readFile(file, 'utf8');
        }
      }
    });
    const result = await repair(root, '_unpackaged');
    assert.equal(injected, true);
    assert.notEqual(result.exitCode, 0);
    assert.match(JSON.stringify(result.response), foreignEdit ? /changed concurrently/ : /Entry payload/);
    assert.equal(await fs.readFile(file, 'utf8'), foreignEdit ? foreign : before);
    assert.equal((await fs.readdir(path.dirname(file))).some(name => name.includes('.snl-write-')), false);
  });
}

it('repair preserves a concurrent manifest replacement at the CAS capture seam', async t => {
  const root = await fixture();
  const file = manifestFile(root, '_unpackaged');
  const rename = fs.rename;
  let injected = false;
  let foreign = '';
  t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (!injected && args[0] === file && String(args[1]).endsWith('.captured')) {
      injected = true;
      await mutate(file, value => { value.foreign = 'retain me'; });
      foreign = await fs.readFile(file, 'utf8');
    }
    return rename(...args);
  });
  const result = await repair(root, '_unpackaged');
  assert.equal(injected, true);
  assert.notEqual(result.exitCode, 0);
  assert.match(JSON.stringify(result.response), /changed concurrently/);
  assert.equal(await fs.readFile(file, 'utf8'), foreign);
});

it('repair honors the shared writer lock without changing data', async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, '.SNL_Doc/.data-write.lock'), 'another writer');
  const before = await snapshot(root);
  const result = await repair(root, '_unpackaged');
  assert.notEqual(result.exitCode, 0);
  assert.match(JSON.stringify(result.response), /locked/);
  assert.deepEqual(await snapshot(root), before);
});

for (const relative of ['entries', 'packages', entryEntityPath('Logic', 'Logic.Z'), packageManifestPath('_unpackaged')]) {
  it(`repair refuses unsafe symlink input: ${relative}`, async () => {
    const root = await fixture();
    const target = path.join(root, '.SNL_Doc', relative);
    const saved = path.join(root, 'outside');
    await fs.rename(target, saved);
    await fs.symlink(saved, target);
    const original = await snapshot(root);
    const result = await repair(root, '_unpackaged');
    assert.notEqual(result.exitCode, 0);
    assert.match(JSON.stringify(result.response), /symlink/);
    assert.deepEqual(await snapshot(root), original);
  });
}
