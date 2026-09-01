import * as path from 'node:path';
import { querySnoogl, type SnoogleMode } from '../../lib/snoogle-query.ts';
import { formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG, type FlagSpec } from '../../lib/cli-args.ts';

const MACRO_FLAG: FlagSpec = { name: 'macro', hasValue: true, help: 'Search the Macro catalog with one free-form query.' };
const ENTRY_FLAG: FlagSpec = { name: 'entry', hasValue: true, help: 'Search the Entry catalog with one free-form query.' };
const SPECS = [ROOT_FLAG, MACRO_FLAG, ENTRY_FLAG, JSON_FLAG, HELP_FLAG];

function usage(): string {
  return formatUsage('snoogle', '(--macro <query> | --entry <query>)', SPECS);
}

async function main(): Promise<number> {
  let parsed;
  try { parsed = parseArgs(process.argv.slice(2), SPECS); }
  catch (error) { process.stderr.write(`${(error as Error).message}\n\n${usage()}\n`); return 2; }
  if (parsed.flags.help === true) { process.stdout.write(usage() + '\n'); return 0; }
  const macro = parsed.flags.macro;
  const entry = parsed.flags.entry;
  if (parsed.positional.length || (typeof macro === 'string') === (typeof entry === 'string')) {
    process.stderr.write(`Expected exactly one mutually exclusive --macro <query> or --entry <query>.\n\n${usage()}\n`);
    return 2;
  }
  const mode: SnoogleMode = typeof macro === 'string' ? 'macro' : 'entry';
  const query = String(mode === 'macro' ? macro : entry);
  try {
    const response = await querySnoogl(path.resolve(String(parsed.flags.root)), mode, query);
    if (parsed.flags.json === true) process.stdout.write(JSON.stringify(response, null, 2) + '\n');
    else {
      process.stdout.write(`SNoogL ${mode} query ${JSON.stringify(query)}: ${response.results.length} result(s)\n`);
      for (const hit of response.results) {
        const detail = hit.kind === 'entry' ? hit.title : `${hit.packageId} (${hit.packageName})`;
        process.stdout.write(`  ${hit.id}\t${hit.score.toFixed(6)}${detail ? `\t${detail}` : ''}\n`);
      }
    }
    return 0;
  } catch (error) { process.stderr.write(`${(error as Error).message}\n`); return 2; }
}

process.exitCode = await main();
