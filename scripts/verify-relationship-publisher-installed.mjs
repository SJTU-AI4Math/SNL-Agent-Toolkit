// Run after prepack. Independent installed CLI + stdio MCP + DSH acceptance.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(import.meta.dirname, '..');
const evidence = path.resolve(process.argv[2]); await mkdir(evidence, { recursive: true });
const consumer = await mkdtemp(path.join(evidence, 'consumer-'));
await writeFile(path.join(consumer, 'package.json'), JSON.stringify({name:'snl-publisher-independent-consumer',version:'1.0.0',private:true,type:'module'}));
function run(bin, args, options = {}) { const r = spawnSync(bin, args, { cwd: consumer, encoding: 'utf8', timeout: 120000, ...options }); assert.equal(r.status, 0, r.stdout + r.stderr); return r.stdout; }
const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', evidence], { cwd: repo }))[0];
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(evidence, packed.filename)]);
const installed = path.join(consumer, 'node_modules/@snl-doc/agent-toolkit');
for (const relative of ['dist/cli/snl.mjs','dist/mcp/server.cjs','dist/dsh/adapter.mjs','agent-plugin/dist/mcp/server.cjs','lib/relationship-publisher.ts','lib/dependency-cache-descriptor.ts','lib/dependency-cache-storage.ts']) assert.deepEqual(await readFile(path.join(installed,relative)), await readFile(path.join(repo,relative)), relative);
const root = path.join(consumer, 'workspace'); await mkdir(root);
const cli = path.join(installed, 'dist/cli/snl.mjs');
function command(args, input) { return JSON.parse(run(process.execPath, [cli,...args,'--root',root,'--json'], { input: input === undefined ? undefined : JSON.stringify(input) })); }
command(['init']);
assert.ok(command(['--help']).data.commands.includes('relationship/generate'));
assert.ok(command(['relationship']).data.some(d=>d.command==='relationship/generate' && d.arguments.scope.required));
const preview = command(['relationship','generate','--scope','{}','--dry-run']).data;
assert.equal(preview.published,false);
const applied = command(['relationship','generate','--scope','{}','--if-workspace-match',preview.expectedWorkspaceRevision]).data;
assert.equal(applied.published,true); assert.equal(applied.resultingWorkspaceRevision,preview.expectedWorkspaceRevision);
assert.equal(command(['relationship','generate','--input','-'],{scope:{},dryRun:true}).data.inputHash,preview.inputHash);
const cache = path.join(root,'.SNL_Doc/.cache/dependencies/result.json');
const before = await readFile(cache,'utf8');
for (const bad of [{scope:{},dryRun:null},{scope:{local:true},dryRun:true}]) {
 const r=spawnSync(process.execPath,[cli,'relationship','generate','--input','-','--root',root,'--json'],{cwd:consumer,input:JSON.stringify(bad),encoding:'utf8'});
 assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).error.code,'operation.invalid-arguments');
}
assert.equal(await readFile(cache,'utf8'),before);
for (const relative of ['dist/mcp/server.cjs','agent-plugin/dist/mcp/server.cjs']) {
 const request={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'snl_execute',arguments:{root,command:'relationship/generate',arguments:{scope:{},expectedWorkspaceRevision:preview.expectedWorkspaceRevision}}}};
 const text=run(process.execPath,[path.join(installed,relative)],{input:JSON.stringify(request)+'\n'});
 const response=JSON.parse(text.trim()).result.structuredContent;
 assert.equal(response.ok,true,text);assert.equal(response.data.published,true);
 await writeFile(path.join(evidence,relative.startsWith('agent')?'agent-mcp.json':'mcp.json'),text);
}
const { apply } = await import(pathToFileURL(path.join(installed,'dist/dsh/adapter.mjs')).href);
const tools=[];await apply({tools:{register(tool){tools.push(tool);}}});
const execute=tools.find(t=>t.name==='snl_execute');assert.ok(execute);
const dsh=await execute.execute({root,command:'relationship/generate',arguments:{scope:{},expectedWorkspaceRevision:preview.expectedWorkspaceRevision}},{signal:new AbortController().signal});
assert.equal(dsh.ok,true);assert.equal(dsh.data.published,true);
const stale=await execute.execute({root,command:'relationship/generate',arguments:{scope:{},expectedWorkspaceRevision:'stale'}},{signal:new AbortController().signal});
assert.equal(stale.ok,false);assert.equal(stale.error.code,'relationship.workspace-conflict');
assert.equal(command(['validate']).data.valid,true);
const result={status:'PASS',consumer,packed,transports:['installed-cli','installed-mcp','installed-agent-plugin-mcp','installed-dsh'],preview,applied,dsh};
await writeFile(path.join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',consumer,tarball:packed.filename,transports:result.transports}));
