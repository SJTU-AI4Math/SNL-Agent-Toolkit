import * as path from 'node:path';
import {
  formatUsage, HELP_FLAG, JSON_FLAG, parseArgs, ROOT_FLAG, type FlagSpec,
} from '../../lib/cli-args.ts';
import { addMacroEntity } from '../../lib/entity-writes.ts';
import { emitFailure, emitHelp, failure, failureFromError, readDraftJson, wantsJson } from './add-cli-common.ts';

const PACKAGE_FLAG: FlagSpec = {
  name: 'package', short: 'p', hasValue: true,
  help: 'Existing target Package ID (required).',
};
const NO_KATEX_FLAG: FlagSpec = {
  name: 'no-katex', hasValue: false, default: false,
  help: 'Skip the KaTeX compile check. Leave off for normal authoring.',
};
const SPECS = [ROOT_FLAG, PACKAGE_FLAG, NO_KATEX_FLAG, JSON_FLAG, HELP_FLAG];

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
  if (parsed.positional.length !== 1 || typeof parsed.flags.package !== 'string') {
    emitFailure(
      failure('usage', 'snl-add-macro requires --package and exactly one draft JSON file.'),
      parsed.flags.json === true,
      usage(),
    );
    return 2;
  }
  const asJson = parsed.flags.json === true;
  try {
    const raw = await readDraftJson(path.resolve(parsed.positional[0]));
    const result = await addMacroEntity(
      path.resolve(String(parsed.flags.root)),
      parsed.flags.package,
      raw,
      { checkKatex: parsed.flags['no-katex'] !== true },
    );
    printResult(result, asJson);
    return result.status === 'created' ? 0 : 1;
  } catch (error) {
    emitFailure(failureFromError(error), asJson);
    return 2;
  }
}

function printResult(result: Awaited<ReturnType<typeof addMacroEntity>>, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.status === 'created') {
    process.stdout.write(`Created Macro ${result.name} in ${result.package}: ${result.path}\n`);
    for (const issue of result.issues) process.stdout.write(`${issue.severity}: ${issue.code}: ${issue.message}\n`);
  } else if (result.status === 'invalid') {
    for (const issue of result.issues) process.stdout.write(`${issue.severity}: ${issue.code}: ${issue.message}\n`);
  } else {
    process.stdout.write(`${result.code}: ${result.message}\n`);
  }
}

function usage(): string {
  return formatUsage('snl-add-macro', '--package <id> [options] <macro-draft.json>', SPECS);
}

main().then((code) => process.exit(code));
