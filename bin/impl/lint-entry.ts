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
import { tryParseSnlSyntaxTree } from '../../lib/snl-parser.ts';
import {
  renderTreeAsLatex,
  renderTreeAsText,
} from '../../lib/snl-render.ts';
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
  help:
    'Treat unresolved identifiers as errors instead of info notes. ' +
    'Off by default: SNL supports fvar/bvar fallback for unbound names, ' +
    'so unresolved identifiers are reported informationally so the agent ' +
    'can judge whether they are intentional variables or typos.',
};

// Cat 2026-07-10 §1: agent needs to see "what did I actually write"
// after emitting SNL — the raw tree tells you nothing about visual
// output. These two synth flags mirror the tree through a pure-LaTeX
// and a plain-text render so the model can spot notation mistakes.
const SHOW_LATEX_FLAG: FlagSpec = {
  name: 'show-latex',
  hasValue: false,
  default: false,
  help:
    'For every linted entry, also emit a pure-LaTeX synthesis of ' +
    'content.snl (no \\htmlData wrappers, no index annotations). ' +
    'Meant for agent-consumption preview: "what does my SNL compile to."',
};
const SHOW_TEXT_FLAG: FlagSpec = {
  name: 'show-text',
  hasValue: false,
  default: false,
  help:
    'For every linted entry, also emit a plain-text synthesis of ' +
    'content.snl (LaTeX commands mapped to Unicode chars where possible: ' +
    '\\cup → ∪, \\leq → ≤, etc.). Companion to --show-latex.',
};

const SPECS: FlagSpec[] = [
  ROOT_FLAG,
  JSON_FLAG,
  STRICT_FLAG,
  SHOW_LATEX_FLAG,
  SHOW_TEXT_FLAG,
  HELP_FLAG,
];

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

  const showLatex = parsed.flags['show-latex'] === true;
  const showText = parsed.flags['show-text'] === true;

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
  interface SynthPayload {
    file: string;
    latex?: { output: string; notes: string[] };
    text?: { output: string; notes: string[] };
  }
  const synths: SynthPayload[] = [];
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

    // Synth passes only when the entry has parseable SNL. We run them
    // even if L1/L2 flagged errors on unrelated fields — the agent
    // still benefits from seeing the render of what parsed.
    if (showLatex || showText) {
      const snl =
        raw && typeof raw === 'object' && 'content' in raw &&
        (raw as { content?: unknown }).content &&
        typeof (raw as { content: { snl?: unknown } }).content.snl === 'string'
          ? (raw as { content: { snl: string } }).content.snl
          : '';
      const payload: SynthPayload = { file: abs };
      if (snl.trim().length > 0) {
        const parsed2 = tryParseSnlSyntaxTree(snl);
        if (parsed2.ok) {
          if (showLatex) payload.latex = renderTreeAsLatex(parsed2.tree, macros);
          if (showText) payload.text = renderTreeAsText(parsed2.tree, macros);
        }
      }
      synths.push(payload);
    }
  }

  if (asJson) {
    const payload: { reports: LintReport[]; synths?: SynthPayload[] } = {
      reports,
    };
    if (showLatex || showText) payload.synths = synths;
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    process.stdout.write(formatReport(reports) + '\n');
    // Cat 2026-07-10 §1: emit the synth blocks after the main report so
    // the agent scanning stdout sees issues first, then the "what did
    // I write" preview.
    for (const s of synths) {
      if (!s.latex && !s.text) continue;
      process.stdout.write(`\n--- ${path.relative(root, s.file)} ---\n`);
      if (s.latex) {
        process.stdout.write('  [as LaTeX]\n');
        process.stdout.write('  ' + s.latex.output + '\n');
        for (const n of s.latex.notes) {
          process.stdout.write('    · ' + n + '\n');
        }
      }
      if (s.text) {
        process.stdout.write('  [as text]\n');
        process.stdout.write('  ' + s.text.output + '\n');
        for (const n of s.text.notes) {
          process.stdout.write('    · ' + n + '\n');
        }
      }
    }
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
    'snl-lint-entry',
    '[options] <entry.json> [entry.json ...]',
    SPECS,
  );
}

main().then((code) => process.exit(code));
