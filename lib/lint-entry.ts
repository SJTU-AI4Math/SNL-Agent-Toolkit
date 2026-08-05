/**
 * Lint one EntryData JSON payload — the SNL-Doc "entry" record shape from
 * live `.SNL_Doc/entries/*.json` entities.
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
 *   L3 — IDENTIFIER RESOLUTION (informational by default)
 *        - Every bare identifier in content.snl that isn't a registered
 *          macro is reported as an INFO note — NOT a warning, because SNL
 *          intentionally supports fvar/bvar fallback for unbound
 *          identifiers (cat 2026-07-07: "在没有找到宏的情况下也有默认
 *          行为的，这个功能还比较常用"). The agent decides whether the
 *          fallback is intentional (e.g. bound variable in a binder
 *          scope, or a locally-scoped free variable) or a typo / missing
 *          registration.
 *        - Identifiers that immediately follow `@` are exempt: those are
 *          either binder-introduced names (`@foo(x)`) or `x@srcEntry`
 *          src-postfix targets (checked by L4 as entry ids, not macros).
 *          Cat 2026-07-10 §bvar-source-syntax.
 *        - Under `strictMacros: true`, these get promoted to ERRORS —
 *          use when the caller wants to enforce "every identifier is a
 *          registered macro" (rare; typically off).
 *
 * All layers push into a LintReport instead of throwing. `hasErrors()`
 * checks only `severity === 'error'`, so info notes don't fail the run.
 */

import type {
  EntryData,
  EntryKind,
  MacroPackageEntry,
} from './snl-doc-schema.ts';
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
   * When true, unresolved identifiers become errors instead of info
   * notes. Off by default: SNL's fvar/bvar fallback for unbound names is
   * intentional, so the linter reports them but doesn't fail the run.
   * Set true only when the caller wants to enforce "every identifier
   * must be a registered macro" (rare).
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
      // L3 — IDENTIFIER RESOLUTION
      const unresolved = findUnresolvedIdentifiers(snl, ctx.macros);
      for (const name of unresolved) {
        issues.push({
          severity: ctx.strictMacros ? 'error' : 'info',
          code: 'snl.identifier-not-in-pool',
          message:
            `Identifier '${name}' is not a registered macro; ` +
            `will render as fvar/bvar fallback. ` +
            `May be intentional (bound variable, local free variable) or ` +
            `may indicate a typo / missing macro registration — agent decides.`,
          path: 'content.snl',
        });
      }
      // L4 — CROSS-ENTRY `src` REFERENCES (cat 2026-07-09).
      //
      // Walk the parsed tree for nodes whose mdata.src is set (via the
      // `x@foo` postfix syntax) and check each against the entry pool.
      // Semantics per spec §fork-C: unresolved src is TOLERATED — we
      // never fail the run — but we surface it so the agent can decide
      // whether the ref is intentional or a typo / broken link.
      //
      // The pool we check against is the union of `siblingEntries`
      // (other entries already committed) plus the entry being linted
      // itself (self-refs are legal — a context entry may reference
      // its own decls if that ever makes sense). If `siblingEntries`
      // is empty (standalone lint), we cannot check anything and just
      // report the src refs as info without a dangling verdict.
      const knownIds = new Set<string>();
      for (const sibling of ctx.siblingEntries) {
        if (typeof sibling.id === 'string') {
          knownIds.add(sibling.id);
        }
      }
      if (typeof e.id === 'string') {
        knownIds.add(e.id);
      }
      const srcRefs = collectSrcReferences(parsed.tree);
      for (const src of srcRefs) {
        if (!knownIds.has(src)) {
          issues.push({
            severity: 'info',
            code: 'snl.src-dangling',
            message:
              `Cross-entry src-postfix reference \`x@${src}\` does not resolve ` +
              `to any entry in the shared pool. Tolerated (renders with a ` +
              `warning badge), but likely a typo — entry ids are stable once ` +
              `created and should point at a real source entry that owns the ` +
              `bound variable. See docs/context-entry-design.md.`,
            path: 'content.snl',
          });
        }
      }
    }
  }

  return { issues };
}

/**
 * Recursively collect every `mdata.src` string from a parsed SNL tree.
 * Skip empty strings and non-string values defensively. Result is
 * deduped and sorted for stable reporting.
 */
function collectSrcReferences(node: unknown): string[] {
  const out = new Set<string>();
  visit(node);
  return [...out].sort();

  function visit(n: unknown): void {
    if (!n || typeof n !== 'object') return;
    const nn = n as { mdata?: unknown; children?: unknown };
    if (nn.mdata && typeof nn.mdata === 'object') {
      const src = (nn.mdata as { src?: unknown }).src;
      if (typeof src === 'string' && src.length > 0) {
        out.add(src);
      }
    }
    if (Array.isArray(nn.children)) {
      for (const c of nn.children) visit(c);
    }
  }
}

/**
 * Cheap identifier extractor. Walks the raw SNL source for identifier
 * tokens matching `[A-Za-z_][A-Za-z0-9_.-]*` — SNL macros are referenced
 * as bare identifiers, e.g. `Ric` or `DivRing.div.frac`, not
 * `\backslash-prefixed`. This overshoots (grabs style tags in `foo[bar]`,
 * variable names inside binder scopes, etc.) — false positives here are
 * fine because the whole layer is informational; the agent looks at each
 * reported identifier and decides whether it's intended fvar/bvar
 * fallback or a typo.
 *
 * Precise identifier-vs-macro extraction (walking the parsed tree
 * post-annotate-bind so we can tell bvar / fvar / unresolved-macro apart)
 * is a future refinement. Cat 2026-07-07 explicitly asked for these to be
 * reported so the agent can judge intent, so verbose > terse for now.
 *
 * Cat 2026-07-10 §bvar-source-syntax: skip identifiers that follow `@`
 * — those are EITHER binder introductions (`@foo(x)` — foo is a binder
 * macro name, but we'd flag it via the parser anyway) OR src-postfix
 * targets (`x@srcEntry` — srcEntry is an entry id, checked by the
 * separate `snl.src-dangling` layer, NOT a macro ref). Reporting them as
 * "unresolved macro" would be a false positive with zero recovery value.
 *
 * Returns a deduped list of identifiers not present in the macro pool.
 */
function findUnresolvedIdentifiers(
  snl: string,
  pool: Record<string, MacroPackageEntry>,
): string[] {
  // Skip `%…%` / `$…$` / `$$…$$` delimited names (those are literal text
  // or LaTeX, not macro refs — they become opaque leaf nodes).
  const stripped = snl
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[\s\S]*?\$/g, ' ')
    .replace(/%[\s\S]*?%/g, ' ');
  // Also drop the identifier immediately AFTER any `@` — that's a
  // binder-declared name or an entry-id src-postfix, neither of which
  // can be a macro reference.
  const withoutAtIdents = stripped.replace(
    /@[A-Za-z_][A-Za-z0-9_.\-]*/g,
    ' ',
  );
  const re = /([A-Za-z_][A-Za-z0-9_.\-]*)/g;
  const seen = new Set<string>();
  const unresolved = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutAtIdents)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    if (!(name in pool)) unresolved.add(name);
  }
  return [...unresolved].sort();
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
