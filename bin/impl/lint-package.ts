/**
 * snl-lint-package — lint one or more macro-package JSON payloads.
 *
 * Two invocation modes:
 *
 *   1. Explicit file mode: `snl-lint-package path/to/pkg.json ...`
 *   2. Named mode: `snl-lint-package --name my-pkg` (may repeat).
 *      Resolves one Package ID from live Package/Macro entities.
 *
 * With no positional and no --name, every live Package is linted.
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
  readAllMacroPackages,
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
    'Package ID. ' +
    'May be repeated. When neither --name nor a positional file is given, ' +
    'every package on disk is linted.',
};

const NO_KATEX_FLAG: FlagSpec = {
  name: 'no-katex',
  hasValue: false,
  default: false,
  help:
    'Skip the KaTeX compile preview (default: enabled). Each macro ' +
    'style whose template will be routed through KaTeX at render time ' +
    'is otherwise fed through headless KaTeX with `#N` / `#*` slots ' +
    'filled by a neutral `x` placeholder. Turn this off in ' +
    'environments where KaTeX is unavailable or preview noise is not ' +
    'wanted; leave on for authoring feedback.',
};

const SPECS: FlagSpec[] = [ROOT_FLAG, NAME_FLAG, NO_KATEX_FLAG, JSON_FLAG, HELP_FLAG];

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
  const checkKatexEnabled = parsed.flags['no-katex'] !== true;

  try {
    await assertSnlDoc(root);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const reports: LintReport[] = [];
  const targets: Array<{ file: string; raw?: unknown }> = parsed.positional.map((p) => ({
    file: path.resolve(p),
  }));
  if (names.length > 0 || targets.length === 0) {
    let packages: Awaited<ReturnType<typeof readAllMacroPackages>>;
    try {
      packages = await readAllMacroPackages(root);
    } catch (error) {
      const failure: LintReport = {
        file: path.join(root, '.SNL_Doc'),
        issues: [{ severity: 'error', code: 'file.read', message: (error as Error).message }],
      };
      if (asJson) process.stdout.write(JSON.stringify([failure], null, 2) + '\n');
      else process.stdout.write(formatReport([failure]) + '\n');
      return 1;
    }
    const selected = names.length > 0
      ? names.map((name) => name.replace(/\.json$/i, ''))
      : Object.keys(packages).sort();
    if (selected.length === 0) {
      process.stderr.write(`No Packages found in ${path.join(root, '.SNL_Doc')}.\n`);
      return 2;
    }
    for (const name of selected) {
      if (!Object.prototype.hasOwnProperty.call(packages, name)) {
        reports.push({
          file: `package:${name}`,
          issues: [{ severity: 'error', code: 'file.read', message: `Package ${JSON.stringify(name)} was not found.` }],
        });
      } else {
        targets.push({ file: `package:${name}`, raw: packages[name] });
      }
    }
  }

  for (const target of targets) {
    let raw: unknown;
    if (target.raw !== undefined) {
      raw = target.raw;
    } else {
      try {
        const text = await fs.readFile(target.file, 'utf8');
        raw = JSON.parse(text);
      } catch (err) {
        reports.push({
          file: target.file,
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
    }
    const report = lintPackage(raw, { checkKatex: checkKatexEnabled });
    report.file = target.file;
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
    [ROOT_FLAG, NAME_FLAG, NO_KATEX_FLAG, JSON_FLAG, HELP_FLAG],
  );
}

main().then((code) => process.exit(code));
