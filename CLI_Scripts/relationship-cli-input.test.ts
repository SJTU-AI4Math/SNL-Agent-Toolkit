import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('relationship CLI rejects duplicate JSON keys before operation scope validation', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'snl-relationship-input-'));
  try {
    const input = path.join(directory, 'request.json');
    for (const source of [
      '{"scope":{},"scope":{"entryIds":[]},"dryRun":true}',
      '{"scope":{},"dryRun":false,"dryRun":true}',
      '{"scope":{"x":1,"x":2},"dryRun":true}',
      '{"scope":{}, /* comment */ "dryRun":true}',
      '{"scope":{},"dryRun":true,}',
    ]) {
      await writeFile(input, source);
      const result = spawnSync(process.execPath, ['dist/cli/snl.mjs', '--root', directory, '--json', 'relationship', 'generate', '--input', input], { encoding: 'utf8' });
      assert.equal(result.status, 2, result.stderr || result.stdout);
      assert.equal(JSON.parse(result.stdout).error.code, 'input.invalid-json', result.stdout);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});