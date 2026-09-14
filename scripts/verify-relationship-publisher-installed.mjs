// Run after prepack, under the shared verify.py admission lock.
// argv: fresh evidence directory, independent read-only fixed76 Extension clone.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { run, cleanEnvironment, protectedHashes, privateNpm, authorNonemptyFixture, sha256 } from './publisher-test-support.mjs';
import { buildNativeReader, reuseNativeReader, nativeReadback } from './publisher-native-reader.mjs';
import { setupActivation, authoringHashes } from './publisher-activation-fixture.mjs';
const repo = path.resolve(import.meta.dirname, '..');
const evidence = path.resolve(process.argv[2]); await mkdir(evidence, { recursive: true });
const protectedBefore = await protectedHashes(repo);
await writeFile(path.join(evidence, 'protected-before.json'), JSON.stringify(protectedBefore, null, 2));
let result;
try {
  const consumer = await mkdtemp(path.join(evidence, 'consumer-'));
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'snl-publisher-independent-consumer', version: '1.0.0', private: true, type: 'module' }), { flag: 'wx' });
  const { npm, ...npmIsolation } = await privateNpm(consumer);
  const packed = JSON.parse(npm(['pack', repo, '--ignore-scripts', '--json', '--pack-destination', evidence]))[0];
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(evidence, packed.filename)]);
  assert.equal(npm(['prefix']).trim(), consumer);
  const installed = path.join(consumer, 'node_modules/@snl-doc/agent-toolkit');
  assert.equal(await realpath(installed), installed);
  const closure = {};
  for (const relative of ['dist/cli/snl.mjs', 'dist/mcp/server.cjs', 'dist/dsh/adapter.mjs', 'agent-plugin/dist/mcp/server.cjs',
    'lib/relationship-publisher.ts', 'lib/dependency-cache-descriptor.ts', 'lib/dependency-cache-storage.ts', 'lib/snl-doc.ts']) {
    const source = await readFile(path.join(repo, relative));
    const unpacked = Buffer.from(run('tar', ['-xOf', path.join(evidence, packed.filename), `package/${relative}`]));
    assert.deepEqual(await readFile(path.join(installed, relative)), source, relative);
    assert.deepEqual(unpacked, source, `tarball ${relative}`);
    closure[relative] = sha256(source);
  }
  const { native, receipt: nativeSource } = process.argv[4]
    ? await reuseNativeReader(path.resolve(process.argv[4]))
    : await buildNativeReader(path.resolve(process.argv[3]), evidence);
  await writeFile(path.join(evidence, 'native-source-receipt.json'), JSON.stringify(nativeSource, null, 2));
  const root = path.join(consumer, 'workspace'); await mkdir(root);
  const cli = path.join(installed, 'dist/cli/snl.mjs');
  function command(args, input) {
    return JSON.parse(run(process.execPath, [cli, ...args, '--root', root, '--json'], {
      cwd: consumer, input: input === undefined ? undefined : JSON.stringify(input),
    }));
  }
  const op = async (cmd, args) => {
    const tokens = cmd.split('/');
    if (cmd === 'batch/check') return command([...tokens, '--input', '-'], args.operations).data;
    if (cmd === 'batch/apply') return command([...tokens, '--input', '-'], args).data;
    if (tokens[1] === 'list') return command([...tokens, '--limit', String(args.limit)]).data;
    if (tokens[1] === 'get') return command([...tokens, args.id]).data;
    if (tokens[1] === 'update') return command([...tokens, args.id, '--if-match', args.expectedRevision, '--input', '-'], args.value).data;
    if (cmd === 'validate') return command(['validate']).data;
    throw new Error(`Unimplemented fixture CLI mapping: ${cmd}`);
  };
  command(['init']);
  const authoring = await authorNonemptyFixture(op);
  await writeFile(path.join(evidence, 'public-authoring-receipts.json'), JSON.stringify(authoring, null, 2));
  const activationSetup = await setupActivation(root, evidence, undefined);
  await writeFile(path.join(evidence, 'activation-setup.json'), JSON.stringify(activationSetup, null, 2));
  const authoringBefore = await authoringHashes(root);
  assert.ok(command(['--help']).data.commands.includes('relationship/generate'));
  assert.ok(command(['relationship']).data.some(d => d.command === 'relationship/generate' && d.arguments.scope.required));
  const preview = command(['relationship', 'generate', '--scope', '{}', '--dry-run']).data;
  assert.equal(preview.published, false); assert.ok(preview.generated.length > 0);
  assert.deepEqual(preview.generated.map(e => [e.from, e.to]), [['parity.source', 'parity.z']]);
  const applied = command(['relationship', 'generate', '--scope', '{}', '--if-workspace-match', preview.expectedWorkspaceRevision]).data;
  assert.equal(applied.published, true); assert.equal(applied.resultingWorkspaceRevision, preview.expectedWorkspaceRevision);
  assert.equal(command(['relationship', 'generate', '--input', '-'], { scope: {}, dryRun: true }).data.inputHash, preview.inputHash);
  const nativeReceipts = { cli: await nativeReadback(native, root, applied) };
  const cache = path.join(root, '.SNL_Doc/.cache/dependencies/result.json');
  const before = await readFile(cache, 'utf8');
  for (const bad of [{ scope: {}, dryRun: null }, { scope: { local: true }, dryRun: true }]) {
    const r = spawnSync(process.execPath, [cli, 'relationship', 'generate', '--input', '-', '--root', root, '--json'], {
      cwd: consumer, env: cleanEnvironment(), input: JSON.stringify(bad), encoding: 'utf8', timeout: 120000,
    });
    assert.equal(r.status, 2); assert.equal(JSON.parse(r.stdout).error.code, 'operation.invalid-arguments');
  }
  assert.equal(await readFile(cache, 'utf8'), before);
  for (const relative of ['dist/mcp/server.cjs', 'agent-plugin/dist/mcp/server.cjs']) {
    await rm(cache); // Must publish anew, not merely report an existing artifact.
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'snl_execute', arguments: {
      root, command: 'relationship/generate', arguments: { scope: {}, expectedWorkspaceRevision: preview.expectedWorkspaceRevision },
    } } };
    const text = run(process.execPath, [path.join(installed, relative)], { cwd: consumer, input: JSON.stringify(request) + '\n' });
    const response = JSON.parse(text.trim()).result.structuredContent;
    assert.equal(response.ok, true, text); assert.equal(response.data.published, true); assert.ok(response.data.generated.length > 0);
    const label = relative.startsWith('agent') ? 'agent-mcp' : 'mcp';
    nativeReceipts[label] = await nativeReadback(native, root, response.data);
    await writeFile(path.join(evidence, `${label}.json`), text);
  }
  delete process.env.SNL_ENTITY_ADAPTER_MODULE; // DSH runs in-process; do not inherit a custom adapter.
  const { apply } = await import(pathToFileURL(path.join(installed, 'dist/dsh/adapter.mjs')).href);
  const tools = []; await apply({ tools: { register(tool) { tools.push(tool); } } });
  const execute = tools.find(t => t.name === 'snl_execute'); assert.ok(execute);
  await rm(cache);
  const dsh = await execute.execute({ root, command: 'relationship/generate', arguments: {
    scope: {}, expectedWorkspaceRevision: preview.expectedWorkspaceRevision,
  } }, { signal: new AbortController().signal });
  assert.equal(dsh.ok, true); assert.equal(dsh.data.published, true); assert.ok(dsh.data.generated.length > 0);
  nativeReceipts.dsh = await nativeReadback(native, root, dsh.data);
  const stale = await execute.execute({ root, command: 'relationship/generate', arguments: {
    scope: {}, expectedWorkspaceRevision: 'stale',
  } }, { signal: new AbortController().signal });
  assert.equal(stale.ok, false); assert.equal(stale.error.code, 'relationship.workspace-conflict');
  assert.equal(command(['validate']).data.valid, true);
  assert.deepEqual(await authoringHashes(root), authoringBefore, 'four transports and native reads preserve all Authoring bytes');
  result = { status: 'PASS', activationSetup, authoringUnchanged: true, consumer, packed, npmIsolation, closure, nativeCommit: nativeSource.commit,
    transports: ['installed-cli', 'installed-mcp', 'installed-agent-plugin-mcp', 'installed-dsh'], preview, applied, dsh, nativeReceipts };
} finally {
  const protectedAfter = await protectedHashes(repo);
  await writeFile(path.join(evidence, 'protected-after.json'), JSON.stringify(protectedAfter, null, 2));
  assert.deepEqual(protectedAfter, protectedBefore, 'shared home / Toolkit package metadata must remain unchanged even on failure');
}
await writeFile(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', consumer: result.consumer, transports: result.transports, nonemptyNativeReadback: true }));
