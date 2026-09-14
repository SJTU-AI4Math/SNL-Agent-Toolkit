import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
const supportUrl = new URL('../scripts/publisher-test-support.mjs', import.meta.url).href;
const { cleanEnvironment, privateNpm, authorNonemptyFixture } = await import(supportUrl);

test('installed harness clears inherited npm/global/prefix and custom adapter configuration', () => {
  const injected = { npm_config_global: 'true', NPM_CONFIG_PREFIX: '/not-a-consumer', npm_package_json: '/not-a-manifest',
    npm_config_userconfig: '/not-a-config', SNL_ENTITY_ADAPTER_MODULE: '/not-the-shipped-adapter', PREFIX: '/not-a-prefix', NODE_PATH: '/not-dependencies', INIT_CWD: '/not-the-consumer' };
  const before = { ...process.env };
  try {
    Object.assign(process.env, injected);
    const env = cleanEnvironment();
    for (const key of Object.keys(injected)) assert.equal(Object.hasOwn(env, key), false, key);
    assert.equal(env.UV_THREADPOOL_SIZE, process.env.UV_THREADPOOL_SIZE, 'admission pool limits retained');
    assert.equal(env.NODE_OPTIONS, process.env.NODE_OPTIONS, 'admission worker limits retained');
  } finally {
    for (const key of Object.keys(injected)) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
  }
});

test('installed harness refuses npm until a private consumer manifest exists', async () => {
  for (const metadata of [undefined, { name: 'not-private', version: '1.0.0' }]) {
    const root = await mkdtemp(path.join(tmpdir(), 'snl-npm-admission-'));
    try {
      if (metadata) await writeFile(path.join(root, 'package.json'), JSON.stringify(metadata));
      await assert.rejects(privateNpm(root));
      await assert.rejects(readFile(path.join(root, 'package-lock.json')), { code: 'ENOENT' });
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test('public batch installed fixture has a nonempty canonical-winner graph and reachable system Macro', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-native-fixture-'));
  const op = async (command: string, args: Record<string, unknown>) => {
    const result = await executeOperation({ protocol: OPERATION_PROTOCOL, root, command, arguments: args });
    assert.equal(result.exitCode, 0, JSON.stringify(result.response)); assert.ok(result.response.ok);
    return result.response.data as Record<string, any>;
  };
  try {
    await op('init', {});
    await authorNonemptyFixture(op);
    const system = (await op('macro/get', { id: '_unpackaged::ParitySystem' })).entity;
    assert.deepEqual(system.value.source.entries, ['parity.system']);
    const result = await op('relationship/generate', { scope: {}, dryRun: true });
    assert.deepEqual(result.generated.map((e: any) => [e.from, e.to]), [['parity.source', 'parity.z']]);
    const config = JSON.parse(await readFile(path.join(root, '.SNL_Doc/config.json'), 'utf8'));
    assert.ok(config.active_macro_packages.includes('ParityA'));
    assert.ok(config.active_macro_packages.includes('ParityZ'));
    assert.ok(!config.active_macro_packages.includes('_unpackaged'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
