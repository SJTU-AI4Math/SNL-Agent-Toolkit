import * as path from 'node:path';
import { renameEntityId, type EntityType } from '../../lib/entity-references.ts';
import { formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG, type FlagSpec } from '../../lib/cli-args.ts';

const TYPE_FLAG: FlagSpec = {
  name: 'type', short: 't', hasValue: true,
  help: "Identity type: 'entry' or 'macro'.",
};
const DRY_RUN_FLAG: FlagSpec = {
  name: 'dry-run', hasValue: false, default: false,
  help: 'Validate and print the rename plan without writing files.',
};
const SPECS = [ROOT_FLAG, TYPE_FLAG, DRY_RUN_FLAG, JSON_FLAG, HELP_FLAG];

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${usage()}\n`);
    return 2;
  }
  if (parsed.flags.help === true) {
    process.stdout.write(usage() + '\n');
    return 0;
  }
  const type = parsed.flags.type;
  const [oldId, newId] = parsed.positional;
  if ((type !== 'entry' && type !== 'macro') || !oldId || !newId || parsed.positional.length !== 2) {
    process.stderr.write(`Expected --type entry|macro and exactly <old-id> <new-id>.\n\n${usage()}\n`);
    return 2;
  }
  try {
    const dryRun = parsed.flags['dry-run'] === true;
    const plan = await renameEntityId(
      path.resolve(String(parsed.flags.root)), type as EntityType, oldId, newId, { dryRun },
    );
    if (parsed.flags.json === true) {
      process.stdout.write(JSON.stringify({ ...plan, dryRun }, null, 2) + '\n');
    } else {
      process.stdout.write(
        `${dryRun ? 'Would rename' : 'Renamed'} ${type} '${oldId}' -> '${newId}'\n` +
        `  occurrences: ${plan.occurrences.length}\n` +
        `  files: ${plan.changedFiles.length}\n`,
      );
      for (const file of plan.changedFiles) process.stdout.write(`    ${file}\n`);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 2;
  }
}

function usage(): string {
  return formatUsage('snl-rename-id', '--type entry|macro <old-id> <new-id>', SPECS);
}

process.exitCode = await main();
