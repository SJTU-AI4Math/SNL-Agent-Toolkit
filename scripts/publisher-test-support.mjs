// Integration harness utilities; never use the default/global installed snl.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function cleanEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^npm_/i.test(key) && !['SNL_ENTITY_ADAPTER_MODULE', 'PREFIX', 'NODE_PATH', 'INIT_CWD'].includes(key)));
}
export function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, env: cleanEnvironment(), ...options });
  assert.equal(result.status, 0, `${bin} ${args.join(' ')}\n${result.error ?? ''}\n${result.stdout?.slice(-16000)}\n${result.stderr?.slice(-16000)}`);
  return result.stdout;
}
export async function protectedHashes(repo) {
  const paths = [
    ...['package.json', 'package-lock.json', 'node_modules/.package-lock.json',
      'node_modules/@snl-doc/agent-toolkit/package.json',
      'node_modules/@snl-doc/agent-toolkit/package-lock.json'].map(p => path.join(homedir(), p)),
    ...['package.json', 'package-lock.json', 'node_modules/.package-lock.json'].map(p => path.join(repo, p)),
  ];
  return Object.fromEntries(await Promise.all(paths.map(async file => {
    try { return [file, sha256(await readFile(file))]; }
    catch (error) { if (error.code === 'ENOENT') return [file, null]; throw error; }
  })));
}
export async function privateNpm(directory) {
  await mkdir(directory, { recursive: true });
  const root = await realpath(directory);
  const isolation = path.join(root, '.npm-isolation');
  await mkdir(isolation, { recursive: true });
  const userconfig = path.join(isolation, 'user.npmrc');
  const globalconfig = path.join(isolation, 'global.npmrc');
  await writeFile(userconfig, '', { flag: 'wx' });
  await writeFile(globalconfig, '', { flag: 'wx' });
  // Metadata MUST precede npm prefix/install: npm otherwise searches ancestors.
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(metadata.private, true);
  const flags = ['--prefix', root, '--global=false', '--cache', path.join(isolation, 'cache'),
    '--userconfig', userconfig, '--globalconfig', globalconfig];
  const npm = (args, options = {}) => run('npm', [...flags, ...args], { ...options, cwd: root });
  assert.equal(npm(['prefix']).trim(), root, 'npm must resolve exactly the private consumer root');
  return { npm, root, userconfig, globalconfig, cache: path.join(isolation, 'cache') };
}

// The fixture is authored only through the public operation/CLI batch protocol.
// Two regular packages collide on ParityWitness; canonical Z wins regardless of
// creation order. A system-only Macro is reachable through current public batch.
export async function authorNonemptyFixture(op) {
  const macros = (await op('macro/list', { limit: 1000 })).entities;
  assert.ok(macros.length);
  const template = macros.find(row => row.value.parameters?.length === 0)?.value ?? macros[0].value;
  const kinds = (await op('entry-kind/list', { limit: 1000 })).entities;
  const kind = kinds[0].id;
  const entry = id => ({ id, package: '_unpackaged', kind, tags: [], content: { snl: '' } });
  const macro = (name, pkg, target) => ({ ...template, name, package: pkg, dynamic_arity: false,
    source: { entries: [target], urls: [] }, styles: [{ style_name: 'default', tags: [],
      template: { mode: 'formula_inline', body: name, latex: { built_in: '', synthesis: { mode: 'formula', macro: name } } } }] });
  const operations = [
    { command: 'entry-package/create', arguments: { value: { id: 'ParityZ' } } },
    { command: 'entry-package/create', arguments: { value: { id: 'ParityA' } } },
    ...['parity.a', 'parity.z', 'parity.system', 'parity.source'].map(id => ({ command: 'entry/create', arguments: { value: entry(id) } })),
    ...[['ParityWitness', 'ParityZ', 'parity.z'], ['ParityWitness', 'ParityA', 'parity.a'],
      ['ParitySystem', '_unpackaged', 'parity.system']].map(([name, pkg, target]) =>
      ({ command: 'macro/create', arguments: { value: macro(name, pkg, target) } })),
    { command: 'relationship/create', arguments: { value: { id: 'parity.manual', from: 'parity.z', to: 'parity.a', label: 'depends', metadata: { note: 'preserve' } } } },
  ];
  const checked = await op('batch/check', { operations });
  const applied = await op('batch/apply', { operations: checked.normalizedOperations,
    checkedDigest: checked.checkedDigest, expectedWorkspaceRevision: checked.expectedWorkspaceRevision });
  const source = (await op('entry/get', { id: 'parity.source' })).entity;
  await op('entry/update', { id: source.id, expectedRevision: source.revision,
    value: { ...source.value, content: { snl: '__enum__(ParityWitness,ParitySystem)' } } });
  assert.equal((await op('validate', { scope: 'workspace' })).valid, true);
  return { checked, applied };
}
