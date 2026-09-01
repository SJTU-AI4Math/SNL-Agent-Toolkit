import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  executeOperation,
  OPERATION_PROTOCOL,
  operationFailure,
  type JsonObject,
  type OperationRequest,
} from './operation.ts';

interface ParsedCli { request?: OperationRequest; json: boolean; error?: string }
function parseCli(argv: string[]): ParsedCli {
  let root = '.'; let json = false; let help = false; const positional: string[] = []; const args: JsonObject = {};
  const valueFlags: Record<string, string> = { '--root': 'root', '-r': 'root', '--input': 'input', '-i': 'input', '--if-match': 'expectedRevision', '--limit': 'limit', '--cursor': 'cursor', '--query': 'query', '--mode': 'mode' };
  for (let i=0;i<argv.length;i++) {
    const token=argv[i];
    if (token==='--json') { json=true; continue; }
    if (token==='--help' || token==='-h') { help=true; continue; }
    const key=valueFlags[token];
    if (key) { const value=argv[++i]; if(value===undefined)return{json,error:`${token} requires a value.`}; if(key==='root')root=value; else if(key==='limit')args.limit=Number(value); else args[key]=value; continue; }
    if (token.startsWith('-')) return {json,error:`Unknown flag ${token}.`};
    positional.push(token);
  }
  if (help) return { json, request: { protocol: OPERATION_PROTOCOL, command: 'help', root: path.resolve(root), arguments: {} } };
  const [domain,action,...rest]=positional; if(!domain)return{json,error:'Expected a command domain.'};
  const command=action?`${domain}/${action}`:domain;
  const knownActions = new Set(['list','get','create','update','delete']);
  const singleIdentityActions = new Set(['latex','references','usages']);
  if (action && knownActions.has(action)) {
    if (action==='list' || action==='create') { if(rest.length)return{json,error:`${action} accepts no identity positional.`}; }
    else { if(rest.length!==1)return{json,error:`${command} requires one exact identity.`}; args.id=rest[0]; }
  } else if (action && singleIdentityActions.has(action)) {
    if(rest.length!==1)return{json,error:`${command} requires one exact identity.`}; args.id=rest[0];
  } else if (rest.length) return {json,error:`${command} does not accept identity positionals.`};
  return {json,request:{protocol:OPERATION_PROTOCOL,command,root:path.resolve(root),arguments:args}};
}
async function readInput(file: string): Promise<unknown> {
  const text=file==='-'?await new Promise<string>((resolve,reject)=>{let data='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>resolve(data));process.stdin.on('error',reject);}):await fs.readFile(path.resolve(file),'utf8');
  return JSON.parse(text);
}
export async function main(argv=process.argv.slice(2)): Promise<number> {
  const parsed=parseCli(argv);
  if (!parsed.request) { const r=operationFailure('unknown',2,'usage.invalid',parsed.error??'Invalid invocation.');process.stdout.write(`${JSON.stringify(r.response)}\n`);return r.exitCode; }
  try {
    const input=parsed.request.arguments.input;
    if(typeof input==='string'){parsed.request.arguments.value=await readInput(input);delete parsed.request.arguments.input;}
  } catch(error) {
    const code=error instanceof SyntaxError?'input.invalid-json':'input.read-failed';const r=operationFailure(parsed.request.command,2,code,error instanceof Error?error.message:String(error));process.stdout.write(`${JSON.stringify(r.response)}\n`);return r.exitCode;
  }
  const result=await executeOperation(parsed.request);process.stdout.write(`${JSON.stringify(result.response)}\n`);return result.exitCode;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().then(code=>{process.exitCode=code;});

export { executeOperation, OPERATION_PROTOCOL } from './operation.ts';
export type { OperationRequest, OperationResponse } from './operation.ts';
