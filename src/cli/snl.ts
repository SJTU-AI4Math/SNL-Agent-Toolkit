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
import { parseBatchJson } from '../../lib/batch.ts';

declare const __SNL_CLI_EXECUTABLE__: boolean | undefined;

interface ParsedCli { request?: OperationRequest; json: boolean; error?: string }
function parseCli(argv: string[]): ParsedCli {
  let root = '.'; let json = false; let help = false; const positional: string[] = []; const args: JsonObject = {};
  const valueFlags: Record<string, string> = { '--root': 'root', '-r': 'root', '--input': 'input', '-i': 'input', '--preset': 'preset', '--if-match': 'expectedRevision', '--to': 'to', '--limit': 'limit', '--cursor': 'cursor', '--query': 'query', '--mode': 'mode', '--scope': 'scope' };
  for (let i=0;i<argv.length;i++) {
    const token=argv[i];
    if (token==='--json') { json=true; continue; }
    if (token==='--dry-run') { args.dryRun=true; continue; }
    if (token==='--help' || token==='-h') { help=true; continue; }
    const key=Object.hasOwn(valueFlags, token) ? valueFlags[token] : undefined;
    if (key) { const value=argv[++i]; if(value===undefined)return{json,error:`${token} requires a value.`}; if(key==='root')root=value; else if(key==='limit')args.limit=Number(value); else args[key]=value; continue; }
    if (token.startsWith('-')) return {json,error:`Unknown flag ${token}.`};
    positional.push(token);
  }
  if (help) return { json, request: { protocol: OPERATION_PROTOCOL, command: 'help', root: path.resolve(root), arguments: {} } };
  const [domain,action,...rest]=positional; if(!domain)return{json,error:'Expected a command domain.'};
  const command=domain==='init'?'init':action?`${domain}/${action}`:domain;
  if (domain === 'init') {
    if (action || rest.length) return {json,error:'init accepts no identity positional; use --root <directory>, optionally with --preset <id> or --input <file|->.'};
  }
  if (command === 'validate' && args.scope === undefined) args.scope = 'workspace';
  const knownActions = new Set(['list','get','create','update','rename','delete']);
  const singleIdentityActions = new Set(['latex','references','usages']);
  if (action && knownActions.has(action)) {
    if (action==='list' || action==='create') { if(rest.length)return{json,error:`${action} accepts no identity positional.`}; }
    else { if(rest.length!==1)return{json,error:`${command} requires one exact identity.`}; args.id=rest[0]; }
  } else if (action && singleIdentityActions.has(action)) {
    if(rest.length!==1)return{json,error:`${command} requires one exact identity.`}; args.id=rest[0];
  } else if (command === 'repair/package-entry-ids') {
    if(rest.length!==1)return{json,error:`${command} requires one exact Package identity.`}; args.id=rest[0];
  } else if (rest.length) return {json,error:`${command} does not accept identity positionals.`};
  return {json,request:{protocol:OPERATION_PROTOCOL,command,root:path.resolve(root),arguments:args}};
}
async function readInput(file: string, batch = false): Promise<unknown> {
  const text=file==='-'?await new Promise<string>((resolve,reject)=>{let data='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>resolve(data));process.stdin.on('error',reject);}):await fs.readFile(path.resolve(file),'utf8');
  return batch ? parseBatchJson(text) : JSON.parse(text);
}
function webArguments(argv: string[]): { root: string; port: number; json: boolean; error?: string } | null {
  if (argv.includes('--help') || argv.includes('-h')) return null;
  let root = '.'; let port = 4911; let json = false; let error: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--json') { json = true; continue; }
    if (token === '--root' || token === '-r') {
      if (argv[i + 1] === undefined) return { root, port, json, error: `${token} requires a value.` };
      root = argv[++i]; continue;
    }
    if (token === '--port') {
      const value = argv[++i];
      if (!value || !/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535) error = '--port requires an integer from 1 to 65535.';
      else port = Number(value);
      continue;
    }
    return null; // Existing domains and unknown flags remain owned by the operation parser.
  }
  return { root: path.resolve(root), port, json, error };
}
export async function main(argv=process.argv.slice(2)): Promise<number> {
  const web = webArguments(argv);
  if (web) {
    if (web.error) {
      process.stdout.write(JSON.stringify(operationFailure('web', 2, 'usage.invalid', web.error).response) + '\n'); return 2;
    }
    try {
      const { startWebReader } = await import('../web/server');
      const running = await startWebReader(web.root, web.port);
      process.stdout.write(web.json
        ? JSON.stringify({ protocol: 'snl.web/v1', ok: true, url: running.url, root: running.root, readOnly: true }) + '\n'
        : `SNL read-only reader: ${running.url}\nWorkspace: ${JSON.stringify(running.root)}\nPress Ctrl+C to stop.\n`);
      await new Promise<void>((resolve, reject) => {
        let closing = false;
        const stop = () => {
          if (closing) return; closing = true;
          process.off('SIGINT', stop); process.off('SIGTERM', stop);
          running.close().then(resolve, reject);
        };
        process.on('SIGINT', stop); process.on('SIGTERM', stop);
      });
      return 0;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'web.start-failed';
      process.stdout.write(JSON.stringify(operationFailure('web', 2, code, error instanceof Error ? error.message : 'Web host failed.').response) + '\n');
      return 2;
    }
  }
  const parsed=parseCli(argv);
  if (!parsed.request) { const r=operationFailure('unknown',2,'usage.invalid',parsed.error??'Invalid invocation.');process.stdout.write(`${JSON.stringify(r.response)}\n`);return r.exitCode; }
  try {
    const input=parsed.request.arguments.input;
    if(typeof input==='string'){
      const value = await readInput(input, parsed.request.command.startsWith('batch/'));
      delete parsed.request.arguments.input;
      if (parsed.request.command === 'batch/check') parsed.request.arguments.operations = value;
      else if (parsed.request.command === 'batch/apply') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('batch apply input must be {operations,checkedDigest,expectedWorkspaceRevision}.');
        parsed.request.arguments = { ...parsed.request.arguments, ...value };
      } else parsed.request.arguments.value = value;
    }
  } catch(error) {
    const code=error instanceof SyntaxError?'input.invalid-json':'input.read-failed';const r=operationFailure(parsed.request.command,2,code,error instanceof Error?error.message:String(error));process.stdout.write(`${JSON.stringify(r.response)}\n`);return r.exitCode;
  }
  const result=await executeOperation(parsed.request);process.stdout.write(`${JSON.stringify(result.response)}\n`);return result.exitCode;
}
const isBuiltExecutable = typeof __SNL_CLI_EXECUTABLE__ !== 'undefined' && __SNL_CLI_EXECUTABLE__;
if (isBuiltExecutable || (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)) main().then(code=>{process.exitCode=code;});

export { executeOperation, OPERATION_PROTOCOL } from './operation.ts';
export type { OperationRequest, OperationResponse } from './operation.ts';
