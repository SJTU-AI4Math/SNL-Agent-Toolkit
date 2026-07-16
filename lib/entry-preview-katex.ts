/**
 * Entry-preview KaTeX check.
 *
 * Reproduces the extension's Preview render pipeline end-to-end and
 * runs the resulting KaTeX source through headless KaTeX:
 *
 *   1. Take an entry's `title` (which may contain `$…$` islands, per
 *      the same syntax `EntryRender.titleToKatexSource` uses).
 *   2. Take `content.snl`, parse it into an SNL tree, run
 *      `resolveRootLatex` from SNL-Basics (the SAME pure renderer
 *      SnlSyntaxTreeView uses at runtime — imported from
 *      `../external/SNL-Basics/src/snl-react-view/render-source.ts`).
 *   3. Feed each resulting KaTeX source through
 *      `checkKatex({ throwOnError: true })` — the same headless
 *      compile the package linter already uses for template previews.
 *
 * This closes the gap the package-linter can't cover: the package
 * linter fills `#N` slots with a neutral `x` placeholder and only
 * type-checks templates in isolation. It cannot see, for example,
 * that `Type.literal(formula_inline)` renders as
 * `\texttt{\color{CE9178}\mathrm{formula\_inline}}` under the real
 * fallback rules — and that KaTeX would reject it as
 * "Can't use function '\\mathrm' in text mode".
 */

import katex from 'katex';

import { parseSnlSyntaxTree } from '../external/SNL-Basics/src/snl-syntax-tree/parser.ts';
import { annotateBindings } from '../external/SNL-Basics/src/snl-syntax-tree/annotate-bind.ts';
import { resolveRootLatex } from '../external/SNL-Basics/src/snl-react-view/render-source.ts';
import type {
  SnlMacro,
  SnlMacroDb,
  SnlMacroStyle,
} from '../external/SNL-Basics/src/snl-macro/types.ts';
import type { SnlMacroTemplateQuery } from '../external/SNL-Basics/src/snl-syntax-tree/query.ts';

import type {
  EntryData,
  MacroPackageEntry,
  MacroPackageStyle,
} from './snl-doc-schema.ts';

export interface EntryPreviewIssue {
  /** Structural location — 'title' or 'content.snl'. */
  path: 'title' | 'content.snl';
  /** Human-readable KaTeX error (without the "at position N" tail). */
  message: string;
  /** Character offset into the compiled KaTeX source, if KaTeX reported one. */
  position?: number;
  /** The KaTeX source that failed to compile (short, for report context). */
  source: string;
}

export interface CheckEntryPreviewOptions {
  /** Macro pool (name → package entry). */
  macros: Record<string, MacroPackageEntry>;
}

/**
 * Compile-check the entry's Preview render as an author would see it.
 * Returns [] when everything compiles.
 *
 * `title` errors are reported with `path='title'`; SNL body errors with
 * `path='content.snl'`. Parse errors in the SNL body are NOT reported
 * here — the L2 SNL-parse layer of `lintEntry` already surfaces those,
 * and we bail out silently rather than double-report.
 */
export async function checkEntryPreview(
  entry: EntryData,
  opts: CheckEntryPreviewOptions,
): Promise<EntryPreviewIssue[]> {
  const issues: EntryPreviewIssue[] = [];

  // --- title -----------------------------------------------------------
  const title = typeof entry.title === 'string' ? entry.title : '';
  if (title.length > 0) {
    let titleSrc: string;
    try {
      titleSrc = titleToKatexSource(title);
    } catch (err) {
      // Unbalanced `$` etc. — surface as a preview error.
      issues.push({
        path: 'title',
        message: (err as Error).message,
        source: title,
      });
      titleSrc = '';
    }
    if (titleSrc.length > 0) {
      const r = runKatex(titleSrc, /* displayMode */ false);
      if (!r.ok) {
        issues.push({ path: 'title', ...r, source: titleSrc });
      }
    }
  }

  // --- content.snl -----------------------------------------------------
  const snl =
    typeof entry.content?.snl === 'string' ? entry.content.snl : '';
  if (snl.trim().length > 0) {
    let tree;
    try {
      tree = parseSnlSyntaxTree(snl);
    } catch {
      // L2 already reports parse errors; skip.
      return issues;
    }
    try {
      annotateBindings(tree);
    } catch {
      // annotate-bind can throw on malformed binder scopes — ignore
      // here; L2's parse layer usually catches those separately.
    }
    const db: SnlMacroDb = toSnlMacroDb(opts.macros);
    const query: SnlMacroTemplateQuery = async ({ name, node }) => {
      const macro = db[name];
      if (macro && macro.styles.length > 0) {
        const style =
          node.style == null
            ? macro.styles[0]
            : macro.styles.find((s) => s.tag === node.style) ??
              macro.styles[0];
        if (style?.template) return style.template;
      }
      // Same fallback fallbackLatexSymbol uses in default-query.ts.
      if (/^[A-Za-z]+$/.test(name)) return name;
      // Numeric literal (cat 2026-07-14 §numeral): render bare in math mode.
      if (/^-?\d+(\.\d+)?$/.test(name)) return name;
      return `\\mathrm{${escapeLatexText(name)}}`;
    };
    let src: string;
    try {
      src = await resolveRootLatex(tree, query, new Map(), db);
    } catch (err) {
      issues.push({
        path: 'content.snl',
        message: `Render pipeline threw: ${(err as Error).message}`,
        source: snl,
      });
      return issues;
    }
    const displayMode = rootIsDisplay(tree, db);
    const r = runKatex(src, displayMode);
    if (!r.ok) {
      issues.push({ path: 'content.snl', ...r, source: src });
    }
  }

  return issues;
}

/**
 * Compile a KaTeX source with the same options the SNL Preview uses at
 * runtime, but with `throwOnError: true` so we can surface the error
 * rather than let KaTeX render it inline as red text (which is exactly
 * what the author is trying to avoid).
 */
function runKatex(
  source: string,
  displayMode: boolean,
): { ok: true } | { ok: false; message: string; position?: number } {
  try {
    katex.renderToString(source, {
      throwOnError: true,
      displayMode,
      // Match the extension's runtime KaTeX (non-strict) so we don't
      // raise false positives the author can't reproduce in-app.
      strict: 'ignore',
      // Preview enables the `\htmlData` / `\htmlClass` trust group; we
      // must too, since `resolveRootLatex` emits `\htmlData{...}{...}`
      // around every node.
      trust: true,
    });
    return { ok: true };
  } catch (err) {
    const raw = (err as Error).message ?? String(err);
    return parseKatexError(raw);
  }
}

function parseKatexError(raw: string): {
  ok: false;
  message: string;
  position?: number;
} {
  let msg = raw.replace(/^KaTeX parse error:\s*/, '');
  let position: number | undefined;
  const posMatch = msg.match(/ at position (\d+):\s.*$/);
  if (posMatch) {
    position = Number.parseInt(posMatch[1], 10);
    msg = msg.slice(0, posMatch.index);
  }
  return { ok: false, message: msg, position };
}

/** Same 4-mode collapse used by the ROOT display axis. */
function rootIsDisplay(tree: any, db: SnlMacroDb): boolean {
  const envMode = tree.envMode;
  if (typeof envMode === 'string') return envMode === 'formula_display';
  const macro = db[tree.name];
  if (!macro) return false;
  const styleTag = tree.style;
  const style =
    styleTag == null
      ? macro.styles[0]
      : macro.styles.find((s) => s.tag === styleTag) ?? macro.styles[0];
  return style?.mode === 'formula_display';
}

/**
 * Adapt the toolkit's `MacroPackageEntry` records into the
 * `SnlMacroDb` shape the pure renderer expects. Structural equivalence:
 * MacroPackageEntry has `{name, styles[], kind?, dynamic_arity, tags?}`
 * matching `SnlMacro`, and MacroPackageStyle covers `SnlMacroStyle`.
 */
function toSnlMacroDb(
  macros: Record<string, MacroPackageEntry>,
): SnlMacroDb {
  const db: SnlMacroDb = {};
  for (const [name, m] of Object.entries(macros)) {
    db[name] = adaptMacro(name, m);
  }
  return db;
}

function adaptMacro(name: string, m: MacroPackageEntry): SnlMacro {
  return {
    name,
    description: (m as any).description ?? '',
    // SnlMacroSource in SNL-Basics is `{ entries: string[], urls: string[] }`;
    // the pure renderer never reads it, so an empty stub is fine.
    source: { entries: [], urls: [] },
    kind: m.kind,
    dynamic_arity: !!m.dynamic_arity,
    styles: (m.styles ?? []).map(adaptStyle),
    tags: (m as any).tags,
  };
}

function adaptStyle(s: MacroPackageStyle): SnlMacroStyle {
  return {
    tag: s.tag,
    mode: s.mode,
    template: s.template,
    variadic_left: s.variadic_left,
    variadic_join: s.variadic_join,
    variadic_right: s.variadic_right,
    react_renderer_key: s.react_renderer_key,
    tags: s.tags,
  };
}

// --- title-to-KaTeX conversion --------------------------------------------
// Mirrors webview/src/render/EntryRender.tsx: text runs become
// `\text{…}` with escaped specials; `$…$` runs pass through as math.

function escapeForKatexText(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/([{}$&#_%])/g, '\\$1');
}

function escapeLatexText(raw: string): string {
  return raw.replace(/[\\{}_$%&#^~]/g, (ch) => `\\${ch}`);
}

function titleToKatexSource(src: string): string {
  if (src.length === 0) return '';
  interface Seg {
    mode: 'text' | 'math';
    text: string;
  }
  const parts: Seg[] = [];
  let mode: 'text' | 'math' = 'text';
  let buf = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (mode === 'text' && c === '\\' && src[i + 1] === '$') {
      buf += '\\$';
      i += 2;
      continue;
    }
    if (c === '$') {
      if (mode === 'text' && src[i + 1] === '$') {
        buf += '$$';
        i += 2;
        continue;
      }
      parts.push({ mode, text: buf });
      buf = '';
      mode = mode === 'text' ? 'math' : 'text';
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  parts.push({ mode, text: buf });
  if (mode !== 'text') {
    throw new Error("Unbalanced `$` in title (opened math run never closed).");
  }
  return parts
    .map((p) => {
      if (p.mode === 'math') return p.text;
      if (!p.text) return '';
      return `\\text{${escapeForKatexText(p.text)}}`;
    })
    .join('');
}
