import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
import { readActiveMacros, readAllMacroPackages } from '../lib/snl-doc.ts';
const { authorNonemptyFixture } = await import(new URL('../scripts/publisher-test-support.mjs', import.meta.url).href);
const { activationCases, setupActivation, authoringHashes } = await import(new URL('../scripts/publisher-activation-fixture.mjs', import.meta.url).href);

test('effective Macro activation excludes system without changing strict management catalogs or authored bytes', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'snl-activation-'));
  const root = await mkdtemp(path.join(parent, 'fixture-'));
  const op = async (command: string, args: Record<string, unknown>) => {
    const r = await executeOperation({ protocol: OPERATION_PROTOCOL, root, command, arguments: args });
    assert.ok(r.response.ok, JSON.stringify(r)); return r.response.data as any;
  };
  try {
    await op('init', {}); await authorNonemptyFixture(op);
    const initial = (await op('macro/list', { limit: 1000 })).entities;
    const catalog = await readAllMacroPackages(root);
    for (const [label, activation] of activationCases) {
      await setupActivation(root, parent, activation);
      const before = await authoringHashes(root);
      if (activation?.includes('_unpackaged')) {
        await assert.rejects(readActiveMacros(root), /cannot activate.*_unpackaged/);
        continue;
      }
      const active = await readActiveMacros(root);
      assert.equal(Object.hasOwn(active, 'ParitySystem'), false, label);
      assert.deepEqual(await readAllMacroPackages(root), catalog);
      assert.deepEqual((await op('macro/list', { limit: 1000 })).entities, initial, 'CRUD identities, revisions and unknown fields unchanged');
      const expected = label === 'empty' ? [] : [['parity.source', label === 'regular-a' ? 'parity.a' : 'parity.z']];
      const preview = await op('relationship/generate', { scope: {}, dryRun: true });
      assert.deepEqual(preview.generated.map((e: any) => [e.from, e.to]), expected, label);
      await op('relationship/generate', { scope: {}, expectedWorkspaceRevision: preview.expectedWorkspaceRevision });
      assert.deepEqual(await authoringHashes(root), before);
    }
  } finally { await rm(parent, { recursive: true, force: true }); }
});
