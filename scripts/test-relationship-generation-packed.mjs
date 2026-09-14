#!/usr/bin/env node
// Run under the caller's bounded admission wrapper. All children are synchronous.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const base = process.argv[2];
if (!base || !path.isAbsolute(base)) throw new Error('Pass an absolute owned evidence directory.');
await mkdir(base,{recursive:true});
const root = path.resolve(import.meta.dirname,'..');
const run=(cmd,args,cwd=root,input)=>{
  const r=spawnSync(cmd,args,{cwd,input,encoding:'utf8',env:process.env,maxBuffer:16*1024*1024});
  console.log(JSON.stringify({command:[cmd,...args],cwd,status:r.status,stdout:r.stdout,stderr:r.stderr}));
  assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;
};
const pack=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',base,'--cache',path.join(base,'npm-cache')]))[0];
assert.ok(pack.files.some(f=>f.path==='dist/relationship-generation.mjs'));
assert.ok(pack.files.some(f=>f.path==='lib/relationship-generation.ts'));
assert.ok(!pack.files.some(f=>/relationship-oracle|result\.json|logs\//.test(f.path)));
const consumer=await mkdtemp(path.join(base,'consumer-'));
await writeFile(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
run('npm',['install','--ignore-scripts','--no-audit','--no-fund','--cache',path.join(base,'npm-cache'),path.join(base,pack.filename)],consumer);
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
run(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--strict','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022','--skipLibCheck','--allowImportingTsExtensions','--typeRoots',path.join(root,'node_modules/@types'),'public-types.ts'],consumer);
const cli=path.join(consumer,'node_modules/@snl-doc/agent-toolkit/dist/cli/snl.mjs');
const help=JSON.parse(run(process.execPath,[cli,'--help','--json'],consumer));
assert.equal(help.ok,true);assert.ok(!help.data.commands.includes('relationship/generate'));
const unavailable=spawnSync(process.execPath,[cli,'relationship','generate','--root',consumer,'--json'],{encoding:'utf8'});
assert.equal(unavailable.status,2);assert.equal(JSON.parse(unavailable.stdout).ok,false);
console.log(JSON.stringify({packed:pack.filename,consumer,commandPublication:'BLOCKED/unavailable',rejection:JSON.parse(unavailable.stdout)}));
