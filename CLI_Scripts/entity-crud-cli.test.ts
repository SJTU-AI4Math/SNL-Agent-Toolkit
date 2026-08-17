import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { entryEntityPath, macroEntityPath, makeEntityStorageReceipt, packageManifestPath } from '../lib/entity-storage.ts';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
async function json(file: string, value: unknown) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), 'snl-entity-crud-')); roots.push(root);
  const doc = path.join(root, '.SNL_Doc');
  await Promise.all(['entries','macros','packages','libraries/demo'].map((dir) => mkdir(path.join(doc, dir), { recursive: true })));
  await json(path.join(doc, 'config.json'), {
    version: '0.0.6',
    entry_kinds: [{ id: 'definition', name: 'Definition', coloring: { stroke: '#000', background: '#fff' }, style: '' }],
    macro_kinds: [{ id: 'term', name: 'Term', description: '', coloring: { stroke: '#000', background: '#fff' } }],
    active_macro_packages: ['Logic'],
    entity_storage: { version: 1, legacy_backup_version: '0.0.5', entry_default_package: '_unpackaged', receipt: makeEntityStorageReceipt(null, new Map(), false) },
  });
  for (const [id,name] of [['_unpackaged','Unpackaged'],['Logic','Logic']]) await json(path.join(doc, packageManifestPath(id)), { format:'snl-package',version:1,id,name,description:'' });
  const entry = { id:'entry.demo',package:'Logic',kind:'definition',title:'Demo',content:{},contribution_info:null,pointer:null };
  await json(path.join(doc, entryEntityPath('Logic', entry.id)), { format:'snl-entry',version:1,package:'Logic',entry });
  const macro = { name:'Logic.term',description:'',source:{entries:[],urls:[]},dynamic_arity:false,default_style:{en:'default'},tags:[],styles:[{style_name:'default',mode:'text',template:'term',tags:[]}] };
  await json(path.join(doc, macroEntityPath('Logic', macro.name)), { format:'snl-macro',version:1,package:'Logic',macro });
  await json(path.join(doc, 'relationships.json'), { version:1, relationships:[{id:'rel.demo',from:'entry.demo',to:'entry.demo',label:'related',metadata:{}}] });
  await json(path.join(doc, 'libraries/demo/meta.json'), { title:'Demo' });
  await json(path.join(doc, 'libraries/demo/graph.json'), { nodes:[],relationships:[] });
  await json(path.join(doc, 'libraries/demo/counters.json'), { counters:[] });
  return { root, doc };
}
function run(root: string, args: string[]) { return spawnSync(process.execPath, ['bin/snl-entity.mjs','--root',root,'--json',...args], { cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8' }); }

describe('unified entity CLI', () => {
  it('lists all eight entity families with exact stable ids and revisions', async () => {
    const { root } = await workspace();
    const expected: Record<string,string[]> = {
      'entry-kind':['definition'], 'macro-kind':['term'], 'entry-package':['_unpackaged','Logic'],
      'macro-package':['_unpackaged','Logic'], entry:['entry.demo'], macro:['Logic::Logic.term'],
      relationship:['rel.demo'], library:['demo'],
    };
    for (const [type, ids] of Object.entries(expected)) {
      const result = run(root, ['list','--type',type]);
      assert.equal(result.status, 0, `${type}: ${result.stderr || result.stdout}`);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.status, 'ok'); assert.equal(payload.operation, 'list'); assert.equal(payload.type, type);
      assert.deepEqual(payload.entities.map((item: {id:string}) => item.id), ids);
      assert.ok(payload.entities.every((item: {revision:string}) => /^[a-f0-9]{64}$/.test(item.revision)));
    }
  });
  it('creates, updates with CAS, and deletes an entity through one stable JSON surface', async () => {
    const { root } = await workspace();
    const draft = path.join(root, 'kind.json');
    await json(draft, { id:'lemma',name:'Lemma',coloring:{stroke:'#111',background:'#eee'},style:'' });
    let result = run(root, ['create','--type','entry-kind','--input',draft]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let entity = JSON.parse(result.stdout).entity;
    assert.equal(entity.id, 'lemma');
    const firstRevision = entity.revision;

    await json(draft, { id:'lemma',name:'Updated lemma',coloring:{stroke:'#111',background:'#eee'},style:'' });
    result = run(root, ['update','--type','entry-kind','--if-match','0'.repeat(64),'--input',draft,'lemma']);
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).code, 'entity.revision-conflict');
    result = run(root, ['update','--type','entry-kind','--if-match',firstRevision,'--input',draft,'lemma']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    entity = JSON.parse(result.stdout).entity; assert.equal(entity.value.name, 'Updated lemma');

    result = run(root, ['delete','--type','entry-kind','--if-match',firstRevision,'lemma']);
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).code, 'entity.revision-conflict');
    result = run(root, ['delete','--type','entry-kind','--if-match',entity.revision,'lemma']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(run(root, ['get','--type','entry-kind','lemma']).status, 1);
  });

  it('creates and deletes every disk-backed family with exact composite identities', async () => {
    const cases: Array<{type:string,id:string,payload:Record<string,unknown>}> = [
      { type:'entry-package', id:'PkgE', payload:{id:'PkgE',name:'Entry package',description:''} },
      { type:'macro-package', id:'PkgM', payload:{id:'PkgM',name:'Macro package',description:''} },
      { type:'entry', id:'entry.new', payload:{id:'entry.new',package:'Logic',kind:'definition',title:'New',content:{},contribution_info:null,pointer:null} },
      { type:'macro', id:'Logic::Logic.new', payload:{package:'Logic',name:'Logic.new',styles:[{style_name:'default',mode:'text',template:'new'}]} },
      { type:'relationship', id:'rel.new', payload:{id:'rel.new',from:'entry.demo',to:'entry.demo',label:'related',metadata:{}} },
      { type:'library', id:'new-library', payload:{slug:'new-library',meta:{title:'New'},graph:{nodes:[],relationships:[]},counters:{counters:[]}} },
    ];
    for (const item of cases) {
      const { root } = await workspace(); const draft=path.join(root,`${item.type}.json`); await json(draft,item.payload);
      let result=run(root,['create','--type',item.type,'--input',draft]);
      assert.equal(result.status,0,`${item.type}: ${result.stderr||result.stdout}`);
      const created=JSON.parse(result.stdout).entity; assert.equal(created.id,item.id);
      result=run(root,['get','--type',item.type,item.id]); assert.equal(result.status,0,result.stderr||result.stdout);
      result=run(root,['delete','--type',item.type,'--if-match',created.revision,item.id]);
      assert.equal(result.status,0,`${item.type}: ${result.stderr||result.stdout}`);
      assert.equal(run(root,['get','--type',item.type,item.id]).status,1);
    }
  });

  it('updates every disk-backed family while preserving exact identity', async () => {
    const cases: Array<{type:string,id:string,mutate:(value:Record<string,unknown>)=>void}> = [
      {type:'entry-package',id:'Logic',mutate:(v)=>{v.description='entries updated';}},
      {type:'macro-package',id:'Logic',mutate:(v)=>{v.description='macros updated';}},
      {type:'entry',id:'entry.demo',mutate:(v)=>{v.title='Updated';}},
      {type:'macro',id:'Logic::Logic.term',mutate:(v)=>{v.description='Updated';}},
      {type:'relationship',id:'rel.demo',mutate:(v)=>{v.label='updated';}},
      {type:'library',id:'demo',mutate:(v)=>{(v.meta as Record<string,unknown>).title='Updated';}},
    ];
    for (const item of cases) {
      const {root}=await workspace(); const before=JSON.parse(run(root,['get','--type',item.type,item.id]).stdout).entity;
      item.mutate(before.value); const draft=path.join(root,`${item.type}-update.json`); await json(draft,before.value);
      const result=run(root,['update','--type',item.type,'--if-match',before.revision,'--input',draft,item.id]);
      assert.equal(result.status,0,`${item.type}: ${result.stderr||result.stdout}`);
      const after=JSON.parse(result.stdout).entity; assert.equal(after.id,item.id); assert.notEqual(after.revision,before.revision);
    }
  });

  it('honors the shared writer lock and reports operational failures with exit 2', async () => {
    const {root,doc}=await workspace(); await writeFile(path.join(doc,'.data-write.lock'),'occupied\n');
    const draft=path.join(root,'kind.json'); await json(draft,{id:'locked',name:'Locked',coloring:{stroke:'',background:''},style:''});
    const result=run(root,['create','--type','entry-kind','--input',draft]);
    assert.equal(result.status,2); assert.equal(JSON.parse(result.stdout).status,'error');
    assert.match(JSON.parse(result.stdout).message,/locked/i);
  });

  it('rejects writes through a symlinked workspace root', async () => {
    const {root}=await workspace(); const parent=await mkdtemp(path.join(tmpdir(),'snl-entity-alias-')); roots.push(parent);
    const alias=path.join(parent,'alias'); await symlink(root,alias,'dir'); const draft=path.join(parent,'kind.json');
    await json(draft,{id:'unsafe',name:'Unsafe',coloring:{stroke:'',background:''},style:''});
    const result=run(alias,['create','--type','entry-kind','--input',draft]); assert.equal(result.status,2);
    assert.match(JSON.parse(result.stdout).message,/canonical|symlink/i);
  });

  it('rejects malformed updates without changing the entity revision', async () => {
    const {root}=await workspace(); const before=JSON.parse(run(root,['get','--type','entry','entry.demo']).stdout).entity;
    const draft=path.join(root,'bad-entry.json'); await json(draft,{id:'entry.demo',package:'Logic'});
    const result=run(root,['update','--type','entry','--if-match',before.revision,'--input',draft,'entry.demo']);
    assert.equal(result.status,1); assert.equal(JSON.parse(result.stdout).status,'invalid');
    assert.equal(JSON.parse(run(root,['get','--type','entry','entry.demo']).stdout).entity.revision,before.revision);
  });

  it('refuses to delete an Entry that still has structured references', async () => {
    const {root}=await workspace(); const entity=JSON.parse(run(root,['get','--type','entry','entry.demo']).stdout).entity;
    const result=run(root,['delete','--type','entry','--if-match',entity.revision,'entry.demo']);
    assert.equal(result.status,1); assert.equal(JSON.parse(result.stdout).code,'entity.referenced');
    assert.equal(run(root,['get','--type','entry','entry.demo']).status,0);
  });

  it('refuses to delete a Macro that is still referenced by SNL', async () => {
    const {root}=await workspace(); const entry=JSON.parse(run(root,['get','--type','entry','entry.demo']).stdout).entity;
    entry.value.content={snl:'Logic.term'}; const draft=path.join(root,'entry-with-macro.json'); await json(draft,entry.value);
    assert.equal(run(root,['update','--type','entry','--if-match',entry.revision,'--input',draft,'entry.demo']).status,0);
    const macro=JSON.parse(run(root,['get','--type','macro','Logic::Logic.term']).stdout).entity;
    const result=run(root,['delete','--type','macro','--if-match',macro.revision,'Logic::Logic.term']);
    assert.equal(result.status,1); assert.equal(JSON.parse(result.stdout).code,'entity.referenced');
  });

  it('preserves existing JSON file permission modes on atomic replacement', async () => {
    const {root,doc}=await workspace(); const configFile=path.join(doc,'config.json'); await chmod(configFile,0o600);
    const before=JSON.parse(run(root,['get','--type','entry-kind','definition']).stdout).entity; before.value.name='Private';
    const draft=path.join(root,'kind-private.json'); await json(draft,before.value);
    assert.equal(run(root,['update','--type','entry-kind','--if-match',before.revision,'--input',draft,'definition']).status,0);
    assert.equal((await stat(configFile)).mode&0o777,0o600);
  });

});
