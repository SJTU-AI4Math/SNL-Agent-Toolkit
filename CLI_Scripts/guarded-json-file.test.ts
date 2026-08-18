import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { installNewJson, removeJsonIfUnchanged, replaceJsonIfUnchanged } from '../lib/guarded-json-file.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function scratch(): Promise<{ root: string; file: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-guarded-json-'));
  roots.push(root);
  return { root, file: path.join(root, 'entity.json') };
}

describe('guarded JSON path capture', () => {
  it('restores a replacement that lands at the last pre-capture seam', async () => {
    const { file } = await scratch();
    const original = '{"owner":"original"}\n';
    const external = '{"owner":"external"}\n';
    await writeFile(file, original);
    await assert.rejects(
      () => replaceJsonIfUnchanged(file, original, { owner: 'mine' }, {
        beforeCapture: async () => writeFile(file, external),
      }),
      /changed.*refusing/i,
    );
    assert.equal(await readFile(file, 'utf8'), external);
  });

  it('never overwrites a new canonical file created after capture', async () => {
    const { root, file } = await scratch();
    const original = '{"owner":"original"}\n';
    const external = '{"owner":"external"}\n';
    await writeFile(file, original);
    await assert.rejects(
      () => replaceJsonIfUnchanged(file, original, { owner: 'mine' }, {
        afterCapture: async () => writeFile(file, external),
      }),
      /captured file was preserved|changed while installing/i,
    );
    assert.equal(await readFile(file, 'utf8'), external);
    const recovery = (await readdir(root)).find((name) => name.endsWith('.captured'));
    assert.ok(recovery);
    assert.equal(await readFile(path.join(root, recovery), 'utf8'), original);
  });

  it('removes a newly linked file when directory fsync fails before create commit', async () => {
    const { root, file } = await scratch();
    await assert.rejects(
      () => installNewJson(file, { owner: 'mine' }, {
        beforeDirectorySync: async () => { throw new Error('injected directory fsync failure'); },
      }),
      /injected directory fsync failure/,
    );
    assert.deepEqual(await readdir(root), []);
  });

  it('rolls back a replacement when directory fsync fails before commit', async () => {
    const { root, file } = await scratch();
    const original = '{"owner":"original"}\n';
    await writeFile(file, original);
    await assert.rejects(
      () => replaceJsonIfUnchanged(file, original, { owner: 'mine' }, {
        beforeDirectorySync: async () => { throw new Error('injected directory fsync failure'); },
      }),
      /injected directory fsync failure/,
    );
    assert.equal(await readFile(file, 'utf8'), original);
    assert.deepEqual(await readdir(root), ['entity.json']);
  });

  it('restores a removed file when directory fsync fails before commit', async () => {
    const { root, file } = await scratch();
    const original = '{"owner":"original"}\n';
    await writeFile(file, original);
    await assert.rejects(
      () => removeJsonIfUnchanged(file, original, {
        beforeDirectorySync: async () => { throw new Error('injected directory fsync failure'); },
      }),
      /injected directory fsync failure/,
    );
    assert.equal(await readFile(file, 'utf8'), original);
    assert.deepEqual(await readdir(root), ['entity.json']);
  });

  it('removes only the captured original while preserving a post-capture replacement', async () => {
    const { file } = await scratch();
    const original = '{"owner":"original"}\n';
    const external = '{"owner":"external"}\n';
    await writeFile(file, original);
    await removeJsonIfUnchanged(file, original, {
      afterCapture: async () => writeFile(file, external),
    });
    assert.equal(await readFile(file, 'utf8'), external);
  });
});
