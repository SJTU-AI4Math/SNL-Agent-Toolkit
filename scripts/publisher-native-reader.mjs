// Build the complete fixed native snlDoc source; only vscode platform is shimmed.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { run, privateNpm, sha256 } from './publisher-test-support.mjs';
export const nativeCommit = '76acedbc05f0523b8ad2a2e99ebfeb01591f4647';
export async function reuseNativeReader(evidence) {
  const receipt = JSON.parse(await readFile(path.join(evidence, 'native-source-receipt.json'), 'utf8'));
  assert.equal(receipt.commit, nativeCommit);
  const source = path.join(evidence, 'fixed76-source');
  const outfile = path.join(source, 'out/fixed76-native.cjs');
  assert.equal(sha256(await readFile(outfile)), receipt.bundle);
  assert.equal(sha256(await readFile(path.join(evidence, 'fixed76.tar'))), receipt.archive);
  for (const [file, hash] of Object.entries(receipt.sourceHashes)) {
    if (file !== 'harness-entrypoint') assert.equal(sha256(await readFile(path.resolve(source, file))), hash, file);
  }
  return { native: await import(pathToFileURL(outfile).href), receipt };
}
export async function buildNativeReader(reference, evidence) {
  assert.equal(run('git', ['rev-parse', 'HEAD'], { cwd: reference }).trim(), nativeCommit);
  assert.equal(run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: reference }).trim(), '');
  const source = path.join(evidence, 'fixed76-source'); await mkdir(source);
  const archive = path.join(evidence, 'fixed76.tar');
  run('git', ['archive', '--format=tar', '-o', archive, nativeCommit], { cwd: reference });
  run('tar', ['-xf', archive, '-C', source]);
  const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ ...manifest, private: true }));
  const { npm } = await privateNpm(source);
  npm(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund']);
  // Same entry exports as fixed76/scripts/build-snl-basics-host.mjs; native
  // package-lock and exact dependency pins retained, no sibling built artifacts.
  await build({ stdin: { contents: [
    "export { migrateMacroDocument, migrateMacroV7toV8, readSnlTableRenderOptions } from '@sjtu-ai4math/snl-basics';",
    "export { isSnlIdentifier, parseSnlSyntaxTree } from '@sjtu-ai4math/snl-basics/core';",
    "export { fromMarkdown } from 'mdast-util-from-markdown';",
  ].join('\n'), resolveDir: source, loader: 'js' }, outfile: path.join(source, 'out/snl-basics-host.cjs'),
    bundle: true, platform: 'node', format: 'cjs', target: 'node20', minify: true, legalComments: 'none' });
  const shim = path.resolve(import.meta.dirname, 'publisher-vscode-shim.mjs');
  const outfile = path.join(source, 'out/fixed76-native.cjs');
  const result = await build({ stdin: { contents: [
    "export { readEntries, readAllMacros, readAuthoredRelationships, readRelationships, readPackageMacroSnapshot } from './src/snlDoc';",
    "export { cacheFingerprint, readCache } from './src/derivedCache';",
    "export { readDependencyCache } from './src/dependencyCache';",
    "export { Uri } from 'vscode';",
  ].join('\n'), loader: 'ts', resolveDir: source }, absWorkingDir: source,
    outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node20', metafile: true,
    plugins: [{ name: 'vscode-platform-only', setup(b) {
      b.onResolve({ filter: /^vscode$/ }, () => ({ path: shim }));
    } }],
  });
  const sourceHashes = {};
  for (const file of Object.keys(result.metafile.inputs)) {
    if (file !== '<stdin>') sourceHashes[file] = sha256(await readFile(path.resolve(source, file)));
  }
  sourceHashes['harness-entrypoint'] = sha256(await readFile(new URL(import.meta.url)));
  const receipt = { commit: nativeCommit, archive: sha256(await readFile(archive)),
    bundle: sha256(await readFile(outfile)), sourceHashes, metafile: result.metafile };
  await writeFile(path.join(evidence, 'native-source-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return { native: await import(pathToFileURL(outfile).href), receipt };
}
export async function nativeReadback(native, root, publication) {
  const uri = native.Uri.file(root);
  // Independently read all native inputs from this SAME physical Authoring tree.
  const snapshot = { entries: await native.readEntries(uri), macros: await native.readAllMacros(uri),
    relationships: await native.readAuthoredRelationships(uri) };
  const packageSnapshot = await native.readPackageMacroSnapshot(uri);
  const file = path.join(root, '.SNL_Doc/.cache/dependencies/result.json');
  const before = await readFile(file);
  const generated = await native.readDependencyCache(root, snapshot);
  // Unsupplied snapshot forces readRelationships to collect its own native pools.
  const composed = await native.readRelationships(uri);
  const after = await readFile(file);
  const ids = new Set(snapshot.entries.map(e => e.id));
  for (const edge of composed) assert.ok(ids.has(edge.from) && ids.has(edge.to), 'native graph must be closed');
  assert.deepEqual(generated, publication.generated, 'native generated witness parity');
  assert.deepEqual(composed, publication.relationships, 'native composed view parity');
  assert.deepEqual(after, before, 'native must consume the published hash, not regenerate after an input miss');
  return { snapshot, packageSnapshot, generated, composed, inputHash: JSON.parse(before).inputHash,
    cacheBefore: sha256(before), cacheAfter: sha256(after), closed: true };
}
