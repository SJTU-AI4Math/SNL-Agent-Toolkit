import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { readActiveMacros, readEntries } from '../lib/snl-doc.ts';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as candidate from '../lib/relationship-generation.ts';
import type { EntryData, MacroPackageEntry } from '../lib/snl-doc-schema.ts';
import type { RelationshipData } from '../lib/relationship-generation.ts';

const fixture = new URL('./fixtures/relationship-oracle/', import.meta.url);
const provenance = JSON.parse(await readFile(new URL('provenance.json', fixture), 'utf8'));
const sources: Record<string, string> = {};
for (const name of ['dependencyCache.ts', 'snlReferences.ts']) {
  sources[name] = await readFile(new URL(`${name}.txt`, fixture), 'utf8');
  assert.equal(createHash('sha256').update(sources[name]).digest('hex'), provenance.files[name]);
}
// Execute pinned production cache generation/validation, substituting ONLY the
// host cache transport. No hand-authored derivation or absolute donor imports.
const transport = `async function getOrGenerateCache(_root: unknown, options: any) {
  const value = await options.generate();
  if (!options.validate(value)) throw new Error('oracle cache output invalid');
  return value;
}`;
const source = sources['snlReferences.ts'] + '\n' + transport + '\n' + sources['dependencyCache.ts'].replace(/^import .*;\r?\n/gm, '');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const oracle = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`) as typeof candidate & {
  readDependencyCache(root: unknown, snapshot: { entries: EntryData[]; macros: Record<string, MacroPackageEntry>; relationships: RelationshipData[] }): Promise<RelationshipData[]>;
  mergeDependencyRelationships(authored: RelationshipData[], generated: RelationshipData[]): RelationshipData[];
};
const edge = (id: string, from: string, to: string, metadata: unknown = {}, label = 'depends'): RelationshipData => ({ id, from, to, metadata, label });
const entry = (id: string, snl = '') => ({ id, content: { snl } }) as EntryData;
const macro = (...entries: string[]) => ({ source: { entries } }) as MacroPackageEntry;

test('canonical public CRUD and fresh CAS feed the active-Package reader without generation writes', async () => {
  // Keep evidence under this lane when explicitly set; normal standalone tests
  // use the conventional temporary directory. No cross-checkout dependencies.
  const base = process.env.SNL_RELATIONSHIP_TEST_TMP ?? (await import('node:os')).tmpdir();
  await mkdir(base, {recursive:true});
  const root = await mkdtemp(path.join(base,'relationship-active-'));
  await cp(new URL('./fixtures/workspace-v0.1.0/.SNL_Doc',import.meta.url),path.join(root,'.SNL_Doc'),{recursive:true});
  const call = async (command:string,args:Record<string,unknown>={}) => {
    const argv=[fileURLToPath(new URL('../dist/cli/snl.mjs',import.meta.url)),...command.split('/'),'--root',root,'--json'];
    if(args.id) argv.push(String(args.id));
    if(args.expectedRevision) argv.push('--if-match',String(args.expectedRevision));
    if(args.limit) argv.push('--limit',String(args.limit));
    if(args.value) argv.push('--input','-');
    const run=spawnSync(process.execPath,argv,{input:args.value?JSON.stringify(args.value):undefined,encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
    const response=JSON.parse(run.stdout);assert.equal(response.ok,true,run.stdout);
    return response.data as Record<string,any>;
  };
  const initial=await readEntries(root);
  const originalMacro=(await call('macro/list',{limit:100})).entities[0].value;
  await call('entry/create',{value:{id:'generation.target',package:'_unpackaged',kind:initial[0].kind,content:{snl:''}}});
  await call('macro-package/create',{value:{id:'ActiveGeneration'}});
  await call('entry-package/create',{value:{id:'LaterGeneration'}});
  await call('macro/create',{value:{...originalMacro,package:'ActiveGeneration',name:'GenerationMacro',source:{entries:['generation.target'],urls:[]}}});
  await call('macro/create',{value:{...originalMacro,package:'LaterGeneration',name:'GenerationMacro',source:{entries:[initial[0].id],urls:[]}}});
  const entity=(await call('entry/get',{id:'generation.target'})).entity;
  await call('entry/update',{id:'generation.target',expectedRevision:entity.revision,value:{...entity.value,content:{snl:'GenerationMacro'}}});
  await call('validate',{scope:'workspace'});
  const digestTree=async()=>{
    const records:string[]=[];
    const walk=async(dir:string)=>{for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:1)){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else records.push(`${path.relative(root,f)}:${createHash('sha256').update(await readFile(f)).digest('hex')}`);}};
    await walk(root);return records;
  };
  const before=await digestTree();const entries=await readEntries(root);const macros=await readActiveMacros(root);
  // Macro create activates the Package, even if created as an Entry Package.
  // Both catalogs are active; later canonical Package filename wins.
  assert.deepEqual(macros.GenerationMacro.source?.entries,[initial[0].id]);
  const expected=await oracle.readDependencyCache(null,{entries,macros,relationships:[]});
  const actual=candidate.planComposedDependencyRelationships(entries,macros,[]);
  assert.deepEqual(actual.generated,expected); assert.equal(actual.generated.length,1);
  assert.deepEqual(await digestTree(),before);
});

test('ported tokenizer/reconciler bodies remain byte-identical to pinned source', async () => {
  const port=await readFile(new URL('../lib/relationship-generation.ts',import.meta.url),'utf8');
  const extract=(text:string,start:string,end:string)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start))).trim();
  assert.equal(extract(port,'export function reconcileDependencyRelationships(','/**\n * Exact Extension'),extract(sources['dependencyCache.ts'],'export function reconcileDependencyRelationships(','/**\n * Mark each'));
  assert.equal(extract(port,'export function extractSnlReferences(','/** Report'),sources['snlReferences.ts'].slice(sources['snlReferences.ts'].indexOf('export function extractSnlReferences(')).trim());
});

test('global composed plan matches actual pinned cache generation and preserves Authoring', async () => {
  const planGlobal = Reflect.get(candidate, 'planComposedDependencyRelationships');
  assert.equal(typeof planGlobal, 'function', 'global composed read-only planner must exist');
  const entries = [entry('Z', 'M'), entry('A', 'M'), entry('B')];
  const macros = { M: macro('B'), constructor: macro('A') };
  const relationships = [edge('historic','Z','A',{generator:'macro-source-scan',extra:42}), edge('dep.A.B','Z','B',{manual:true}), edge('context','A','B',{generator:'macro-source-scan'},'uses_context')];
  const before = structuredClone({entries,macros,relationships});
  const generated = await oracle.readDependencyCache(null,{entries,macros,relationships});
  const result = planGlobal(entries,macros,relationships);
  assert.deepEqual(result.generated,generated);
  assert.deepEqual(result.relationships,oracle.mergeDependencyRelationships(relationships,generated));
  assert.deepEqual({entries,macros,relationships},before);
  assert.equal(result.destination,'memory-only');
  assert.equal(result.publicationSupported,false);
  assert.deepEqual(planGlobal([...entries].reverse(),macros,[...relationships].reverse()).relationships,result.relationships);
  assert.throws(()=>planGlobal(entries,macros,[relationships[0],relationships[0]]), /duplicate/i);
});

// This first regression must fail against legacy: parallel direct edges are
// not composite paths at the pinned mainline revision.
test('mainline atomicity excludes every parallel direct edge', () => {
  const rows = [edge('a', 'A', 'B'), edge('b', 'A', 'B')];
  const expected = structuredClone(rows); oracle.computeAtomicityInPlace(expected);
  candidate.computeAtomicityInPlace(rows);
  assert.deepEqual(rows, expected);
});

test('tokenizer is exact pinned source, including malformed opaque spans', () => {
  for (const text of ['M(M) x@Context @M %M% $M$ $$M$$ M[attr=M]', '%M', '$$M', 'M[', 'M@', '中文.M __proto__ constructor', '@%M% M']) {
    assert.deepEqual(candidate.extractSnlReferences(text), oracle.extractSnlReferences(text));
  }
});

test('scoped reconciliation preserves foreign/manual/context rows, identity collisions and input bytes', () => {
  const entries = [entry('a|b','M N'), entry('a','P'), entry('b|c'), entry('c'), entry('O','M'), entry('a.b','Q'),entry('b.c')];
  const macros = { M: macro('c','c','missing','a|b'), N: macro('c'), P: macro('b|c'), Q: macro('b.c') };
  const rows = [edge('previous','a|b','c',{generator:'macro-source-scan', extra: 1}), edge('dep.a.b|c','a','c',{manual:['keep']}),edge('outside','O','c',{generator:'macro-source-scan',isAtomic:false,extra:3}),edge('ctx','a','c',{generator:'macro-source-scan',isAtomic:true},'uses_context'),edge('foreign','a','c',{generator:'foreign'})];
  for (const ids of [null, new Set<string>(), new Set(['a|b','a'])]) {
    const input = structuredClone({entries,macros,rows});
    const expected = oracle.reconcileDependencyRelationships(entries,macros,rows,{entryIds:ids});
    const actual = candidate.planDependencyRelationships(entries,macros,rows,{entryIds:ids});
    assert.deepEqual(actual.relationships,expected.relationships); assert.deepEqual(actual.report,expected.report);
    assert.deepEqual({entries,macros,rows},input);
  }
});

test('exhaustive directed graphs include cycles, self loops, selection and parallel edges', () => {
  for (let mask=0; mask<512; mask++) {
    const rows: RelationshipData[]=[];
    for(let a=0;a<3;a++) for(let b=0;b<3;b++) if(mask & (1 << (a*3+b))) rows.push(edge(`${a}-${b}`,String(a),String(b)));
    if(mask%3===0 && rows.length) rows.push({...rows[0],id:'parallel',metadata:{}});
    const expected=structuredClone(rows); const actual=structuredClone(rows);
    const selected=(r:RelationshipData)=> r.id !== '1-2';
    oracle.computeAtomicityInPlace(expected, selected); candidate.computeAtomicityInPlace(actual,selected);
    assert.deepEqual(actual,expected,`graph ${mask}`);
  }
});

test('bitset boundaries and large-allocation fallback retain current atomicity', () => {
  for (const size of [31,32,33,63,64,65,24000]) {
    // Sparse disconnected pairs make memory-cap fallback cheap for both cores.
    const rows=Array.from({length:size},(_,i)=>edge(`r${i}`,`a${i}`,`b${i}`));
    rows.push(edge('parallel','a0','b0'));
    const expected=structuredClone(rows);oracle.computeAtomicityInPlace(expected);
    candidate.computeAtomicityInPlace(rows);assert.deepEqual(rows,expected);
  }
});

test('seeded snapshots parity, own macro names, repeated no-op changes', () => {
  let seed=76;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let run=0;run<100;run++) {
    const entries=Array.from({length:8},(_,i)=>entry(`E${i}`,Array.from({length:4},()=>`M${Math.floor(random()*8)}`).join(' ')+' toString'));
    const macros=Object.fromEntries(entries.map((e,i)=>[`M${i}`,macro(e.id)]));
    const rows=Array.from({length:8},(_,i)=>edge(`r${i}`,`E${Math.floor(random()*8)}`,`E${Math.floor(random()*8)}`,{generator:i%2?'foreign':'macro-source-scan',isAtomic:random()<0.5}));
    const scope={entryIds:run%2?new Set(['E0','E2','E4']):null};
    const expected=oracle.reconcileDependencyRelationships(entries,macros,rows,scope);
    const plan=candidate.planDependencyRelationships(entries,macros,rows,scope);
    assert.deepEqual(plan.relationships,expected.relationships);assert.deepEqual(plan.report,expected.report);
    const again=candidate.planDependencyRelationships(entries,macros,plan.relationships,scope);
    assert.deepEqual(again.changes,{added:[],removed:[],updated:[]});
  }
});
