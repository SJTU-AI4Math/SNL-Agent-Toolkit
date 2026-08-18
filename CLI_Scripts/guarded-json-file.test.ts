import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
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

  it('rejects an identical-byte inode replacement before replace capture', async () => {
    const { root, file } = await scratch();
    const parked = path.join(root, 'parked.json');
    const original = '{"owner":"same"}\n';
    await writeFile(file, original);
    await assert.rejects(
      () => replaceJsonIfUnchanged(file, original, { owner: 'mine' }, {
        beforeCapture: async () => {
          await rename(file, parked);
          await writeFile(file, original);
        },
      }),
      /changed.*refusing/i,
    );
    assert.equal(await readFile(file, 'utf8'), original);
    assert.equal(await readFile(parked, 'utf8'), original);
  });

  it('rejects an identical-byte inode replacement before remove capture', async () => {
    const { root, file } = await scratch();
    const parked = path.join(root, 'parked.json');
    const original = '{"owner":"same"}\n';
    await writeFile(file, original);
    await assert.rejects(
      () => removeJsonIfUnchanged(file, original, {
        beforeCapture: async () => {
          await rename(file, parked);
          await writeFile(file, original);
        },
      }),
      /changed.*refusing/i,
    );
    assert.equal(await readFile(file, 'utf8'), original);
    assert.equal(await readFile(parked, 'utf8'), original);
  });

  it('rejects a parent directory replaced by an identical symlink target before capture', async () => {
    const { root } = await scratch();
    const live = path.join(root, 'live');
    const parked = path.join(root, 'parked');
    const external = path.join(root, 'external');
    await mkdir(live);
    await mkdir(external);
    const file = path.join(live, 'entity.json');
    const original = '{"owner":"same"}\n';
    await writeFile(file, original);
    await writeFile(path.join(external, 'entity.json'), original);
    await assert.rejects(
      () => replaceJsonIfUnchanged(file, original, { owner: 'mine' }, {
        beforeCapture: async () => {
          await rename(live, parked);
          await symlink(external, live, 'dir');
        },
      }),
      /canonical|symlink/i,
    );
    assert.equal(await readFile(path.join(external, 'entity.json'), 'utf8'), original);
  });

  it('restores an external file when the parent becomes a symlink after the final pre-capture check', async () => {
    const { root } = await scratch();
    const live = path.join(root, 'live-after-check');
    const parked = path.join(root, 'parked-after-check');
    const external = path.join(root, 'external-after-check');
    await mkdir(live);
    await mkdir(external);
    const file = path.join(live, 'entity.json');
    const original = '{"owner":"same"}\n';
    await writeFile(file, original);
    await writeFile(path.join(external, 'entity.json'), original);
    await assert.rejects(
      () => removeJsonIfUnchanged(file, original, {
        afterParentCheckBeforeCapture: async () => {
          await rename(live, parked);
          await symlink(external, live, 'dir');
        },
      }),
      /canonical|symlink|replacement directory/i,
    );
    assert.equal(await readFile(path.join(external, 'entity.json'), 'utf8'), original);
    assert.equal(await readFile(path.join(parked, 'entity.json'), 'utf8'), original);
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

  it('does not report private temp cleanup failure after create commits', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'snl-guarded-cleanup-'));
    roots.push(root);
    const file = path.join(root, 'created.json');
    try {
      await installNewJson(file, { owner: 'committed' }, {
        beforeDirectorySync: async () => { await chmod(root, 0o555); },
      });
    } finally {
      await chmod(root, 0o755);
    }
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { owner: 'committed' });
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
