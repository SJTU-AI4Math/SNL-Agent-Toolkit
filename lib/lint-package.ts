/** Lint the synthetic Package view assembled from per-entity Macro storage. */
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
  /** Compile formula/KaTeX-bearing templates after filling placeholders. */
  checkKatex?: boolean;
}

const KNOWN_MODES = new Set(['formula_inline', 'formula_display', 'text', 'block']);
const STYLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LEGACY_STYLE_FIELDS = [
  'tag',
  'variadic_left',
  'variadic_join',
  'variadic_right',
  'react_renderer_key',
] as const;

export function lintPackage(raw: unknown, opts: LintPackageOptions = {}): LintReport {
  const issues: LintIssue[] = [];
  if (!isRecord(raw)) {
    issues.push({ severity: 'error', code: 'package.not-object', message: `Macro package must be a JSON object, got ${describe(raw)}.` });
    return { issues };
  }
  const pkg = raw as Partial<MacroPackageFile>;
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    issues.push({ severity: 'error', code: 'package.missing-version', message: 'Field `version` must be a non-empty string.', path: 'version' });
  }
  if (typeof pkg.name !== 'string' || pkg.name === '') {
    issues.push({ severity: 'error', code: 'package.missing-name', message: 'Field `name` must be a non-empty string.', path: 'name' });
  }
  if (pkg.description !== undefined && typeof pkg.description !== 'string') {
    issues.push({ severity: 'error', code: 'package.bad-description', message: '`description` must be a string when present.', path: 'description' });
  }
  if (!isRecord(pkg.macros)) {
    issues.push({ severity: 'error', code: 'package.missing-macros', message: '`macros` must be an object (name → macro).', path: 'macros' });
    return { issues };
  }
  for (const [name, macro] of Object.entries(pkg.macros)) {
    lintMacroEntry(name, macro, issues, opts.checkKatex !== false);
  }
  return { issues };
}

function lintMacroEntry(name: string, raw: unknown, issues: LintIssue[], checkKatexEnabled: boolean): void {
  const path = `macros.${name}`;
  if (!isRecord(raw)) {
    issues.push({ severity: 'error', code: 'macro.not-object', message: `${path}: macro entry must be an object.`, path });
    return;
  }
  const macro = raw as Partial<MacroPackageEntryWithoutName>;
  if (typeof macro.description !== 'string') {
    issues.push({ severity: 'error', code: 'macro.missing-description', message: `${path}.description must be a string (may be empty).`, path: `${path}.description` });
  }
  if (!isRecord(macro.source) || !isStringArray(macro.source.entries) || !isStringArray(macro.source.urls)) {
    issues.push({ severity: 'error', code: 'macro.bad-source', message: `${path}.source must be { entries: string[], urls: string[] } (both arrays required, may be empty).`, path: `${path}.source` });
  }
  if (typeof macro.dynamic_arity !== 'boolean') {
    issues.push({ severity: 'error', code: 'macro.missing-dynamic-arity', message: `${path}.dynamic_arity must be a boolean.`, path: `${path}.dynamic_arity` });
  }
  if (macro.kind !== undefined && typeof macro.kind !== 'string') {
    issues.push({ severity: 'error', code: 'macro.bad-kind', message: `${path}.kind must be a string when present.`, path: `${path}.kind` });
  }
  if (!isStringArray(macro.tags)) {
    issues.push({ severity: 'error', code: 'macro.missing-tags', message: `${path}.tags must be a string array (may be empty).`, path: `${path}.tags` });
  } else if (macro.tags.some((tag) => tag.includes('\\'))) {
    issues.push({ severity: 'error', code: 'macro.bad-tags', message: `${path}.tags must not contain backslashes.`, path: `${path}.tags` });
  }
  const defaultStyle = (macro as Record<string, unknown>).default_style;
  if (defaultStyle === undefined) {
    issues.push({ severity: 'error', code: 'macro.missing-default-style', message: `${path}.default_style must be a language → style-name object.`, path: `${path}.default_style` });
  } else if (!isRecord(defaultStyle) || Object.values(defaultStyle).some((value) => typeof value !== 'string')) {
    issues.push({ severity: 'error', code: 'macro.bad-default-style', message: `${path}.default_style must map language keys to style-name strings.`, path: `${path}.default_style` });
  }
  if (!Array.isArray(macro.styles) || macro.styles.length === 0) {
    issues.push({ severity: 'error', code: 'macro.missing-styles', message: `${path}.styles must be a non-empty array.`, path: `${path}.styles` });
    return;
  }

  const seenNames = new Set<string>();
  const maxIndexes: number[] = [];
  macro.styles.forEach((rawStyle, index) => {
    const stylePath = `${path}.styles[${index}]`;
    if (!isRecord(rawStyle)) {
      issues.push({ severity: 'error', code: 'style.not-object', message: `${stylePath} must be an object.`, path: stylePath });
      return;
    }
    const style = rawStyle as Partial<MacroPackageStyle>;
    for (const field of LEGACY_STYLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(rawStyle, field)) {
        issues.push({ severity: 'error', code: 'style.legacy-field', message: `${stylePath}.${field} is a pre-v7 field and is not allowed by Macro v8. Migrate the package.`, path: `${stylePath}.${field}` });
      }
    }
    if (typeof style.style_name !== 'string' || style.style_name === '') {
      issues.push({ severity: 'error', code: 'style.missing-name', message: `${stylePath}.style_name must be a non-empty string.`, path: `${stylePath}.style_name` });
    } else if (!STYLE_NAME_RE.test(style.style_name)) {
      issues.push({ severity: 'error', code: 'style.bad-name', message: `${stylePath}.style_name must match ${STYLE_NAME_RE}.`, path: `${stylePath}.style_name` });
    } else if (seenNames.has(style.style_name)) {
      issues.push({ severity: 'error', code: 'style.duplicate-name', message: `${stylePath}.style_name '${style.style_name}' is duplicated within this macro.`, path: `${stylePath}.style_name` });
    } else {
      seenNames.add(style.style_name);
    }
    if (typeof style.mode !== 'string' || !KNOWN_MODES.has(style.mode)) {
      issues.push({ severity: 'error', code: 'style.bad-mode', message: `${stylePath}.mode = ${JSON.stringify(style.mode)} — must be one of ${[...KNOWN_MODES].join(', ')}.`, path: `${stylePath}.mode` });
    }
    if (!isStringArray(style.tags)) {
      issues.push({ severity: 'error', code: 'style.missing-tags', message: `${stylePath}.tags must be a string array (may be empty).`, path: `${stylePath}.tags` });
    } else if (style.tags.some((tag) => tag.includes('\\'))) {
      issues.push({ severity: 'error', code: 'style.bad-tags', message: `${stylePath}.tags must not contain backslashes.`, path: `${stylePath}.tags` });
    }
    if (style.separator !== undefined && typeof style.separator !== 'string') {
      issues.push({ severity: 'error', code: 'style.bad-separator', message: `${stylePath}.separator must be a string when present.`, path: `${stylePath}.separator` });
    }
    if (style.block_template_name !== undefined && typeof style.block_template_name !== 'string') {
      issues.push({ severity: 'error', code: 'style.bad-block-template', message: `${stylePath}.block_template_name must be a string when present.`, path: `${stylePath}.block_template_name` });
    } else if (style.block_template_name !== undefined && style.mode !== 'block') {
      issues.push({ severity: 'error', code: 'style.block-template-non-block', message: `${stylePath}.block_template_name is valid only in block mode.`, path: `${stylePath}.block_template_name` });
    }
    if (typeof style.template !== 'string' || style.template.trim().length === 0) {
      issues.push({ severity: 'error', code: 'style.missing-template', message: `${stylePath}.template must be a non-empty string.`, path: `${stylePath}.template` });
      return;
    }

    const scan = scanTemplatePlaceholders(style.template);
    maxIndexes.push(scan.maxIndex);
    for (const token of scan.badTokens) {
      issues.push({ severity: 'error', code: 'style.bad-placeholder', message: `${stylePath}.template contains illegal placeholder '${token}'; only canonical '#0' through '#99' and '#*' are recognised (escape a literal hash as '\\#').`, path: `${stylePath}.template` });
    }
    if (macro.dynamic_arity === true && !scan.hasVariadic) {
      issues.push({ severity: 'error', code: 'style.dynamic-arity-missing-variadic', message: `${stylePath}.template must contain '#*' because the macro is dynamic_arity.`, path: `${stylePath}.template` });
    } else if (macro.dynamic_arity !== true && scan.hasVariadic) {
      issues.push({ severity: 'error', code: 'style.variadic-without-dynamic-arity', message: `${stylePath}.template uses '#*' but the macro is not dynamic_arity.`, path: `${stylePath}.template` });
    }
    if (macro.dynamic_arity !== true && style.separator !== undefined) {
      issues.push({ severity: 'warning', code: 'style.separator-unused', message: `${stylePath}.separator is ignored when the macro is not dynamic_arity.`, path: `${stylePath}.separator` });
    }

    // Partial macros are rendering fragments: they may intentionally contain
    // syntax (for example an `&`-prefixed aligned row) that is valid only after
    // a parent macro has embedded it. Keep all structural validation above,
    // but do not pretend the fragment is a standalone KaTeX document.
    if (checkKatexEnabled && macro.kind !== 'partial' && style.template.length > 0 && typeof style.mode === 'string' && templateNeedsKatex(style.mode, style.template) && scan.badTokens.length === 0) {
      const filled = fillTemplateWithPlaceholders(style.template, { separator: typeof style.separator === 'string' ? style.separator : undefined });
      const result = checkKatex(filled, { displayMode: style.mode === 'formula_display' });
      if (!result.ok) {
        issues.push({ severity: 'error', code: 'style.katex-compile', message: `${stylePath}.template does not compile under KaTeX: ${result.message}. Filled preview (‘#N’ → x): ${filled}`, path: `${stylePath}.template`, position: result.position });
      }
    }
  });

  if (isRecord(defaultStyle)) {
    for (const [language, styleName] of Object.entries(defaultStyle)) {
      if (!language.trim() || typeof styleName !== 'string' || !seenNames.has(styleName)) {
        issues.push({ severity: 'error', code: 'macro.bad-default-style', message: `${path}.default_style[${JSON.stringify(language)}] must name a declared style.`, path: `${path}.default_style` });
      }
    }
  }

  if (maxIndexes.length > 1 && new Set(maxIndexes).size > 1) {
    issues.push({ severity: 'info', code: 'macro.style-arity-mismatch', message: `${path}: styles reference different maximum child indexes (${[...new Set(maxIndexes)].sort((a, b) => a - b).join(', ')}). This is legal but may be an oversight.`, path: `${path}.styles` });
  }
}

function scanTemplatePlaceholders(template: string): { maxIndex: number; hasVariadic: boolean; badTokens: string[] } {
  let maxIndex = -1;
  let hasVariadic = false;
  const badTokens: string[] = [];

  for (let index = 0; index < template.length; index += 1) {
    if (template[index] !== '#' || (index > 0 && template[index - 1] === '\\')) continue;

    const next = template[index + 1];
    if (next === '*') {
      hasVariadic = true;
      index += 1;
      continue;
    }
    if (next !== undefined && /\d/.test(next)) {
      let end = index + 2;
      while (end < template.length && /\d/.test(template[end])) end += 1;
      const digits = template.slice(index + 1, end);
      if (/^(?:0|[1-9]\d?)$/.test(digits)) {
        maxIndex = Math.max(maxIndex, Number.parseInt(digits, 10));
      } else {
        badTokens.push(`#${digits}`);
      }
      index = end - 1;
      continue;
    }

    let end = index + 1;
    if (next === '#') end += 1;
    else if (next !== undefined && /[A-Za-z_]/.test(next)) {
      end += 1;
      while (end < template.length && /[A-Za-z0-9_]/.test(template[end])) end += 1;
    } else if (next !== undefined && !/\s/.test(next)) end += 1;
    badTokens.push(template.slice(index, end));
    index = end - 1;
  }
  return { maxIndex, hasVariadic, badTokens };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
