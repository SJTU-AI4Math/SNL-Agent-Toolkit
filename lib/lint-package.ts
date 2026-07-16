/**
 * Lint one macro-package JSON payload — the on-disk shape of
 * `.SNL_Doc/term_macros/<pkg>.json`, a versioned bag of macro definitions.
 *
 * Layered validation:
 *
 *   L1 — SCHEMA (package + macro)
 *        - top-level: version / name / description? / macros: object
 *        - each macro must have description / source / dynamic_arity / styles[]
 *        - each style must have tag / mode / template
 *        - style.tag values are unique within one macro
 *
 *   L2 — TEMPLATE PLACEHOLDERS
 *        - `#N` placeholders in template must reference declared children.
 *          The macro's "arity" isn't stored explicitly, but the highest
 *          `#N` index across all styles is the natural fixed arity when
 *          dynamic_arity=false. `#*` is only legal on dynamic_arity macros;
 *          it MUST appear at least once in the default style's template
 *          when dynamic_arity=true. Any `#(anything else)` is an error.
 *
 *   L3 — CROSS-STYLE CONSISTENCY (info-level)
 *        - When multiple styles are present, we surface an info note if
 *          the highest `#N` index differs — a common way to accidentally
 *          declare a variadic-looking macro with mismatched styles.
 *
 * Cat 2026-07-07 asked us to keep the lints INFORMATIVE (report + let the
 * agent decide) where SNL's tolerance is real, so the L3 layer is info,
 * not warning.
 */

import type {
  MacroPackageEntryWithoutName,
  MacroPackageFile,
  MacroPackageStyle,
} from './snl-doc-schema.ts';
import type { LintIssue, LintReport } from './lint-report.ts';
import {
  checkKatex,
  fillTemplateWithPlaceholders,
  templateNeedsKatex,
} from './katex-check.ts';

export interface LintPackageOptions {
  /**
   * When true (default), every style whose template will be routed
   * through KaTeX at render time is fed through headless KaTeX with
   * `#N` / `#*` slots filled by neutral `\square` placeholders. KaTeX
   * compile failures become errors with code `style.katex-compile`.
   *
   * Off: skip KaTeX preview entirely (schema-only lint). CI can turn
   * this off with --no-katex when KaTeX isn't available, but the
   * default is on because cat 2026-07-13: "书写的时候就在 Toolbox 里反馈出来".
   */
  checkKatex?: boolean;
}

const KNOWN_MODES = new Set([
  'formula_inline',
  'formula_display',
  'text',
  'block',
]);

/**
 * Lint one already-JSON-parsed package payload. Returns a LintReport with
 * the `file` slot left unset (the caller — usually the CLI — fills it).
 */
export function lintPackage(
  raw: unknown,
  opts: LintPackageOptions = {},
): LintReport {
  const checkKatexEnabled = opts.checkKatex !== false;
  const issues: LintIssue[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push({
      severity: 'error',
      code: 'package.not-object',
      message: `Macro package must be a JSON object, got ${describe(raw)}.`,
    });
    return { issues };
  }
  const pkg = raw as Partial<MacroPackageFile>;

  // L1 — package-level fields
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    issues.push({
      severity: 'error',
      code: 'package.missing-version',
      message: 'Field `version` must be a non-empty string.',
      path: 'version',
    });
  }
  if (typeof pkg.name !== 'string' || pkg.name === '') {
    issues.push({
      severity: 'error',
      code: 'package.missing-name',
      message: 'Field `name` must be a non-empty string.',
      path: 'name',
    });
  }
  if (pkg.description !== undefined && typeof pkg.description !== 'string') {
    issues.push({
      severity: 'error',
      code: 'package.bad-description',
      message: '`description` must be a string when present.',
      path: 'description',
    });
  }
  if (
    typeof pkg.macros !== 'object' ||
    pkg.macros === null ||
    Array.isArray(pkg.macros)
  ) {
    issues.push({
      severity: 'error',
      code: 'package.missing-macros',
      message: '`macros` must be an object (name → macro).',
      path: 'macros',
    });
    return { issues };
  }

  // L1 + L2 — per-macro
  for (const [macroName, rawMacro] of Object.entries(pkg.macros)) {
    lintMacroEntry(macroName, rawMacro, issues, { checkKatex: checkKatexEnabled });
  }

  return { issues };
}

function lintMacroEntry(
  name: string,
  raw: unknown,
  issues: LintIssue[],
  opts: { checkKatex: boolean },
): void {
  const macroPath = `macros.${name}`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push({
      severity: 'error',
      code: 'macro.not-object',
      message: `${macroPath}: macro entry must be an object.`,
      path: macroPath,
    });
    return;
  }
  const m = raw as Partial<MacroPackageEntryWithoutName>;

  if (typeof m.description !== 'string') {
    issues.push({
      severity: 'error',
      code: 'macro.missing-description',
      message: `${macroPath}.description must be a string (may be empty).`,
      path: `${macroPath}.description`,
    });
  }

  if (
    typeof m.source !== 'object' ||
    m.source === null ||
    !Array.isArray((m.source as { entries?: unknown }).entries) ||
    !Array.isArray((m.source as { urls?: unknown }).urls)
  ) {
    issues.push({
      severity: 'error',
      code: 'macro.bad-source',
      message:
        `${macroPath}.source must be { entries: string[], urls: string[] } ` +
        `(both arrays required, may be empty).`,
      path: `${macroPath}.source`,
    });
  }

  if (typeof m.dynamic_arity !== 'boolean') {
    issues.push({
      severity: 'error',
      code: 'macro.missing-dynamic-arity',
      message: `${macroPath}.dynamic_arity must be a boolean.`,
      path: `${macroPath}.dynamic_arity`,
    });
  }

  if (!Array.isArray(m.styles) || m.styles.length === 0) {
    issues.push({
      severity: 'error',
      code: 'macro.missing-styles',
      message: `${macroPath}.styles must be a non-empty array.`,
      path: `${macroPath}.styles`,
    });
    return; // no styles to lint further
  }

  // L1 — per-style + tag uniqueness
  const seenTags = new Set<string>();
  const styleIndexMaxes: number[] = [];
  const styleHasVariadic: boolean[] = [];
  const styleHasRendererKey: boolean[] = [];
  const styleTemplateNonEmpty: boolean[] = [];
  m.styles.forEach((rawStyle, i) => {
    const stylePath = `${macroPath}.styles[${i}]`;
    if (typeof rawStyle !== 'object' || rawStyle === null || Array.isArray(rawStyle)) {
      issues.push({
        severity: 'error',
        code: 'style.not-object',
        message: `${stylePath} must be an object.`,
        path: stylePath,
      });
      return;
    }
    const s = rawStyle as Partial<MacroPackageStyle>;

    if (typeof s.tag !== 'string' || s.tag === '') {
      issues.push({
        severity: 'error',
        code: 'style.missing-tag',
        message: `${stylePath}.tag must be a non-empty string.`,
        path: `${stylePath}.tag`,
      });
    } else if (seenTags.has(s.tag)) {
      issues.push({
        severity: 'error',
        code: 'style.duplicate-tag',
        message: `${stylePath}.tag '${s.tag}' is duplicated within this macro.`,
        path: `${stylePath}.tag`,
      });
    } else {
      seenTags.add(s.tag);
    }

    if (typeof s.mode !== 'string' || !KNOWN_MODES.has(s.mode)) {
      issues.push({
        severity: 'error',
        code: 'style.bad-mode',
        message:
          `${stylePath}.mode = ${JSON.stringify(s.mode)} — must be one of ` +
          `${[...KNOWN_MODES].join(', ')}.`,
        path: `${stylePath}.mode`,
      });
    }

    if (typeof s.template !== 'string') {
      issues.push({
        severity: 'error',
        code: 'style.missing-template',
        message: `${stylePath}.template must be a string (may be empty).`,
        path: `${stylePath}.template`,
      });
      return;
    }

    // L2 — template placeholders
    const scan = scanTemplatePlaceholders(s.template);
    styleIndexMaxes.push(scan.maxIndex);
    styleHasVariadic.push(scan.hasVariadic);
    styleHasRendererKey.push(typeof s.react_renderer_key === 'string' && s.react_renderer_key !== '');
    styleTemplateNonEmpty.push(s.template.length > 0);

    // Cat 2026-07-14 §dynamic_arity-no-template: for dynamic_arity macros
    // the template body is IGNORED at render — output is fully driven by
    // (variadic_left, variadic_join, variadic_right) + recursed children.
    // Skip template-body validation entirely for those; instead warn if
    // a template was written at all (author probably expected it to do
    // something and it won't).
    if (m.dynamic_arity === true) {
      if (s.template.length > 0) {
        issues.push({
          severity: 'warning',
          code: 'style.dynamic-arity-template-ignored',
          message:
            `${stylePath}.template is non-empty but the macro is dynamic_arity — ` +
            `the template body is IGNORED at render time. Output is composed ` +
            `from variadic_left + children.join(variadic_join) + variadic_right. ` +
            `Clear the template to make this explicit.`,
          path: `${stylePath}.template`,
        });
      }
    } else {
      for (const bad of scan.badTokens) {
        issues.push({
          severity: 'error',
          code: 'style.bad-placeholder',
          message:
            `${stylePath}.template contains illegal placeholder '${bad}'; ` +
            `only '#0', '#1', … (digits) and '#*' (variadic) are recognised.`,
          path: `${stylePath}.template`,
        });
      }
      if (scan.hasVariadic) {
        issues.push({
          severity: 'error',
          code: 'style.variadic-without-dynamic-arity',
          message:
            `${stylePath}.template uses '#*' but the macro is not dynamic_arity. ` +
            `Set the macro's dynamic_arity to true, or drop the '#*' placeholder.`,
          path: `${stylePath}.template`,
        });
      }
    }

    // Delimiter fields only meaningful with dynamic_arity + #*. Not fatal
    // when present on a fixed-arity macro (extension survives round-trip),
    // but warn so agents don't leave dead config.
    if (
      m.dynamic_arity !== true &&
      (s.variadic_left !== undefined ||
        s.variadic_join !== undefined ||
        s.variadic_right !== undefined)
    ) {
      issues.push({
        severity: 'warning',
        code: 'style.variadic-delims-unused',
        message:
          `${stylePath} sets variadic_left/join/right but the macro is ` +
          `not dynamic_arity — these fields will be ignored at render time.`,
        path: stylePath,
      });
    }

    // L4 — KaTeX COMPILE PREVIEW
    //
    // Fill `#N` / `#*` slots with neutral `\square` placeholders and
    // run the template through headless KaTeX. Catches KaTeX-syntax
    // errors that are invisible at schema level: unescaped `_` inside
    // `\texttt{...}`, unbalanced `{...}`, undefined `\command`, etc.
    //
    // Only run when the template will actually hit KaTeX at runtime
    // (formula_* mode, or text/block mode with a `\command` in it).
    // Pure text templates ("hello #0") are rendered as-is and would
    // just produce noise here.
    //
    // Skips silently when a prior schema-level issue already flagged
    // this style — no point compiling a template we already know is
    // malformed.
    if (
      opts.checkKatex &&
      m.dynamic_arity !== true &&
      typeof s.template === 'string' &&
      s.template.length > 0 &&
      typeof s.mode === 'string' &&
      templateNeedsKatex(s.mode, s.template) &&
      scan.badTokens.length === 0
    ) {
      const filled = fillTemplateWithPlaceholders(s.template, {
        left: s.variadic_left,
        join: s.variadic_join,
        right: s.variadic_right,
      });
      const displayMode = s.mode === 'formula_display';
      const result = checkKatex(filled, { displayMode });
      if (!result.ok) {
        issues.push({
          severity: 'error',
          code: 'style.katex-compile',
          message:
            `${stylePath}.template does not compile under KaTeX: ` +
            `${result.message}. ` +
            `Filled preview (‘#N’ → x): ${filled}`,
          path: `${stylePath}.template`,
          position: result.position,
        });
      }
    }
  });

  // Cat 2026-07-14 §dynamic_arity-no-template: dynamic_arity macros no
  // longer need `#*` — the template body is ignored at render time. The
  // old `macro.dynamic-arity-default-style-missing-variadic` warning is
  // therefore obsolete.

  // L3 — cross-style arity mismatch (info)
  if (styleIndexMaxes.length > 1) {
    const unique = new Set(styleIndexMaxes);
    if (unique.size > 1) {
      issues.push({
        severity: 'info',
        code: 'macro.style-arity-mismatch',
        message:
          `${macroPath}: styles reference different maximum child indexes ` +
          `(${[...unique].sort((a, b) => a - b).join(', ')}). ` +
          `This is legal (SNL fills missing children as empty), but may be ` +
          `an oversight — agent decides.`,
        path: `${macroPath}.styles`,
      });
    }
  }
}

/**
 * Scan a template for placeholder tokens. Returns:
 *   - maxIndex: highest N found in `#N` (or -1 when none)
 *   - hasVariadic: true iff `#*` appears at least once
 *   - badTokens: list of literal `#...` matches that aren't `#N` or `#*`
 *
 * We match `#` followed by any run of digits or `*`, plus `#N` variants
 * where N is a decimal integer. Anything else after `#` — e.g. `#foo`,
 * `##`, `#-1` — is flagged. `#` NOT followed by anything (end of string
 * or followed by whitespace) is treated as literal, not a placeholder.
 */
function scanTemplatePlaceholders(template: string): {
  maxIndex: number;
  hasVariadic: boolean;
  badTokens: string[];
} {
  // Escaped `\#` renders as a literal `#` per template.ts (fillLatexTemplate
  // §Pass 4). Strip them before scanning so a template containing a color
  // like `\textcolor{\#ea580c}{...}` isn't reported as a bad placeholder.
  // Iroha 2026-07-11 (SNL-Basics dogfood Phase 2 hit this).
  const stripped = template.replace(/\\#/g, '');
  const re = /#(\d+|\*|[A-Za-z_][A-Za-z0-9_]*|[^A-Za-z0-9\s#])/g;
  let maxIndex = -1;
  let hasVariadic = false;
  const bad: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const rest = m[1];
    if (rest === '*') {
      hasVariadic = true;
      continue;
    }
    if (/^\d+$/.test(rest)) {
      const n = Number.parseInt(rest, 10);
      if (n > maxIndex) maxIndex = n;
      continue;
    }
    bad.push('#' + rest);
  }
  return { maxIndex, hasVariadic, badTokens: bad };
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
