import * as path from 'node:path';
import { formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG } from '../../lib/cli-args.ts';
import { addPackageEntity } from '../../lib/entity-writes.ts';
import { emitFailure, emitHelp, failure, failureFromError, readDraftJson, wantsJson } from './add-cli-common.ts';

const SPECS = [ROOT_FLAG, JSON_FLAG, HELP_FLAG];

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
  } catch (error) {
    emitFailure(failure('usage', (error as Error).message), wantsJson(process.argv.slice(2)), usage());
    return 2;
  }
  if (parsed.flags.help === true) {
    emitHelp(usage(), parsed.flags.json === true);
    return 0;
  }
  if (parsed.positional.length !== 1) {
    emitFailure(
      failure('usage', 'snl-add-package requires exactly one draft JSON file.'),
      parsed.flags.json === true,
      usage(),
    );
    return 2;
  }
  const asJson = parsed.flags.json === true;
  try {
    const raw = await readDraftJson(path.resolve(parsed.positional[0]));
    const result = await addPackageEntity(path.resolve(String(parsed.flags.root)), raw);
    if (asJson) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (result.status === 'created') {
      process.stdout.write(`Created Package ${result.id}: ${result.path}${result.active ? ' (active)' : ' (inactive)'}\n`);
    } else if (result.status === 'invalid') {
      for (const issue of result.issues) process.stdout.write(`${issue.severity}: ${issue.code}: ${issue.message}\n`);
    } else process.stdout.write(`${result.code}: ${result.message}\n`);
    return result.status === 'created' ? 0 : 1;
  } catch (error) {
    emitFailure(failureFromError(error), asJson);
    return 2;
  }
}

function usage(): string {
  return formatUsage('snl-add-package', '[options] <package-draft.json>', SPECS);
}

main().then((code) => process.exit(code));
