import * as path from 'node:path';
import { findEntityReferences, type EntityType } from '../../lib/entity-references.ts';
import { formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG, type FlagSpec } from '../../lib/cli-args.ts';

const TYPE_FLAG: FlagSpec = {
  name: 'type', short: 't', hasValue: true,
  help: "Identity type: 'entry' or 'macro'.",
};
const SPECS = [ROOT_FLAG, TYPE_FLAG, JSON_FLAG, HELP_FLAG];

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
  const id = parsed.positional[0];
  if ((type !== 'entry' && type !== 'macro') || !id || parsed.positional.length !== 1) {
    process.stderr.write(`Expected --type entry|macro and exactly one id.\n\n${usage()}\n`);
    return 2;
  }
  try {
    const refs = await findEntityReferences(path.resolve(String(parsed.flags.root)), type as EntityType, id);
    if (parsed.flags.json === true) {
      process.stdout.write(JSON.stringify({ type, id, occurrences: refs }, null, 2) + '\n');
    } else if (refs.length === 0) {
      process.stdout.write(`No definition or structured references found for ${type} '${id}'.\n`);
    } else {
      process.stdout.write(`${type} '${id}': ${refs.length} occurrence(s)\n`);
      for (const ref of refs) {
        const position = ref.snlLine === undefined ? '' : ` @ snl ${ref.snlLine}:${ref.snlColumn}`;
        process.stdout.write(`  ${ref.role.padEnd(10)} ${ref.file}  ${ref.path}${position}\n`);
      }
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 2;
  }
}

function usage(): string {
  return formatUsage('snl-find-refs', '--type entry|macro <id>', SPECS);
}

process.exitCode = await main();
