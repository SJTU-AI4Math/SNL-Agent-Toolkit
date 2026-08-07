import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  formatUsage,
  HELP_FLAG,
  JSON_FLAG,
  parseArgs,
  ROOT_FLAG,
  type FlagSpec,
} from '../../lib/cli-args.ts';
import { addEntryEntity } from '../../lib/entity-writes.ts';
import { emitFailure, failure, failureFromError, wantsJson } from './add-cli-common.ts';

const PACKAGE_FLAG: FlagSpec = {
  name: 'package', short: 'p', hasValue: true,
  help: 'Target Package ID. Defaults to draft.package, then _unpackaged.',
};
const STRICT_MACROS_FLAG: FlagSpec = {
  name: 'strict-macros', hasValue: false, default: false,
  help: 'Reject unresolved identifiers instead of allowing fvar/bvar fallback.',
};
const SPECS = [ROOT_FLAG, PACKAGE_FLAG, STRICT_MACROS_FLAG, JSON_FLAG, HELP_FLAG];

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
  } catch (error) {
    emitFailure(failure('usage', (error as Error).message), wantsJson(process.argv.slice(2)), usage());
    return 2;
  }
  if (parsed.flags.help === true) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (parsed.positional.length !== 1) {
    emitFailure(
      failure('usage', 'snl-add-entry requires exactly one draft JSON file.'),
      parsed.flags.json === true,
      usage(),
    );
    return 2;
  }
  const root = path.resolve(String(parsed.flags.root));
  const asJson = parsed.flags.json === true;
  try {
    const draftPath = path.resolve(parsed.positional[0]);
    const raw: unknown = JSON.parse(await fs.readFile(draftPath, 'utf8'));
    const result = await addEntryEntity(root, raw, {
      package: typeof parsed.flags.package === 'string' ? parsed.flags.package : undefined,
      strictMacros: parsed.flags['strict-macros'] === true,
    });
    printResult(result, asJson);
    return result.status === 'created' ? 0 : 1;
  } catch (error) {
    emitFailure(failureFromError(error), asJson);
    return 2;
  }
}

function printResult(result: Awaited<ReturnType<typeof addEntryEntity>>, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.status === 'created') {
    process.stdout.write(`Created Entry ${result.id} in ${result.package}: ${result.path}\n`);
    for (const issue of result.issues) process.stdout.write(`${issue.severity}: ${issue.code}: ${issue.message}\n`);
  } else if (result.status === 'invalid') {
    for (const issue of result.issues) process.stdout.write(`${issue.severity}: ${issue.code}: ${issue.message}\n`);
  } else {
    process.stdout.write(`${result.code}: ${result.message}\n`);
  }
}

function usage(): string {
  return formatUsage('snl-add-entry', '[options] <entry-draft.json>', SPECS);
}

main().then((code) => process.exit(code));
