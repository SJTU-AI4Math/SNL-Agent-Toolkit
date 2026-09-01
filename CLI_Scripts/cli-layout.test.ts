import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
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
});
