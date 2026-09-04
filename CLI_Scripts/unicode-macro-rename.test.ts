import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, it } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isSnlIdentifier } from '@sjtu-ai4math/snl-basics/core';
import { getManagedEntity, validateManagedWorkspace } from '../lib/entity-crud.ts';
import { findEntityReferences, renameEntityId } from '../lib/entity-references.ts';
import { entryEntityPath, macroEntityPath, packageManifestPath } from '../lib/entity-storage.ts';
import { parseSnlSyntaxTree } from '../lib/snl-parser.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const repo = path.resolve(import.meta.dirname, '..');

async function json(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function unicodeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snl-unicode-rename-'));
  roots.push(root);
  await cp(path.join(repo, 'CLI_Scripts/fixtures/workspace-v0.1.0'), root, { recursive: true });
  const doc = path.join(root, '.SNL_Doc');
  const macroDir = path.join(doc, 'macros');
  const [oldMacroFile] = (await readdir(macroDir)).filter(name => name.endsWith('.json'));
  const oldPath = path.join(macroDir, oldMacroFile);
  const envelope = JSON.parse(await readFile(oldPath, 'utf8'));
  envelope.macro.name = '文.之';
  const unicodePath = path.join(doc, macroEntityPath('Logic', '文.之'));
  await json(unicodePath, envelope);
  await rm(oldPath);

  const entryDir = path.join(doc, 'entries');
  const [entryFile] = (await readdir(entryDir)).filter(name => name.endsWith('.json'));
  const entryPath = path.join(entryDir, entryFile);
  const entry = JSON.parse(await readFile(entryPath, 'utf8'));
  entry.entry.content.snl = '文.之(x, %文.之%)';
  await json(entryPath, entry);
  await json(path.join(doc, 'relationships.json'), {
    version: 1,
    relationships: [{
      id: 'generated.macro-witness', from: 'entry.localized', to: 'entry.localized', label: 'depends',
      metadata: { generator: 'macro-source-scan', macros: ['文.之'], isAtomic: true },
    }],
  });
  assert.equal((await validateManagedWorkspace(root)).valid, true);
  return root;
}

async function unicodeEntryMembershipWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snl-unicode-entry-rename-'));
  roots.push(root);
  await cp(path.join(repo, 'CLI_Scripts/fixtures/workspace-v0.1.0'), root, { recursive: true });
  const doc = path.join(root, '.SNL_Doc');
  const entryDir = path.join(doc, 'entries');
  const [entryFile] = (await readdir(entryDir)).filter(name => name.endsWith('.json'));
  const oldPath = path.join(entryDir, entryFile);
  const source = JSON.parse(await readFile(oldPath, 'utf8'));
  source.entry.id = '文.皆';
  source.entry.title = '文.皆';
  source.entry.content.snl = '%文.皆%';
  await json(path.join(doc, entryEntityPath('_unpackaged', '文.皆')), source);
  source.entry.id = '墨翟';
  source.entry.title = '墨翟';
  source.entry.content.snl = '%墨翟%';
  await json(path.join(doc, entryEntityPath('_unpackaged', '墨翟')), source);
  await rm(oldPath);

  const manifestPath = path.join(doc, packageManifestPath('_unpackaged'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.entry_ids = ['墨翟', '文.皆'];
  await json(manifestPath, manifest);
  assert.equal((await validateManagedWorkspace(root)).valid, true);
  return root;
}

function runBuilt(root: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(repo, 'dist/cli/snl.mjs'), '--root', root, '--json', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
}
function body(call: ReturnType<typeof spawnSync>): any {
  assert.equal(call.stderr, '');
  return JSON.parse(call.stdout as string);
}

async function workspaceSnapshot(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else result.set(path.relative(root, absolute), await readFile(absolute, 'utf8'));
    }
  };
  await walk(path.join(root, '.SNL_Doc'));
  return result;
}

describe('Unicode Macro identity rename', () => {
  it('uses the installed SNL parser authority for a multi-character Unicode namespace segment', () => {
    assert.equal(isSnlIdentifier('文法.之'), true);
    assert.doesNotThrow(() => parseSnlSyntaxTree('文法.之(x)'));
  });

  it('atomically renames 文.之 to 文法.之 across every supported Macro reference category', async () => {
    const root = await unicodeWorkspace();
    const plan = await renameEntityId(root, 'macro', '文.之', '文法.之');
    assert.deepEqual(new Set(plan.occurrences.map(item => item.category)), new Set(['definition', 'snl', 'generated-witness']));
    assert.equal((await findEntityReferences(root, 'macro', '文.之')).length, 0);
    const renamed = await findEntityReferences(root, 'macro', '文法.之');
    assert.equal(renamed.filter(item => item.role === 'definition').length, 1);
    assert.equal(renamed.length, 3);

    const doc = path.join(root, '.SNL_Doc');
    await assert.rejects(readFile(path.join(doc, macroEntityPath('Logic', '文.之')), 'utf8'), { code: 'ENOENT' });
    const envelope = JSON.parse(await readFile(path.join(doc, macroEntityPath('Logic', '文法.之')), 'utf8'));
    assert.equal(envelope.macro.name, '文法.之');
    const [entryFile] = (await readdir(path.join(doc, 'entries'))).filter(name => name.endsWith('.json'));
    const entry = JSON.parse(await readFile(path.join(doc, 'entries', entryFile), 'utf8'));
    assert.equal(entry.entry.content.snl, '文法.之(x, %文.之%)', 'literal/fvar-like text must not be rewritten');
    assert.equal((await validateManagedWorkspace(root)).valid, true);
  });

  it('rejects a Unicode destination collision without changing any workspace file', async () => {
    const root = await unicodeWorkspace();
    const doc = path.join(root, '.SNL_Doc');
    const source = JSON.parse(await readFile(path.join(doc, macroEntityPath('Logic', '文.之')), 'utf8'));
    source.macro.name = '文法.之';
    await json(path.join(doc, macroEntityPath('Logic', '文法.之')), source);
    const before = await workspaceSnapshot(root);
    await assert.rejects(renameEntityId(root, 'macro', '文.之', '文法.之'), /already appears|collision/i);
    assert.deepEqual(await workspaceSnapshot(root), before);
  });

  it('rolls back an installed Unicode rename when a later owned reference changes', async () => {
    const root = await unicodeWorkspace();
    const doc = path.join(root, '.SNL_Doc');
    const relationships = path.join(doc, 'relationships.json');
    await assert.rejects(
      renameEntityId(root, 'macro', '文.之', '文法.之', {
        beforeInstallFile: async relativePath => {
          if (relativePath === 'relationships.json') await writeFile(relationships, `${await readFile(relationships, 'utf8')} `);
        },
      }),
      /changed during rename planning/,
    );
    assert.ok(await getManagedEntity(root, 'macro', 'Logic::文.之'));
    assert.equal(await getManagedEntity(root, 'macro', 'Logic::文法.之'), undefined);
    const [entryFile] = (await readdir(path.join(doc, 'entries'))).filter(name => name.endsWith('.json'));
    const entry = JSON.parse(await readFile(path.join(doc, 'entries', entryFile), 'utf8'));
    assert.equal(entry.entry.content.snl, '文.之(x, %文.之%)');
    assert.match(await readFile(relationships, 'utf8'), / $/);
  });

  it('exposes the canonical built CLI route with mandatory CAS and stable JSON', async () => {
    const root = await unicodeWorkspace();
    const entity = await getManagedEntity(root, 'macro', 'Logic::文.之');
    assert.ok(entity);

    let call = runBuilt(root, ['macro', 'rename', '文.之', '--to', '文法.之']);
    assert.equal(call.status, 2, call.stdout);
    assert.equal(body(call).error.code, 'operation.invalid-arguments');

    call = runBuilt(root, ['macro', 'rename', '文.之', '--to', '文法.之', '--if-match', entity.revision, '--dry-run']);
    assert.equal(call.status, 0, call.stdout);
    let result = body(call);
    assert.equal(result.data.dryRun, true);
    assert.ok(result.data.fingerprint);
    assert.ok(await getManagedEntity(root, 'macro', 'Logic::文.之'));
    assert.equal(await getManagedEntity(root, 'macro', 'Logic::文法.之'), undefined);

    call = runBuilt(root, ['macro', 'rename', '文.之', '--to', '文法.之', '--if-match', '0'.repeat(64)]);
    assert.equal(call.status, 1, call.stdout);
    result = body(call);
    assert.equal(result.command, 'macro/rename');
    assert.equal(result.error.code, 'entity.revision-conflict');
    assert.ok(await getManagedEntity(root, 'macro', 'Logic::文.之'));

    call = runBuilt(root, ['macro', 'rename', '文.之', '--to', '文法.之', '--if-match', entity.revision]);
    assert.equal(call.status, 0, call.stdout);
    result = body(call);
    assert.deepEqual({ protocol: result.protocol, ok: result.ok, command: result.command }, {
      protocol: 'snl.result/v1', ok: true, command: 'macro/rename',
    });
    assert.equal(result.data.dryRun, false);
    assert.equal(result.data.oldId, '文.之');
    assert.equal(result.data.newId, '文法.之');
    assert.ok(result.data.entity.revision);
    assert.equal((await validateManagedWorkspace(root)).valid, true);
  });
});

describe('Unicode Entry identity rename', () => {
  it('re-sorts owned Package membership by canonical UTF-16 code units', async () => {
    const root = await unicodeEntryMembershipWorkspace();
    const plan = await renameEntityId(root, 'entry', '文.皆', '文法.皆');
    assert.ok(plan.occurrences.some(item => item.category === 'package-membership'));

    const expected = ['墨翟', '文法.皆'];
    const manifest = JSON.parse(await readFile(path.join(
      root, '.SNL_Doc', packageManifestPath('_unpackaged'),
    ), 'utf8'));
    assert.deepEqual(manifest.entry_ids, expected);
    const readBack = await getManagedEntity(root, 'entry-package', '_unpackaged');
    assert.deepEqual(readBack?.value.entry_ids, expected);
    assert.ok(await getManagedEntity(root, 'entry', '文法.皆'));
    assert.equal((await validateManagedWorkspace(root)).valid, true);
  });
});
