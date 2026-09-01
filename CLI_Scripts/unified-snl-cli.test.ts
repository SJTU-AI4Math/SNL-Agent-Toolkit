import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it } from 'node:test';
import { entryEntityPath, makeEntityStorageReceipt, packageManifestPath } from '../lib/entity-storage.ts';
import { executeOperation, OPERATION_PROTOCOL } from '../src/cli/operation.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root,{recursive:true,force:true}))));
async function json(file:string,value:unknown){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,`${JSON.stringify(value,null,2)}\n`);}
async function workspace(){
 const root=await mkdtemp(path.join(tmpdir(),'snl-unified-'));roots.push(root);const doc=path.join(root,'.SNL_Doc');
 await Promise.all(['entries','macros','packages','libraries'].map(d=>mkdir(path.join(doc,d),{recursive:true})));
 await json(path.join(doc,'config.json'),{version:'0.0.6',entry_kinds:[{id:'definition',name:'Definition',coloring:{stroke:'#000',background:'#fff'},style:''}],macro_kinds:[],active_macro_packages:[],entity_storage:{version:1,legacy_backup_version:'0.0.5',entry_default_package:'_unpackaged',receipt:makeEntityStorageReceipt(null,new Map(),false)}});
 await json(path.join(doc,packageManifestPath('_unpackaged')),{format:'snl-package',version:1,id:'_unpackaged',name:'Unpackaged',description:''});
 const entry={id:'entry.demo',package:'_unpackaged',kind:'definition',title:'Demo',content:{},contribution_info:null,pointer:null};
 await json(path.join(doc,entryEntityPath('_unpackaged',entry.id)),{format:'snl-entry',version:1,package:'_unpackaged',entry});
 await json(path.join(doc,'relationships.json'),{version:1,relationships:[]});
 return root;
}
function run(root:string,args:string[]){return spawnSync(path.resolve('node_modules/.bin/tsx'),['src/cli/snl.ts','--root',root,'--json',...args],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8'});}
function result(runResult:ReturnType<typeof spawnSync>){assert.equal(runResult.stderr,'');assert.equal(typeof runResult.stdout,'string');return JSON.parse(runResult.stdout as string);}

describe('unified snl command',()=>{
 it('returns machine-readable root discovery through --help',async()=>{
  const root=await workspace();const call=run(root,['--help']);assert.equal(call.status,0,call.stderr||call.stdout);const body=result(call);
  assert.equal(body.command,'help');assert.ok(body.data.commands.includes('entry/get'));assert.equal(body.protocol,'snl.result/v1');
 });
 it('executes list for all eight managed families through one operation registry',async()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'fixtures/workspace-v0.1.0');
  for(const domain of ['entry-kind','macro-kind','entry-package','macro-package','entry','macro','relationship','library']){
   const response=await executeOperation({protocol:OPERATION_PROTOCOL,command:`${domain}/list`,root,arguments:{limit:1}});
   assert.equal(response.exitCode,0,JSON.stringify(response.response));assert.equal(response.response.ok,true);
  }
 });
 it('routes noun-first entry list/get through the v1 operation envelope',async()=>{
  const root=await workspace();
  let call=run(root,['entry','list']);assert.equal(call.status,0,call.stderr||call.stdout);
  let body=result(call);assert.deepEqual({protocol:body.protocol,ok:body.ok,command:body.command},{protocol:'snl.result/v1',ok:true,command:'entry/list'});
  assert.deepEqual(body.data.entities.map((e:{id:string})=>e.id),['entry.demo']);assert.equal(body.data.nextCursor,null);
  call=run(root,['entry','get','entry.demo']);assert.equal(call.status,0,call.stderr||call.stdout);body=result(call);
  assert.equal(body.command,'entry/get');assert.equal(body.data.entity.id,'entry.demo');assert.match(body.data.entity.revision,/^[a-f0-9]{64}$/);
 });
 it('keeps domain rejection and invocation failure distinct and JSON-clean',async()=>{
  const root=await workspace();
  let call=run(root,['entry','get','missing']);assert.equal(call.status,1);let body=result(call);
  assert.deepEqual({protocol:body.protocol,ok:body.ok,command:body.command,code:body.error.code},{protocol:'snl.result/v1',ok:false,command:'entry/get',code:'entity.not-found'});
  call=run(root,['entry','wat']);assert.equal(call.status,2);body=result(call);assert.equal(body.error.code,'command.unknown');
 });
 it('reports workspace info and validates through the same result protocol',async()=>{
  const root=await workspace();
  let call=run(root,['info']);assert.equal(call.status,0,call.stderr||call.stdout);let body=result(call);
  assert.equal(body.command,'info');assert.equal(body.data.version,'0.0.6');assert.equal(body.data.counts.entry,1);
  call=run(root,['validate']);assert.equal(call.status,0,call.stderr||call.stdout);body=result(call);
  assert.equal(body.command,'validate');assert.equal(body.data.valid,true);assert.equal(body.data.counts.entry,1);
 });
 it('routes existing search, rendering, and reference capabilities through the unified protocol',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'fixtures/workspace-v0.1.0');
  let call=run(root,['snoogl','--mode','entry','--query','localized']);assert.equal(call.status,0,call.stderr||call.stdout);let body=result(call);
  assert.equal(body.command,'snoogl');assert.ok(body.data.results.some((x:{id:string})=>x.id==='entry.localized'));
  call=run(root,['entry','latex','entry.localized']);assert.equal(call.status,0,call.stderr||call.stdout);body=result(call);assert.equal(body.data.latex,'#0 \\to #1');
  call=run(root,['entry','references','entry.localized']);assert.equal(call.status,0,call.stderr||call.stdout);body=result(call);assert.ok(body.data.items.some((x:{role:string})=>x.role==='definition'));
  call=run(root,['snoogl','--mode','workspace','--query','x']);assert.equal(call.status,2);assert.equal(result(call).error.code,'operation.invalid-arguments');
 });
 it('honors documented validation, discovery, null pagination, and info contracts',async()=>{
  const root=await workspace();
  let call=run(root,['validate','--scope','workspace']);assert.equal(call.status,0,call.stderr||call.stdout);
  let operation=await executeOperation({protocol:OPERATION_PROTOCOL,command:'entry/list',root,arguments:{query:null,cursor:null,limit:1} as unknown as Record<string,unknown>});
  assert.equal(operation.exitCode,0,JSON.stringify(operation.response));
  operation=await executeOperation({protocol:OPERATION_PROTOCOL,command:'entry',root,arguments:{}});
  assert.equal(operation.exitCode,0);assert.equal(operation.response.ok,true);
  if(operation.response.ok){const commands=operation.response.data as Array<{command:string;access:string;arguments:Record<string,unknown>}>;assert.ok(commands.some(x=>x.command==='entry/latex'&&x.access==='read'&&x.arguments.id));assert.ok(commands.some(x=>x.command==='entry/references'));}
  call=run(root,['info']);assert.equal(call.status,0,call.stderr||call.stdout);const body=result(call);
  assert.equal(body.data.commandRegistryVersion,1);assert.equal(body.data.versions.entitySchema,1);assert.ok(body.data.capabilities.includes('entry/get'));
  await json(path.join(root,'.SNL_Doc','relationships.json'),{version:1,relationships:'broken'});
  call=run(root,['info']);assert.equal(call.status,1);assert.equal(result(call).error.code,'workspace.invalid');
 });
 it('maps command domain failures without losing identity or retry semantics',async()=>{
  const root=await workspace();
  let call=run(root,['entry','latex','entry.demo']);assert.equal(call.status,1);let body=result(call);assert.equal(body.error.code,'entry.invalid');
  call=run(root,['entry','references','missing']);assert.equal(call.status,1);body=result(call);assert.equal(body.error.code,'entity.not-found');
  const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'fixtures/workspace-v0.1.0');
  call=run(fixture,['entry','latex','entry.localized']);assert.equal(call.status,0,call.stderr||call.stdout);body=result(call);assert.equal(body.data.entryId,'entry.localized');
  const invalid=await executeOperation({protocol:OPERATION_PROTOCOL,command:'relationship/create',root,arguments:{value:null}});assert.equal(invalid.exitCode,1);assert.equal(invalid.response.ok,false);if(!invalid.response.ok)assert.equal(invalid.response.error.code,'entity.invalid');
 });
 it('performs create/update/delete with exact revision and canonical readback',async()=>{
  const root=await workspace();const draft=path.join(root,'entry.json');
  await json(draft,{id:'entry.new',package:'_unpackaged',kind:'definition',title:'New',content:{},contribution_info:null,pointer:null});
  let call=run(root,['entry','create','--input',draft]);assert.equal(call.status,0,call.stderr||call.stdout);let body=result(call);const r1=body.data.entity.revision;
  await json(draft,{...body.data.entity.value,title:'Updated'});
  call=run(root,['entry','update','entry.new','--input',draft,'--if-match','0'.repeat(64)]);assert.equal(call.status,1);body=result(call);assert.equal(body.error.code,'entity.revision-conflict');assert.equal(body.error.retryable,false);
  call=run(root,['entry','update','entry.new','--input',draft,'--if-match',r1]);assert.equal(call.status,0,call.stderr||call.stdout);body=result(call);assert.equal(body.data.entity.value.title,'Updated');
  call=run(root,['entry','delete','entry.new','--if-match',body.data.entity.revision]);assert.equal(call.status,0,call.stderr||call.stdout);
 });
});
