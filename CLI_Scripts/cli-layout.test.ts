import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
const root=path.resolve(import.meta.dirname,'..');
describe('CLI source/build layout contract',()=>{
 it('keeps every handwritten CLI implementation under src/cli',async()=>{
  await assert.rejects(access(path.join(root,'bin','impl')));
  const source=(await readdir(path.join(root,'src','cli'))).filter(x=>x.endsWith('.ts')).sort();
  assert.ok(source.includes('snl.ts'));assert.ok(source.includes('entity.ts'));assert.ok(source.includes('lint-entry.ts'));assert.ok(source.length>=15);
 });
 it('builds public executable entrypoints only into dist/cli',async()=>{
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  const tsconfig=JSON.parse(await readFile(path.join(root,'tsconfig.json'),'utf8'));
  assert.ok(tsconfig.include.includes('src/cli/**/*.ts'));assert.ok(tsconfig.include.includes('plugin-src/**/*.ts'));assert.equal(tsconfig.include.includes('bin/**/*.ts'),false);
  assert.equal(pkg.bin.snl,'./dist/cli/snl.mjs');
  assert.equal(pkg.scripts['build:cli'],'node scripts/build-cli.mjs');
  assert.equal(pkg.files.includes('bin'),false);assert.equal(pkg.files.includes('src'),false);
  for(const target of Object.values(pkg.bin) as string[]) if(target.includes('/cli/')) assert.match(target,/^\.\/dist\/cli\/[^/]+\.mjs$/);
  const build=await readFile(path.join(root,'scripts','build-cli.mjs'),'utf8');assert.match(build,/src\/cli\/snl\.ts/);assert.match(build,/outdir:\s*['"]dist\/cli['"]/);
  assert.notEqual((await stat(path.join(root,'dist','cli','snl.mjs'))).mode&0o111,0);
 });
 it('executes through an npm-style symlink and emits the result protocol',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'snl-bin-link-'));
  try{
   const executable=path.join(directory,'snl');await symlink(path.join(root,'dist','cli','snl.mjs'),executable);
   const child=spawnSync(executable,['--help'],{encoding:'utf8'});
   assert.equal(child.status,0,child.stderr||child.stdout);assert.notEqual(child.stdout.trim(),'','successful CLI execution must not be silent');
   const output=JSON.parse(child.stdout);assert.equal(output.protocol,'snl.result/v1');assert.equal(output.command,'help');assert.equal(output.ok,true);
  }finally{await rm(directory,{recursive:true,force:true});}
 });
});
