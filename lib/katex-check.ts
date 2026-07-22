/**
 * KaTeX compile check — headless KaTeX render used by the linters to
 * verify that a given piece of LaTeX source actually compiles under
 * the same KaTeX engine the SNL renderer uses at runtime.
 *
 * Design (per cat 2026-07-13):
 *   - Parser / renderer NEVER auto-escape or auto-fix. If the source
 *     doesn't compile, it doesn't compile. The linter's job is to
 *     surface WHERE it doesn't compile so the author can fix it.
 *   - This module is a thin, pure wrapper around
 *     `katex.renderToString(..., { throwOnError: true })`. Everything
 *     domain-specific (which template slots to check, how to expand
 *     `#N` placeholders, how to walk an SNL tree extracting KaTeX
 *     islands) lives in `lint-package.ts` / `lint-entry.ts`.
 *
 * KaTeX error messages carry an "at position N" tail. We strip / parse
 * it into a structured `position` so downstream reports can format
 * uniformly.
 */

import katex from 'katex';

export interface KatexCheckOptions {
  /** Render as `$$…$$` (true) vs `$…$` (false). Default false. */
  displayMode?: boolean;
  /**
   * KaTeX macro table — pre-defined `\command` shortcuts. Empty by
   * default. SNL runtime doesn't inject any global KaTeX macros, so we
   * match that at check time.
   */
  macros?: Record<string, string>;
}

export interface KatexCheckOk {
  ok: true;
}

export interface KatexCheckErr {
  ok: false;
  /** Human-readable KaTeX error message, with the "at position N" tail stripped. */
  message: string;
  /** Character offset into the input where KaTeX gave up, when parseable. */
  position?: number;
  /** The raw, un-massaged KaTeX error for callers that want it verbatim. */
  raw: string;
}

export type KatexCheckResult = KatexCheckOk | KatexCheckErr;

/**
 * Compile `source` under KaTeX. Returns a structured result — never
 * throws (a throw here would be a KaTeX-internal bug, not authoring
 * error).
 */
export function checkKatex(
  source: string,
  opts: KatexCheckOptions = {},
): KatexCheckResult {
  try {
    katex.renderToString(source, {
      throwOnError: true,
      displayMode: opts.displayMode === true,
      macros: opts.macros,
      // Strict rejects a few permissive-but-questionable inputs (Unicode
      // in math, deprecated commands, etc.). We keep it OFF: the
      // extension's runtime KaTeX runs in default (non-strict) mode, so
      // strict mode would raise false positives the author can't
      // reproduce in-app.
      strict: 'ignore',
    });
    return { ok: true };
  } catch (err) {
    const raw = (err as Error).message ?? String(err);
    const { message, position } = parseKatexError(raw);
    return { ok: false, message, position, raw };
  }
}

/**
 * KaTeX errors look like:
 *
 *   "KaTeX parse error: Expected 'EOF', got '_' at position 12: \\texttt{foo_̲bar}"
 *
 * We split off the "at position N" tail (character offset into the input
 * source, 0-indexed by KaTeX). The trailing ": <snippet>" is dropped
 * because it duplicates the source we already have in context.
 */
function parseKatexError(raw: string): { message: string; position?: number } {
  // Trim the "KaTeX parse error: " prefix if present.
  let msg = raw.replace(/^KaTeX parse error:\s*/, '');
  let position: number | undefined;
  const posMatch = msg.match(/ at position (\d+):\s.*$/);
  if (posMatch) {
    position = Number.parseInt(posMatch[1], 10);
    msg = msg.slice(0, posMatch.index);
  }
  return { message: msg, position };
}

/**
 * Fill `#0`..`#N` and `#*` placeholders in a KaTeX template with a
 * neutral, ALWAYS-compilable placeholder token so the template itself
 * can be checked without a specific argument list.
 *
 * We use the literal identifier `x` — it's a valid math atom AND a
 * valid text run, works inside `\texttt{...}` / `\textcolor{...}` /
 * `\sqrt{...}` / subscripts / superscripts. We deliberately avoid
 * `\square` (amssymb-only, KaTeX doesn't ship it in default macros)
 * and other TeX symbols that would themselves fail to compile.
 * `#*` is filled with three placeholders joined by the v7 `separator`
 * so dynamic-template shapes are exercised realistically.
 *
 * Used by both the macro-package linter (template-only preview) and by
 * the entry linter when it needs to synthesize a KaTeX source from a
 * template without a real syntax-tree binding.
 */
export function fillTemplateWithPlaceholders(
  template: string,
  dynamic: { separator?: string } = {},
): string {
  const PH = 'x';
  const separator = dynamic.separator ?? ', ';
  const variadicBody = [PH, PH, PH].join(separator);

  const out: string[] = [];
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    // Preserve `\#` as literal `#`.
    if (ch === '\\' && template[i + 1] === '#') {
      out.push('\\#');
      i += 2;
      continue;
    }
    if (ch === '#') {
      if (template[i + 1] === '*') {
        out.push(variadicBody);
        i += 2;
        continue;
      }
      const digitsMatch = template.slice(i + 1).match(/^\d+/);
      if (digitsMatch) {
        out.push(PH);
        i += 1 + digitsMatch[0].length;
        continue;
      }
      out.push(ch);
      i += 1;
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.join('');
}

/**
 * Heuristic: does this template use KaTeX at all?
 *
 * SNL macros with `mode: 'text'` and a plain-string template (no
 * `\command`) render as raw text without going through KaTeX. Checking
 * those under KaTeX would produce noise. But a `text`-mode template
 * that contains `\texttt{...}` or `\textcolor{...}` etc. IS routed
 * through KaTeX by the react view (the text macro's output is inline
 * math for the LaTeX bits). We conservatively route through KaTeX
 * whenever the template contains a `\` followed by a letter.
 *
 * `formula_inline` / `formula_display` modes always go through KaTeX
 * regardless of template contents.
 */
export function templateNeedsKatex(mode: string, template: string): boolean {
  if (mode === 'formula_inline' || mode === 'formula_display') return true;
  // Any TeX control sequence → probably KaTeX-rendered.
  return /\\[A-Za-z]/.test(template);
}
