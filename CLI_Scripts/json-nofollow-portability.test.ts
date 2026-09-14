import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
for (const module of ['guarded-json-file', 'snl-doc']) {
  test(`JSON leaf guards work without native O_NOFOLLOW (${module})`, async () => {
    const temp = await mkdtemp(path.join(tmpdir(), 'snl-json-nofollow-'));
    try {
      const output = path.join(temp, 'reader.cjs');
      // Platform fault injection on real production sources and real filesystem I/O.
      // This emulates an absent native flag, not execution on Windows itself.
      await build({ entryPoints: [path.resolve('lib', module + '.ts')], outfile: output,
        bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
        plugins: [{ name: 'no-native-nofollow', setup(builder) {
          builder.onLoad({ filter: /[\\/](guarded-json-file|snl-doc)\.ts$/ }, async args => ({
            contents: (await readFile(args.path, 'utf8')).replaceAll('constants.O_NOFOLLOW', '0'), loader: 'ts'
          }));
        } }] });
      const reader = require(output);
      const workspace = path.join(temp, 'workspace');
      await mkdir(path.join(workspace, '.SNL_Doc'), { recursive: true });
      const file = path.join(workspace, '.SNL_Doc', 'config.json');
      const outside = path.join(temp, 'outside.json');
      const text = JSON.stringify({ version: '0.0.0', marker: 'outside' });
      await writeFile(file, text); await writeFile(outside, text);
      const read = () => module === 'snl-doc' ? reader.readConfig(workspace) : reader.readRegularText(file);
      assert.ok(await read(), 'normal regular file is readable');
      await rm(file); await symlink(outside, file);
      await assert.rejects(read, /regular|symlink|changed/i);
      assert.equal(await readFile(outside, 'utf8'), text);
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
}
