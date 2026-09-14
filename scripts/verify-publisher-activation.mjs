// tsx script; run under shared verify.py. Reuses sealed, lane-owned fixed76 bundle.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';
import { readActiveMacros, readAllMacroPackages } from '../lib/snl-doc.ts';
import { createWorkspaceReader } from '../src/web/workspace.ts';
import { run, authorNonemptyFixture, protectedHashes, sha256 } from './publisher-test-support.mjs';
import { activationCases, setupActivation, authoringHashes } from './publisher-activation-fixture.mjs';
const repo = path.resolve(import.meta.dirname, '..');
const evidence = path.resolve(process.argv[2]); await mkdir(evidence);
const oracleEvidence = path.resolve(process.argv[3]);
const receipt = JSON.parse(await readFile(path.join(oracleEvidence, 'native-source-receipt.json')));
assert.equal(receipt.commit, '76acedbc05f0523b8ad2a2e99ebfeb01591f4647');
const bundle = path.join(oracleEvidence, 'fixed76-source/out/fixed76-native.cjs');
assert.equal(sha256(await readFile(bundle)), receipt.bundle);
const native = await import(pathToFileURL(bundle).href);
const beforeProtected = await protectedHashes(repo);
const root = await mkdtemp(path.join(evidence, 'fixture-'));
const cli = path.join(repo, 'dist/cli/snl.mjs');
function command(args, input) {
  return JSON.parse(run(process.execPath, [cli, ...args, '--root', root, '--json'], { cwd: repo, input: input === undefined ? undefined : JSON.stringify(input) })).data;
}
async function author(cmd, args) {
  const tokens = cmd.split('/');
  if (cmd === 'batch/check') return command([...tokens, '--input', '-'], args.operations);
  if (cmd === 'batch/apply') return command([...tokens, '--input', '-'], args);
  if (tokens[1] === 'list') return command([...tokens, '--limit', String(args.limit)]);
  if (tokens[1] === 'get') return command([...tokens, args.id]);
  if (tokens[1] === 'update') return command([...tokens, args.id, '--if-match', args.expectedRevision, '--input', '-'], args.value);
  if (cmd === 'validate') return command(['validate']);
  throw new Error(cmd);
}
async function op(cmd, args) {
  const r = await executeOperation({ protocol: OPERATION_PROTOCOL, root, command: cmd, arguments: args });
  assert.ok(r.response.ok, JSON.stringify(r)); return r.response.data;
}
const rows = [];
try {
  command(['init']);
  const authoring = await authorNonemptyFixture(author);
  command(['library', 'create', '--input', '-'], { slug: 'parity', meta: { title: 'Parity' }, graph: { nodes: [{ id: 'n', label: 'Entry', props: { entryId: 'parity.source' } }], relationships: [] }, counters: { counters: [] } });
  await writeFile(path.join(evidence, 'authoring.json'), JSON.stringify(authoring, null, 2));
  const model = path.resolve(process.env.SNL_READER_MODEL_PATH ?? path.join(repo, 'dist/web/model.mjs'));
  for (const [label, activation] of activationCases) {
    const setup = await setupActivation(root, evidence, activation);
    await writeFile(path.join(evidence, `${label}-setup.json`), JSON.stringify(setup, null, 2));
    const authorBefore = await authoringHashes(root);
    await rm(path.join(root, '.SNL_Doc/.cache'), { recursive: true, force: true });
    if (activation?.includes('_unpackaged')) {
      const response = await executeOperation({ protocol: OPERATION_PROTOCOL, root, command: 'relationship/generate', arguments: { scope: {}, dryRun: true } });
      assert.equal(response.response.ok, false, 'existing validator continues to reject explicit system activation');
      assert.match(response.response.error.message, /cannot activate.*_unpackaged/);
      const uri = native.Uri.file(root);
      const nativeMacros = await native.readAllMacros(uri);
      assert.equal(Object.hasOwn(nativeMacros, 'ParitySystem'), false);
      assert.deepEqual(await authoringHashes(root), authorBefore);
      rows.push({ label, activation, setup, admission: 'REJECTED_EXISTING_VALIDATOR', response, nativeMacroKeys: Object.keys(nativeMacros).sort(), authoringUnchanged: true });
      continue;
    }
    const preview = await op('relationship/generate', { scope: {}, dryRun: true });
    const applied = await op('relationship/generate', { scope: {}, expectedWorkspaceRevision: preview.expectedWorkspaceRevision });
    assert.equal(applied.published, true);
    const file = path.join(root, '.SNL_Doc/.cache/dependencies/result.json');
    const publisherBytes = await readFile(file);
    const uri = native.Uri.file(root);
    const snapshot = { entries: await native.readEntries(uri), macros: await native.readAllMacros(uri), relationships: await native.readAuthoredRelationships(uri) };
    const packages = await native.readPackageMacroSnapshot(uri);
    // Actual native get-or-generate path: a miss must replace the old artifact.
    const generated = await native.readDependencyCache(root, snapshot);
    const composed = await native.readRelationships(uri); // no supplied snapshot
    const nativeBytes = await readFile(file);
    const active = await readActiveMacros(root);
    const catalog = await readAllMacroPackages(root);
    assert.ok(catalog._unpackaged.macros.ParitySystem, 'management catalog retains system Macro');
    assert.ok((await op('macro/list', { limit: 1000 })).entities.some(e => e.id === '_unpackaged::ParitySystem'));
    const reader = await createWorkspaceReader(root, model);
    const html = await reader.getSnapshot('parity');
    assert.deepEqual(html.macros, active, 'Toolkit HTML Reader uses the publisher active input pool');
    assert.deepEqual(await readFile(file), nativeBytes, 'Toolkit HTML Reader does not rewrite native cache');
    assert.deepEqual(await authoringHashes(root), authorBefore, 'all authoring bytes survive publisher and readers');
    const row = { label, activation, setup, snapshot, packages, publisher: applied, nativeGenerated: generated, nativeComposed: composed,
      publisherCache: JSON.parse(publisherBytes), nativeCache: JSON.parse(nativeBytes), publisherHash: sha256(publisherBytes), nativeHash: sha256(nativeBytes),
      cacheRewritten: !publisherBytes.equals(nativeBytes), macroKeysMatch: isDeepStrictEqual(Object.keys(active).sort(), Object.keys(snapshot.macros).sort()),
      generatedMatch: isDeepStrictEqual(generated, applied.generated), composedMatch: isDeepStrictEqual(composed, applied.relationships), htmlMacroKeys: Object.keys(html.macros).sort(), authoringUnchanged: true };
    rows.push(row);
    await writeFile(path.join(evidence, `${label}-result.json`), JSON.stringify(row, null, 2));
  }
} finally {
  const after = await protectedHashes(repo); assert.deepEqual(after, beforeProtected);
  await writeFile(path.join(evidence, 'protected.json'), JSON.stringify({ before: beforeProtected, after }, null, 2));
  await writeFile(path.join(evidence, 'matrix.json'), JSON.stringify({ oracleEvidence, nativeCommit: receipt.commit, nativeBundleHash: receipt.bundle, rows }, null, 2));
}
const failures = rows.filter(r => !r.admission && (r.cacheRewritten || !r.macroKeysMatch || !r.generatedMatch || !r.composedMatch));
console.log(JSON.stringify(rows.map(r => ({ label: r.label, rewritten: r.cacheRewritten, admission: r.admission, publisherInput: r.publisherCache?.inputHash, nativeInput: r.nativeCache?.inputHash, publisherEdges: r.publisher?.generated.length, nativeEdges: r.nativeGenerated?.length }))));
assert.equal(failures.length, 0, `native full-collector rejected publisher cache: ${failures.map(r => r.label).join(', ')}`);
