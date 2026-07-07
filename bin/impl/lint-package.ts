/**
 * snl-lint-package — lint one or more macro-package JSON payloads.
 *
 * Two invocation modes:
 *
 *   1. Explicit file mode: `snl-lint-package path/to/pkg.json ...`
 *   2. Named mode: `snl-lint-package --name my-pkg` (may repeat).
 *      Resolves `.SNL_Doc/term_macros/<name>.json`.
 *
 * With no positional and no --name, every package under
 * `.SNL_Doc/term_macros/` is linted.
 *
 * The lint is FILE-LOCAL — cross-package name-collision checking will be
 * a separate CLI (or fold into snl-commit-batch) since it needs the full
 * active-package view.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  parseArgs,
  formatUsage,
  ROOT_FLAG,
  JSON_FLAG,
  HELP_FLAG,
  type FlagSpec,
} from '../../lib/cli-args.ts';
import {
  assertSnlDoc,
  pathExists,
  termMacrosDir,
} from '../../lib/snl-doc.ts';
import { lintPackage } from '../../lib/lint-package.ts';
import {
  formatReport,
  hasErrors,
  issueCount,
  type LintReport,
} from '../../lib/lint-report.ts';

const NAME_FLAG: FlagSpec = {
  name: 'name',
  hasValue: true,
  help:
    'Package bare filename (no .json), relative to .SNL_Doc/term_macros/. ' +
    'May be repeated. When neither --name nor a positional file is given, ' +
    'every package on disk is linted.',
};

const SPECS: FlagSpec[] = [ROOT_FLAG, NAME_FLAG, JSON_FLAG, HELP_FLAG];

async function main(): Promise<number> {
  // Pre-pass to collect repeated --name flags; parseArgs is single-value.
  const rawArgv = process.argv.slice(2);
  const names: string[] = [];
  const filtered: string[] = [];
  for (let i = 0; i < rawArgv.length; i++) {
    const tok = rawArgv[i];
    if (tok === '--name' || tok === '-n') {
      const next = rawArgv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        process.stderr.write(`Flag ${tok} requires a value.\n`);
        return 2;
      }
      names.push(next);
      i++;
    } else if (tok.startsWith('--name=')) {
      names.push(tok.slice('--name='.length));
    } else {
      filtered.push(tok);
    }
  }

  let parsed;
  try {
    parsed = parseArgs(filtered, SPECS.filter((s) => s.name !== 'name'));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n`);
    process.stderr.write(usage() + '\n');
    return 2;
  }

  if (parsed.flags.help === true) {
    process.stdout.write(usage() + '\n');
    return 0;
  }

  const root = path.resolve(String(parsed.flags.root));
  const asJson = parsed.flags.json === true;

  try {
    await assertSnlDoc(root);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const targets: string[] = [...parsed.positional.map((p) => path.resolve(p))];
  for (const name of names) {
    const bare = name.replace(/\.json$/i, '');
    targets.push(path.join(termMacrosDir(root), `${bare}.json`));
  }
  if (targets.length === 0) {
    const dir = termMacrosDir(root);
    if (await pathExists(dir)) {
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (f.endsWith('.json')) targets.push(path.join(dir, f));
      }
    }
    if (targets.length === 0) {
      process.stderr.write(
        `No package files found under ${termMacrosDir(root)}.\n`,
      );
      return 2;
    }
  }

  const reports: LintReport[] = [];
  for (const abs of targets) {
    let raw: unknown;
    try {
      const text = await fs.readFile(abs, 'utf8');
      raw = JSON.parse(text);
    } catch (err) {
      reports.push({
        file: abs,
        issues: [
          {
            severity: 'error',
            code: 'file.read',
            message: (err as Error).message,
          },
        ],
      });
      continue;
    }
    const report = lintPackage(raw);
    report.file = abs;
    reports.push(report);
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(reports, null, 2) + '\n');
  } else {
    process.stdout.write(formatReport(reports) + '\n');
    const c = issueCount(reports);
    process.stdout.write(
      `Linted ${reports.length} file${reports.length === 1 ? '' : 's'}: ` +
        `${c.errors} error${c.errors === 1 ? '' : 's'}, ` +
        `${c.warnings} warning${c.warnings === 1 ? '' : 's'}, ` +
        `${c.infos} info.\n`,
    );
  }

  return reports.some(hasErrors) ? 1 : 0;
}

function usage(): string {
  return formatUsage(
    'snl-lint-package',
    '[options] [pkg.json ...]',
    [ROOT_FLAG, NAME_FLAG, JSON_FLAG, HELP_FLAG],
  );
}

main().then((code) => process.exit(code));
