#!/usr/bin/env node
// Run under the caller's bounded admission wrapper. All children are synchronous.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { privateNpm, protectedHashes, cleanEnvironment } from './publisher-test-support.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const base = process.argv[2];
if (!base || !path.isAbsolute(base)) throw new Error('Pass an absolute owned evidence directory.');
await mkdir(base,{recursive:true});
const root = path.resolve(import.meta.dirname,'..');
const run=(cmd,args,cwd=root,input)=>{
  const r=spawnSync(cmd,args,{cwd,input,encoding:'utf8',env:cleanEnvironment(),timeout:180000,maxBuffer:16*1024*1024});
  console.log(JSON.stringify({command:[cmd,...args],cwd,status:r.status,stdout:r.stdout,stderr:r.stderr}));
  assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;
};
const beforeProtected = await protectedHashes(root);
try {
const consumer=await mkdtemp(path.join(base,'consumer-'));
await writeFile(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
const { npm } = await privateNpm(consumer);
const pack=JSON.parse(npm(['pack',root,'--ignore-scripts','--json','--pack-destination',base]))[0];
assert.ok(pack.files.some(f=>f.path==='dist/relationship-generation.mjs'));
assert.ok(pack.files.some(f=>f.path==='lib/relationship-generation.ts'));
assert.ok(!pack.files.some(f=>/relationship-oracle|result\.json|logs\//.test(f.path)));
npm(['install','--ignore-scripts','--no-audit','--no-fund',path.join(base,pack.filename)]);
assert.equal(npm(['prefix']).trim(), consumer);
// Own compiler and Node declarations: do not mask unpublished types with donor typeRoots.
const typescript = JSON.parse(await readFile(path.join(root,'node_modules/typescript/package.json'),'utf8')).version;
const nodeTypes = JSON.parse(await readFile(path.join(root,'node_modules/@types/node/package.json'),'utf8')).version;
npm(['install','--ignore-scripts','--no-audit','--no-fund','--save-dev',`typescript@${typescript}`,`@types/node@${nodeTypes}`]);
await writeFile(path.join(consumer,'consume.mjs'),`
import assert from 'node:assert/strict';
import { planComposedDependencyRelationships as plan, computeAtomicityInPlace } from '@snl-doc/agent-toolkit/relationship-generation';
const entries=[{id:'A',content:{snl:'M'}},{id:'B',content:{snl:''}}];
const macros={M:{source:{entries:['B']}}};
const authored=[{id:'manual',from:'A',to:'B',label:'depends',metadata:{keep:['x']}}];
const before=JSON.stringify({entries,macros,authored});
const result=plan(entries,macros,authored);
assert.equal(result.generated.length,1);
assert.equal(result.generated[0].metadata.isAtomic,true);
assert.equal(result.destination,'memory-only');assert.equal(result.publicationSupported,false);
assert.equal(JSON.stringify({entries,macros,authored}),before);
assert.equal(result.relationships.find(r=>r.id==='manual').metadata.keep[0],'x');
const n=10000;
const large=Array.from({length:n},(_,i)=>({id:'E'+i,content:{snl:Array.from({length:5},(_,j)=>i+j+1<n?'M'+(i+j+1):'').join(' ')}}));
const catalog=Object.fromEntries(large.map(e=>['M'+e.id.slice(1),{source:{entries:[e.id]}}]));
const start=performance.now();const scale=plan(large,catalog,[]);const ms=performance.now()-start;
assert.equal(scale.generated.length,49985);assert.equal(scale.generated.filter(r=>r.metadata.isAtomic).length,9999);
console.log(JSON.stringify({installedSDK:true,entries:n,generated:scale.generated.length,atomic:9999,purePlanMs:ms}));
`);
run(process.execPath,['consume.mjs'],consumer);
await writeFile(path.join(consumer,'public-types.ts'),`
import { planComposedDependencyRelationships, type RelationshipData } from '@snl-doc/agent-toolkit/relationship-generation';
const rows: RelationshipData[] = [];
const result = planComposedDependencyRelationships([{id:'A',content:{snl:''}}],{},rows);
const destination: 'memory-only' = result.destination;
const publication: false = result.publicationSupported;
console.log(destination,publication);
`);
run(process.execPath,[path.join(consumer,'node_modules/typescript/bin/tsc'),'--noEmit','--strict','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022','--allowImportingTsExtensions','public-types.ts'],consumer);
const cli=path.join(consumer,'node_modules/@snl-doc/agent-toolkit/dist/cli/snl.mjs');
const help=JSON.parse(run(process.execPath,[cli,'--help','--json'],consumer));
assert.equal(help.ok,true);assert.ok(help.data.commands.includes('relationship/generate'));
const missingScope=spawnSync(process.execPath,[cli,'relationship','generate','--root',consumer,'--json'],{encoding:'utf8',env:cleanEnvironment(),timeout:30000});
assert.equal(missingScope.status,2);const rejected=JSON.parse(missingScope.stdout);assert.equal(rejected.ok,false);assert.match(rejected.error.message,/scope/i);
console.log(JSON.stringify({packed:pack.filename,consumer,commandPublication:'AVAILABLE',pureSDK:'memory-only',isolatedTypes:true,rejection:rejected}));
} finally {
  const afterProtected = await protectedHashes(root);
  await writeFile(path.join(base,'protected-metadata.json'),JSON.stringify({before:beforeProtected,after:afterProtected},null,2));
  assert.deepEqual(afterProtected,beforeProtected);
}
