/**
 * Structured lint report shape shared by every linter. Machine-friendly
 * (JSON-serializable) and human-friendly (formatReport() renders it).
 */

export type Severity = 'error' | 'warning' | 'info';

export interface LintIssue {
  severity: Severity;
  /** Short machine code, e.g. 'entry.missing-id' or 'snl.parse'. */
  code: string;
  /** Human message; may reference `path` for context. */
  message: string;
  /** Dot-path into the JSON payload, e.g. 'content.snl' or 'kind'. */
  path?: string;
  /** Character offset when applicable (SNL parse errors carry this). */
  position?: number;
}

export interface LintReport {
  /** File that was linted; useful for `snl-lint-entry a.json b.json`. */
  file?: string;
  issues: LintIssue[];
}

export function hasErrors(report: LintReport): boolean {
  return report.issues.some((i) => i.severity === 'error');
}

export function issueCount(reports: LintReport[]): {
  errors: number;
  warnings: number;
  infos: number;
} {
  const c = { errors: 0, warnings: 0, infos: 0 };
  for (const r of reports) {
    for (const i of r.issues) {
      if (i.severity === 'error') c.errors++;
      else if (i.severity === 'warning') c.warnings++;
      else c.infos++;
    }
  }
  return c;
}

/**
 * Human-readable multi-line render. Groups by file, colors severity when
 * stdout is a TTY.
 */
export function formatReport(reports: LintReport[]): string {
  const useColor = process.stdout.isTTY;
  const c = (color: string, text: string): string =>
    useColor ? `\u001b[${color}m${text}\u001b[0m` : text;
  const sevBadge: Record<Severity, string> = {
    error: c('31', 'ERROR  '),
    warning: c('33', 'WARN   '),
    info: c('36', 'INFO   '),
  };

  const lines: string[] = [];
  for (const r of reports) {
    if (r.file) lines.push(c('1', r.file));
    if (r.issues.length === 0) {
      lines.push('  (no issues)');
      continue;
    }
    for (const i of r.issues) {
      const loc = i.path ? c('2', ` [${i.path}]`) : '';
      const pos = i.position !== undefined ? c('2', ` (at ${i.position})`) : '';
      lines.push(`  ${sevBadge[i.severity]} ${c('2', i.code)}${loc}${pos}`);
      lines.push(`         ${i.message}`);
    }
  }
  const tot = issueCount(reports);
  lines.push('');
  lines.push(
    `${tot.errors} error${tot.errors === 1 ? '' : 's'}, ` +
      `${tot.warnings} warning${tot.warnings === 1 ? '' : 's'}, ` +
      `${tot.infos} info`,
  );
  return lines.join('\n');
}
