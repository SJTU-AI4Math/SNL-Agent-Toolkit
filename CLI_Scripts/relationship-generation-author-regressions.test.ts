// Forward-port of the formerly untracked snl-graph-relationships regression suite.
// The independent oracle is the repository's pinned CURRENT Extension source.
// Historical absolute-path dependency and parallel-edge semantics are not retained.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as candidate from '../lib/relationship-generation.ts';
import { reconcileDependencyRelationships, computeAtomicityInPlace, extractSnlReferences, planDependencyRelationships } from '../lib/relationship-generation.ts';
import type { RelationshipData } from '../lib/relationship-generation.ts';
import type { EntryData, MacroPackageEntry } from '../lib/snl-doc-schema.ts';
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
const entry = (id: string, snl = ''): EntryData => ({ id, kind: 'definition', title: id, content: { snl }, contribution_info: null, pointer: null });
const macro = (name: string, entries: string[]): MacroPackageEntry => ({ name, description: '', source: { entries, urls: [] }, dynamic_arity: false, styles: [], tags: [] });
test('macro source entries generate depends, retain transitive edges and mark composite metadata', () => {
  const result = reconcileDependencyRelationships([entry('a', 'mb mc'), entry('b', 'mc'), entry('c')], { mb: macro('mb', ['b']), mc: macro('mc', ['c']) }, [], { entryIds: null });
  assert.deepEqual(result.relationships.map(r => [r.id, (r.metadata as any).isAtomic]), [['dep.a.b', true], ['dep.a.c', false], ['dep.b.c', true]]);
});

const auto = (id: string, from: string, to: string, label = 'depends'): RelationshipData => ({ id, from, to, label, metadata: { generator: 'macro-source-scan', isAtomic: true, macros: ['old'] } });
const argsParity = (entries: EntryData[], macros: Record<string, MacroPackageEntry>, existing: RelationshipData[], scope = { entryIds: null as Set<string> | null }) => {
  const before = structuredClone({ entries, macros, existing });
  const expected = oracle.reconcileDependencyRelationships(structuredClone(entries), structuredClone(macros), structuredClone(existing), scope);
  const actual = reconcileDependencyRelationships(entries, macros, existing, scope);
  assert.deepEqual(actual, expected);
  assert.deepEqual({ entries, macros, existing }, before, 'input snapshots remain unchanged');
  return actual;
};
test('tokenizer matches pinned current Extension across leaves, binders, attributes and postfixes', () => {
  for (const snl of ['', 'mb %mc% $mb$ $$mc$$ @mc mb[x,y] context@target', 'x[a]@target mb @%mc% _constructor __proto__', '%unclosed mc', '$unclosed mc', 'x@A.B @binding pkg.name(foo)', 'x@42 nested[mb[mc]] m']) {
    assert.deepEqual(extractSnlReferences(snl), oracle.extractSnlReferences(snl));
  }
});
test('scope/manual/context/foreign metadata preservation; merged graph marks only regenerated rows', () => {
  const existing = [auto('old', 'a', 'stale'), auto('out', 'b', 'c'), auto('ctx', 'a', 'stale', 'uses_context'),
    { id: 'manual', from: 'a', to: 'c', label: 'depends', metadata: { isAtomic: 'author', nested: [1, { x: true }] } },
    { id: 'foreign', from: 'a', to: 'stale', label: 'depends', metadata: { generator: 'other', isAtomic: false } }];
  const entries = [entry('a', 'mb mc x@context'), entry('b'), entry('c'), entry('context'), entry('stale')];
  const catalog = { mb: macro('mb', ['b']), mc: macro('mc', ['c']) };
  const result = argsParity(entries, catalog, existing, { entryIds: new Set(['a']) });
  assert.equal(result.relationships.some(r => r.id === 'old'), false);
  for (const row of existing.slice(1)) assert.deepEqual(result.relationships.find(r => r.id === row.id), row);
  assert.equal(result.relationships.filter(r => r.label === 'uses_context').length, 1);
  assert.equal((result.relationships.find(r => r.id === 'dep.a.c')!.metadata as any).isAtomic, false);
  assert.deepEqual(argsParity(entries, catalog, existing, { entryIds: new Set() }).relationships, [...existing].sort((a,b)=>a.id<b.id?-1:1));
});
test('witness dedup, missing/self suppression, cycle preservation and deterministic collision allocation', () => {
  const result = argsParity([entry('a', 'mb mb alias ma'), entry('b', 'ma')], { mb: macro('mb', ['b','b','missing']), alias: macro('alias', ['b']), ma: macro('ma', ['a']) }, [
    { id: 'dep.a.b', from: 'a', to: 'b', label: 'custom', metadata: null },
    { id: 'dep.a.b.1', from: 'a', to: 'b', label: 'custom', metadata: null }
  ]);
  assert.deepEqual(result.relationships.find(r => r.id === 'dep.a.b.2')!.metadata, { generator: 'macro-source-scan', macros: ['alias','mb'], isAtomic: true });
  assert.ok(result.relationships.some(r => r.id === 'dep.b.a'));
  const again = argsParity([entry('a', 'mb alias'), entry('b', 'ma')], { mb: macro('mb',['b']),alias:macro('alias',['b']),ma:macro('ma',['a']) }, result.relationships);
  assert.deepEqual(again.relationships,result.relationships);
});
test('owned special macro keys resolve; inherited macro catalog properties never create edges', () => {
  const catalog = Object.create({ inherited: macro('inherited',['b']) });
  Object.defineProperty(catalog,'__proto__',{value:macro('__proto__',['b']),enumerable:true});
  assert.deepEqual(reconcileDependencyRelationships([entry('a','inherited __proto__'),entry('b')],catalog,[],{entryIds:null}).relationships[0].metadata,
    { generator:'macro-source-scan',macros:['__proto__'],isAtomic:true });
});
test('exact atomicity parity over cyclic/multigraph/self-edge and DAG graphs, selected updates only', () => {
  let seed = 7391;
  const rand = () => (seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296;
  for (let run=0;run<300;run++) {
    const rows: RelationshipData[]=[];
    for(let edge=0;edge<40;edge++) {
      let a=Math.floor(rand()*10),b=Math.floor(rand()*10);
      if(run%2===0) { if(a===b) continue; if(a>b) [a,b]=[b,a]; }
      rows.push(auto(String(edge),String(a),String(b),['depends','uses_context','custom'][Math.floor(rand()*3)]));
    }
    const expected=structuredClone(rows),actual=structuredClone(rows);
    const select=(r:RelationshipData)=>Number(r.id)%3!==0;
    oracle.computeAtomicityInPlace(expected,select);
    computeAtomicityInPlace(actual,select);
    assert.deepEqual(actual,expected,`graph ${run}`);
  }
});
test('exact complete reconciler parity over generated random scoped snapshots', () => {
  let seed=93;
  const rand=()=> (seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
  for(let run=0;run<150;run++) {
    const entries=Array.from({length:12},(_,i)=>entry('e'+i,Array.from({length:7},()=> 'm'+Math.floor(rand()*12)).join(' ')));
    const macros=Object.fromEntries(entries.map((e,i)=>['m'+i,macro('m'+i,[e.id,'e'+Math.floor(rand()*12)])]));
    const existing=[auto('prior','e0','e1'),auto('context','e0','e2','uses_context'),{id:'manual',from:'e0',to:'e3',label:'depends',metadata:null}];
    argsParity(entries,macros,existing,{entryIds:run%2===0?null:new Set(['e0','e3','e4'])});
  }
});

test('plan actual changes differ from upstream regenerated updated count; deterministic no-op',()=>{
  const entries=[entry('a','mb'),entry('b'),entry('c')],catalog={mb:macro('mb',['b'])};
  const first=planDependencyRelationships(entries,catalog,[auto('stale','a','c')],{entryIds:null});
  assert.deepEqual(first.changes.added.map(r=>r.id),['dep.a.b']);
  assert.deepEqual(first.changes.removed.map(r=>r.id),['stale']);
  assert.equal(first.provenance.revision,candidate.RELATIONSHIP_GENERATION_PROVENANCE.revision);
  const again=planDependencyRelationships(entries,catalog,first.relationships,{entryIds:null});
  assert.equal(again.report.updated,1);
  assert.deepEqual(again.changes,{added:[],removed:[],updated:[]});
  const updated=planDependencyRelationships([entry('a','alias'),entry('b')],{alias:macro('alias',['b'])},again.relationships,{entryIds:null});
  assert.equal(updated.changes.updated.length,1);
  assert.equal(updated.changes.updated[0].before.id,updated.changes.updated[0].after.id);
});
test('multi-word DAG closure parity across bit boundaries and parallel rows',()=>{
  const rows:RelationshipData[]=[];
  for(let from=0;from<180;from++)for(let step=1;step<=6;step++)if(from>=step)rows.push(auto(String(rows.length),String(from),String(from-step)));
  rows.push(auto('parallel','179','178'));
  const expected=structuredClone(rows),actual=structuredClone(rows);
  oracle.computeAtomicityInPlace(expected);computeAtomicityInPlace(actual);
  assert.deepEqual(actual,expected);
});
test('64MiB closure bound falls back exactly without quadratic allocation',()=>{
  const rows=Array.from({length:12000},(_,i)=>auto(String(i),'a'+i,'b'+i));
  const select=(r:RelationshipData)=>r.id==='0'||r.id==='11999';
  const expected=structuredClone(rows),actual=structuredClone(rows);
  oracle.computeAtomicityInPlace(expected,select);computeAtomicityInPlace(actual,select);
  assert.deepEqual(actual,expected);
});
test('10,000 Entry / 50,000 generated edge real scale, no reduction and exact sampled oracle',()=>{
  const entries:EntryData[]=[],catalog:Record<string,MacroPackageEntry>={};
  for(let i=0;i<10000;i++) {
    const refs=[];
    for(let step=1;step<=5;step++)if(i>=step)refs.push('m'+(i-step));
    if(i===9999)for(let step=6;step<=20;step++)refs.push('m'+(i-step));
    entries.push(entry('e'+i,refs.join(' ')));catalog['m'+i]=macro('m'+i,['e'+i]);
  }
  const before=process.memoryUsage();const start=performance.now();
  const result=planDependencyRelationships(entries,catalog,[],{entryIds:null});
  const elapsedMs=performance.now()-start;const after=process.memoryUsage();
  assert.equal(result.relationships.length,50000);assert.equal(result.report.atomicCount,9999);
  for(const row of result.relationships)assert.equal((row.metadata as any).isAtomic,Number(row.from.slice(1))-Number(row.to.slice(1))===1);
  const expected=structuredClone(result.relationships);
  const select=(r:RelationshipData)=>['e0','e1','e31','e32','e33','e1000','e9999'].includes(r.from);
  oracle.computeAtomicityInPlace(expected,select);assert.deepEqual(result.relationships,expected);
  console.log(JSON.stringify({scale:{nodes:entries.length,edges:result.relationships.length,atomic:result.report.atomicCount,elapsedMs,rssDeltaBytes:after.rss-before.rss,arrayBufferDeltaBytes:after.arrayBuffers-before.arrayBuffers}}));
});

test('exhaustive four-vertex directed graphs agree with exact Extension oracle',()=>{
  const pairs:Array<[string,string]>=[];
  for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(a!==b)pairs.push([String(a),String(b)]);
  for(let mask=0;mask<(1<<pairs.length);mask++) {
    const rows=pairs.flatMap(([from,to],i)=>(mask&(1<<i))?[auto(String(i),from,to)]:[]);
    const expected=structuredClone(rows),actual=structuredClone(rows);
    oracle.computeAtomicityInPlace(expected);computeAtomicityInPlace(actual);
    assert.deepEqual(actual,expected,`directed adjacency mask ${mask}`);
  }
});
test('readable dotted endpoint ID collisions and previous custom ID reuse are Extension exact',()=>{
  const entries=[entry('a','mbc'),entry('a.b','mc'),entry('b.c'),entry('c')];
  const catalog={mbc:macro('mbc',['b.c']),mc:macro('mc',['c'])};
  const first=argsParity(entries,catalog,[]);
  assert.deepEqual(first.relationships.map(r=>r.id),['dep.a.b.c','dep.a.b.c.1']);
  const previous=first.relationships.map(r=>r.from==='a'?{...r,id:'legacy-custom-id'}:r);
  const next=argsParity(entries,catalog,previous);
  assert.ok(next.relationships.some(r=>r.id==='legacy-custom-id'));
  assert.deepEqual(next.relationships.map(r=>r.id),['dep.a.b.c.1','legacy-custom-id']);
});
