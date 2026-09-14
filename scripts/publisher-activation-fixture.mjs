// TEST SETUP ONLY: explicitly authorized activation-field exception, not a CLI capability.
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from './publisher-test-support.mjs';
export const activationCases = [
  ['missing', undefined], ['empty', []], ['system', ['_unpackaged']],
  ['regular-a', ['BasicMacros', 'ParityA']],
  ['regular', ['BasicMacros', 'ParityA', 'ParityZ']],
  ['reverse', ['ParityZ', 'ParityA', 'BasicMacros']],
  ['duplicates', ['ParityZ', 'ParityA', 'ParityZ', 'BasicMacros']],
  ['duplicates-system', ['_unpackaged', 'ParityZ', 'ParityA', 'ParityZ', 'BasicMacros', '_unpackaged']],
];
export async function authoringHashes(root) {
  const out = {};
  async function walk(relative) {
    for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (item.name === '.cache') continue;
      const file = path.join(relative, item.name);
      if (item.isDirectory()) await walk(file);
      else { assert.ok(item.isFile(), `Unexpected fixture path ${file}`); out[file] = sha256(await readFile(path.join(root, file))); }
    }
  }
  await walk('.SNL_Doc'); return out;
}
export async function setupActivation(root, exclusiveParent, activation) {
  const physical = await realpath(root); const parent = await realpath(exclusiveParent);
  assert.ok(physical.startsWith(parent + path.sep), 'only this run\'s exclusive fixture may be edited');
  const file = path.join(physical, '.SNL_Doc/config.json');
  const beforeTree = await authoringHashes(root);
  const before = await readFile(file); const original = JSON.parse(before);
  const changed = { ...original };
  if (activation === undefined) delete changed.active_macro_packages;
  else changed.active_macro_packages = activation;
  const after = Buffer.from(JSON.stringify(changed, null, 2) + '\n');
  await writeFile(file, after);
  const { active_macro_packages: oldActivation, ...oldRest } = original;
  const { active_macro_packages: newActivation, ...newRest } = JSON.parse(await readFile(file));
  assert.deepEqual(newRest, oldRest, 'all unrelated and unknown config fields preserved');
  const afterTree = await authoringHashes(root);
  delete beforeTree['.SNL_Doc/config.json']; delete afterTree['.SNL_Doc/config.json'];
  assert.deepEqual(afterTree, beforeTree, 'no envelope/identity/revision or other Authoring edit');
  return { authorization: 'exclusive-test-activation-config-only; NOT public CLI capability',
    beforeHash: sha256(before), afterHash: sha256(after), beforeBase64: before.toString('base64'), afterBase64: after.toString('base64'),
    structuralDiff: [{ path: '/active_macro_packages', before: { present: Object.hasOwn(original, 'active_macro_packages'), value: oldActivation },
      after: { present: Object.hasOwn(changed, 'active_macro_packages'), value: newActivation } }], otherConfigFieldsUnchanged: true, otherAuthoringFilesUnchanged: true };
}
