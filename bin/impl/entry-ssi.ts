import * as path from 'node:path';
import { computeEntrySsi } from '../../lib/entry-analysis.ts';
import { formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG } from '../../lib/cli-args.ts';

const SPECS = [ROOT_FLAG, JSON_FLAG, HELP_FLAG];
const usage = () => formatUsage('snl-entry-ssi', '[options] <entry-id>', SPECS);
async function main(): Promise<number> {
  let parsed;
  try { parsed = parseArgs(process.argv.slice(2), SPECS); }
  catch (error) {
    const message = (error as Error).message;
    const jsonMode = process.argv.slice(2).includes('--json');
    if (jsonMode) process.stdout.write(JSON.stringify({ status: 'error', code: 'invocation.invalid', message }) + '\n');
    else process.stderr.write(`${message}\n\n${usage()}\n`);
    return 2;
  }
  if (parsed.flags.help === true) { process.stdout.write(usage() + '\n'); return 0; }
  if (parsed.positional.length !== 1) {
    const message = 'Expected exactly one Entry id.';
    if (parsed.flags.json === true) process.stdout.write(JSON.stringify({ status: 'error', code: 'invocation.invalid', message }) + '\n');
    else process.stderr.write(`${message}\n\n${usage()}\n`);
    return 2;
  }
  try {
    const entryId = parsed.positional[0];
    const metrics = await computeEntrySsi(path.resolve(String(parsed.flags.root)), entryId);
    const result = { status: 'ok', entryId, metrics };
    process.stdout.write(parsed.flags.json === true ? JSON.stringify(result, null, 2) + '\n' : `${entryId}\tSSI=${metrics.structuralIndex.toFixed(6)}\tstrong=${metrics.strongSemanticFreedom}\tweak=${metrics.weakSemanticFreedom}\n`);
    return 0;
  } catch (error) {
    const message = (error as Error).message;
    if (parsed.flags.json === true) process.stdout.write(JSON.stringify({ status: 'error', code: message.startsWith('Entry not found:') ? 'entry.not-found' : 'entry.analysis-failed', message }) + '\n');
    else process.stderr.write(`${message}\n`);
    return 2;
  }
}
process.exitCode = await main();
