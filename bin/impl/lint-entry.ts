/**
 * snl-lint-entry — lint one or more EntryData JSON payloads against a
 * workspace's `.SNL_Doc/` context.
 *
 * The workflow this CLI is designed for:
 *
 *   1. Agent generates a draft EntryData as JSON to some scratch dir.
 *   2. Agent runs `snl-lint-entry <file>...` to get structured feedback.
 *   3. If errors → agent fixes them (schema or SNL parse) and retries.
 *   4. If only warnings → agent decides whether to register new macros
 *      or fix references, then either fixes or explicitly accepts.
 *   5. On clean lint → the commit CLI (future) merges into
 *      `.SNL_Doc/entries.json`.
 *
 * The lint context (entry_kinds, macro pool, sibling entries) is loaded
 * from `<--root>/.SNL_Doc/`. Pass `--root <workspace>` when the CLI's cwd
 * differs from the project root; default is `.`.
 *
 * Output:
 *   - Human mode (default): coloured multi-file report to stdout.
 *   - `--json`: array of LintReport objects to stdout, no colour.
 *
 * Exit codes:
 *   0 — every file linted clean OR only warnings
 *   1 — at least one file has a lint error
 *   2 — CLI-level failure (bad flags, missing .SNL_Doc/, unreadable JSON)
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
  readActiveMacros,
  readEntries,
  readEntryKinds,
} from '../../lib/snl-doc.ts';
import { lintEntry } from '../../lib/lint-entry.ts';
import {
  formatReport,
  hasErrors,
  issueCount,
  type LintReport,
} from '../../lib/lint-report.ts';

const STRICT_FLAG: FlagSpec = {
  name: 'strict-macros',
  hasValue: false,
  default: false,
  help: 'Treat unknown-macro references as errors instead of warnings.',
};

const SPECS: FlagSpec[] = [ROOT_FLAG, JSON_FLAG, STRICT_FLAG, HELP_FLAG];

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n`);
    process.stderr.write(usage() + '\n');
    return 2;
  }

  if (parsed.flags.help === true) {
    process.stdout.write(usage() + '\n');
    return 0;
  }
  if (parsed.positional.length === 0) {
    process.stderr.write('No entry files provided.\n\n');
    process.stderr.write(usage() + '\n');
    return 2;
  }

  const root = path.resolve(String(parsed.flags.root));
  const asJson = parsed.flags.json === true;
  const strictMacros = parsed.flags['strict-macros'] === true;

  try {
    await assertSnlDoc(root);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const [entryKinds, macros, siblingEntries] = await Promise.all([
    readEntryKinds(root),
    readActiveMacros(root),
    readEntries(root),
  ]);

  const reports: LintReport[] = [];
  for (const rel of parsed.positional) {
    const abs = path.resolve(rel);
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

    const report = lintEntry(raw, {
      entryKinds,
      macros,
      siblingEntries,
      strictMacros,
    });
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
        `${c.warnings} warning${c.warnings === 1 ? '' : 's'}.\n`,
    );
  }

  return reports.some(hasErrors) ? 1 : 0;
}

function usage(): string {
  return formatUsage(
    'snl-lint-entry',
    '[options] <entry.json> [entry.json ...]',
    SPECS,
  );
}

main().then((code) => process.exit(code));
