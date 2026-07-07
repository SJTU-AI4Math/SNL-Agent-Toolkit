/**
 * Lint one EntryData JSON payload — the SNL-Doc "entry" record shape from
 * `.SNL_Doc/entries.json`.
 *
 * Layered validation:
 *
 *   L1 — SCHEMA
 *        - id: non-empty string, unique across the shared pool
 *        - kind: non-empty string, resolves to an existing EntryKind
 *        - title: string (may be empty — cat 2026-07-06 allows blank titles)
 *        - content: object w/ optional snl/typst/latex/markdown/text strings
 *        - contribution_info / pointer: present (any value)
 *
 *   L2 — SNL SYNTAX
 *        - if content.snl is non-empty, it must parse via SNL-Basics's
 *          tryParseSnlSyntaxTree; parse errors surface with the char
 *          offset. Empty content.snl is fine (empty entries are allowed).
 *
 *   L3 — REFERENCE INTEGRITY
 *        - every `\name` reference in content.snl that resolves to a
 *          known macro is fine; unknown macros are warned (not errored —
 *          they render as fvar, which is a valid intermediate state
 *          during authoring) but reported so the agent can decide whether
 *          to register a new macro or fix a typo.
 *        - NOTE: cross-entry links via macro `source.entries` are
 *          validated by the graph linter, not here.
 *
 * All three layers push into a LintReport instead of throwing, so the
 * caller can decide how strict to be. Rule of thumb: `hasErrors()` on the
 * returned report means "do not commit"; warnings are agent hints.
 */

import type {
  EntryData,
  EntryKind,
  MacroPackageEntry,
} from '../schema/index.ts';
import type { LintIssue, LintReport } from './lint-report.ts';
import { tryParseSnlSyntaxTree } from './snl-parser.ts';

export interface LintEntryContext {
  /** entry_kinds from `.SNL_Doc/config.json`. Empty = every `kind` is unknown. */
  entryKinds: EntryKind[];
  /** Flat active-macro pool (name → entry). Empty = every macro reference warned. */
  macros: Record<string, MacroPackageEntry>;
  /**
   * The other entries in the pool this new entry is being added to. Used
   * for id-uniqueness checks. Pass `[]` when linting standalone.
   */
  siblingEntries: EntryData[];
  /**
   * When true, unknown macro references become errors instead of warnings.
   * Off by default — agents typically want to write, lint, register-any-new
   * -macros, and re-lint iteratively.
   */
  strictMacros?: boolean;
}

/**
 * Lint a single already-JSON-parsed entry. Returns a LintReport with the
 * `file` slot left unset (the caller — usually the CLI — fills it in).
 */
export function lintEntry(
  raw: unknown,
  ctx: LintEntryContext,
): LintReport {
  const issues: LintIssue[] = [];

  // L1 — SCHEMA (structural)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push({
      severity: 'error',
      code: 'entry.not-object',
      message: `Entry payload must be a JSON object, got ${describe(raw)}.`,
    });
    return { issues };
  }
  const e = raw as Partial<EntryData>;

  // id
  if (typeof e.id !== 'string' || e.id.trim() === '') {
    issues.push({
      severity: 'error',
      code: 'entry.missing-id',
      message: 'Field `id` must be a non-empty string.',
      path: 'id',
    });
  } else if (ctx.siblingEntries.some((s) => s.id === e.id)) {
    issues.push({
      severity: 'error',
      code: 'entry.duplicate-id',
      message: `Entry id '${e.id}' already exists in the shared pool.`,
      path: 'id',
    });
  }

  // kind
  if (typeof e.kind !== 'string' || e.kind.trim() === '') {
    issues.push({
      severity: 'error',
      code: 'entry.missing-kind',
      message: 'Field `kind` must be a non-empty string.',
      path: 'kind',
    });
  } else if (!ctx.entryKinds.some((k) => k.id === e.kind)) {
    const known = ctx.entryKinds.map((k) => k.id).join(', ') || '(none defined)';
    issues.push({
      severity: 'error',
      code: 'entry.unknown-kind',
      message: `kind '${e.kind}' is not in config.entry_kinds. Known: ${known}.`,
      path: 'kind',
    });
  }

  // title (may be empty string per 2026-07-06 spec, but must be present)
  if (typeof e.title !== 'string') {
    issues.push({
      severity: 'error',
      code: 'entry.missing-title',
      message: 'Field `title` must be a string (may be empty).',
      path: 'title',
    });
  }

  // content
  if (typeof e.content !== 'object' || e.content === null || Array.isArray(e.content)) {
    issues.push({
      severity: 'error',
      code: 'entry.missing-content',
      message: 'Field `content` must be an object (may be empty).',
      path: 'content',
    });
  } else {
    for (const dialect of ['snl', 'typst', 'latex', 'markdown', 'text'] as const) {
      const val = (e.content as Record<string, unknown>)[dialect];
      if (val !== undefined && typeof val !== 'string') {
        issues.push({
          severity: 'error',
          code: 'entry.bad-content-dialect',
          message: `content.${dialect} must be a string when present, got ${describe(val)}.`,
          path: `content.${dialect}`,
        });
      }
    }
  }

  // contribution_info / pointer — must be present (any value). Missing =
  // schema violation; extension code always writes both keys.
  if (!('contribution_info' in e)) {
    issues.push({
      severity: 'error',
      code: 'entry.missing-contribution-info',
      message: 'Field `contribution_info` is required (may be null).',
      path: 'contribution_info',
    });
  }
  if (!('pointer' in e)) {
    issues.push({
      severity: 'error',
      code: 'entry.missing-pointer',
      message: 'Field `pointer` is required (may be null).',
      path: 'pointer',
    });
  }

  // L2 — SNL SYNTAX
  const snl =
    typeof e.content === 'object' &&
    e.content !== null &&
    typeof (e.content as { snl?: unknown }).snl === 'string'
      ? ((e.content as { snl: string }).snl)
      : '';
  if (snl.trim().length > 0) {
    const parsed = tryParseSnlSyntaxTree(snl);
    if (!parsed.ok) {
      issues.push({
        severity: 'error',
        code: 'snl.parse',
        message: parsed.error,
        path: 'content.snl',
        position: parsed.position,
      });
    } else {
      // L3 — REFERENCE INTEGRITY
      const unknownMacros = findUnknownMacros(snl, ctx.macros);
      for (const name of unknownMacros) {
        issues.push({
          severity: ctx.strictMacros ? 'error' : 'warning',
          code: 'snl.unknown-macro',
          message:
            `Macro '${name}' is not in the active macro pool. ` +
            `Either register it in .SNL_Doc/term_macros/ or fix the reference.`,
          path: 'content.snl',
        });
      }
    }
  }

  return { issues };
}

/**
 * Cheap macro-name extractor. Walks the raw SNL source for identifier
 * tokens matching `[A-Za-z_][A-Za-z0-9_.-]*` — SNL macros are referenced
 * as bare identifiers, e.g. `Ric` or `DivRing.div.frac`, not
 * `\backslash-prefixed`. This overshoots (grabs style tags in `foo[bar]`,
 * variable names inside binder scopes, etc.) — false positives here just
 * mean an extra "unknown macro" warning, which the agent can ignore.
 * Precise reference extraction is a future improvement (walk the syntax
 * tree instead).
 *
 * Returns a deduped list of names that are NOT in the macro pool.
 */
function findUnknownMacros(
  snl: string,
  pool: Record<string, MacroPackageEntry>,
): string[] {
  // Match bare identifiers (may contain `.` and `-` per SNL parser).
  // Skip the very-common trivial cases and `%…%` / `$…$` / `$$…$$`
  // delimited names (those are literal text/latex, not macro refs).
  const stripped = snl
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[\s\S]*?\$/g, ' ')
    .replace(/%[\s\S]*?%/g, ' ');
  const re = /([A-Za-z_][A-Za-z0-9_.\-]*)/g;
  const seen = new Set<string>();
  const unknown = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    if (!(name in pool)) unknown.add(name);
  }
  return [...unknown].sort();
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
