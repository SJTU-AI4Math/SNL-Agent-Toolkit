/**
 * snl-lint-graph — lint one or more `graph.json` payloads (Library Graph v2)
 * against a workspace's shared entry pool.
 *
 * Two invocation modes:
 *
 *   1. Explicit file mode: `snl-lint-graph path/to/graph.json ...`
 *      Lints each named file. Useful for draft graphs living outside
 *      `.SNL_Doc/libraries/`.
 *
 *   2. Slug mode: `snl-lint-graph --slug my-lib` (multiple --slug allowed).
 *      Resolves `.SNL_Doc/libraries/<slug>/graph.json` and lints those.
 *      Pass no positional / slug at all to lint every library on disk.
 *
 * Exit codes match snl-lint-entry: 0 clean/warnings/info, 1 lint error,
 * 2 CLI-level failure.
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
  libraryGraphPath,
  listLibrarySlugs,
  pathExists,
  readEntries,
} from '../../lib/snl-doc.ts';
import { lintGraph } from '../../lib/lint-graph.ts';
import {
  formatReport,
  hasErrors,
  issueCount,
  type LintReport,
} from '../../lib/lint-report.ts';

const SLUG_FLAG: FlagSpec = {
  name: 'slug',
  hasValue: true,
  help:
    'Library slug (relative to .SNL_Doc/libraries/). May be repeated. ' +
    'When neither --slug nor a positional file is given, every library ' +
    'on disk is linted.',
};

const SPECS: FlagSpec[] = [ROOT_FLAG, SLUG_FLAG, JSON_FLAG, HELP_FLAG];

async function main(): Promise<number> {
  // parseArgs doesn't support repeated flags in the base helper; do a
  // simple pre-pass to collect every `--slug X` occurrence and strip them
  // from argv before handing off. Cheap and readable.
  const rawArgv = process.argv.slice(2);
  const slugs: string[] = [];
  const filtered: string[] = [];
  for (let i = 0; i < rawArgv.length; i++) {
    const tok = rawArgv[i];
    if (tok === '--slug' || tok === '-s') {
      const next = rawArgv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        process.stderr.write(`Flag ${tok} requires a value.\n`);
        return 2;
      }
      slugs.push(next);
      i++;
    } else if (tok.startsWith('--slug=')) {
      slugs.push(tok.slice('--slug='.length));
    } else {
      filtered.push(tok);
    }
  }

  let parsed;
  try {
    parsed = parseArgs(filtered, SPECS.filter((s) => s.name !== 'slug'));
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

  // Resolve the file list.
  const targets: string[] = [...parsed.positional.map((p) => path.resolve(p))];
  for (const slug of slugs) {
    targets.push(libraryGraphPath(root, slug));
  }
  if (targets.length === 0) {
    // No explicit target → lint every library.
    const allSlugs = await listLibrarySlugs(root);
    for (const slug of allSlugs) {
      const p = libraryGraphPath(root, slug);
      if (await pathExists(p)) targets.push(p);
    }
    if (targets.length === 0) {
      process.stderr.write(
        `No graph.json files found under ${path.join(root, '.SNL_Doc/libraries')}.\n`,
      );
      return 2;
    }
  }

  const poolEntries = await readEntries(root);

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
    const report = lintGraph(raw, { poolEntries });
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
    'snl-lint-graph',
    '[options] [graph.json ...]',
    [ROOT_FLAG, SLUG_FLAG, JSON_FLAG, HELP_FLAG],
  );
}

main().then((code) => process.exit(code));
