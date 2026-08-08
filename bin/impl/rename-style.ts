import * as path from 'node:path';
import { renameStyle } from '../../lib/entity-references.ts';
import { formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG, type FlagSpec } from '../../lib/cli-args.ts';

const PACKAGE_FLAG: FlagSpec = { name: 'package', hasValue: true, help: 'Owning Package ID.' };
const MACRO_FLAG: FlagSpec = { name: 'macro', hasValue: true, help: 'Owning Macro ID.' };
const DRY_RUN_FLAG: FlagSpec = { name: 'dry-run', hasValue: false, default: false, help: 'Validate and print the plan without writing.' };
const SPECS = [ROOT_FLAG, PACKAGE_FLAG, MACRO_FLAG, DRY_RUN_FLAG, JSON_FLAG, HELP_FLAG];

function usage(): string {
  return formatUsage('snl-rename-style', '--package <id> --macro <id> [--dry-run] <old-style> <new-style>', SPECS);
}

async function main(): Promise<number> {
  let parsed;
  try { parsed = parseArgs(process.argv.slice(2), SPECS); }
  catch (error) { process.stderr.write(`${(error as Error).message}\n\n${usage()}\n`); return 2; }
  if (parsed.flags.help === true) { process.stdout.write(usage() + '\n'); return 0; }
  const packageId = parsed.flags.package;
  const macroId = parsed.flags.macro;
  const [oldStyle, newStyle] = parsed.positional;
  if (typeof packageId !== 'string' || typeof macroId !== 'string' || !oldStyle || !newStyle || parsed.positional.length !== 2) {
    process.stderr.write(`Expected --package <id> --macro <id> and exactly <old-style> <new-style>.\n\n${usage()}\n`);
    return 2;
  }
  const dryRun = parsed.flags['dry-run'] === true;
  try {
    const plan = await renameStyle(path.resolve(String(parsed.flags.root)), packageId, macroId, oldStyle, newStyle, { dryRun });
    if (parsed.flags.json === true) process.stdout.write(JSON.stringify({ ...plan, dryRun }, null, 2) + '\n');
    else {
      process.stdout.write(`${dryRun ? 'Would rename' : 'Renamed'} Style (${packageId}, ${macroId}, ${oldStyle}) -> ${newStyle}\n`);
      process.stdout.write(`  occurrences: ${plan.occurrences.length}\n  files: ${plan.changedFiles.length}\n`);
      for (const file of plan.changedFiles) process.stdout.write(`    ${file}\n`);
    }
    return 0;
  } catch (error) { process.stderr.write(`${(error as Error).message}\n`); return 2; }
}

process.exitCode = await main();
