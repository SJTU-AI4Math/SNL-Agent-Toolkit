/**
 * Synthesize a pure-LaTeX and a plain-text rendering of an SNL syntax
 * tree — the "what does this actually look like when compiled" view an
 * agent needs after emitting `content.snl` (cat 2026-07-10 §1).
 *
 * ## Rationale
 *
 * Looking at raw SNL source, an LLM has no idea whether
 * `leq(absValue(innerProduct(x, y)), times(norm(x), norm(y)))` produces
 * a legible inequality or a wall of nested braces. The KaTeX renderer
 * in the extension solves this for humans; agents need the same signal
 * as a string, without pulling KaTeX into the toolkit.
 *
 * ## Semantics
 *
 * Two synth modes.
 *
 *   **LaTeX synth** — the macro's `styles[i].template` field IS a
 *   KaTeX/LaTeX template with `#N` slots. For pure-composition macros
 *   (no built-in extensions like `\htmlData`, `\htmlClass`,
 *   `\mathchoice`, or block templates), the template is directly valid
 *   LaTeX. We recursively fill child slots and return the assembled
 *   string. No `\htmlData` / index annotations — those only exist in
 *   the KaTeX-in-React output. Cat: "不用 built-in 拼 LaTeX 代码的时候
 *   就不带索引信息直接拼；这种拼法我们不打索引，只有 built in 方法才
 *   带索引."
 *
 *   **Text synth** — convert the LaTeX template to prose using a small
 *   command → Unicode character map, then fill child slots. Cat: "比如
 *   KaTeX 宏是 #0 \cup #1，那么 text 宏就应该是 #0 ∪ #1（尽可能用字符串）".
 *   Built-in styling (`\mathrm`, `\text`) gets stripped; unmapped
 *   commands survive as `\name` (best-effort).
 *
 * ## Non-goals
 *
 *   - Faithful visual reproduction. Text synth is a lossy human-readable
 *     approximation — sub/sup shrink to `_`/`^`, fractions become
 *     `(a)/(b)`. If an agent needs pixel-perfect preview it should hit
 *     KaTeX directly.
 *   - Block renderers (`block_template_name`). Those are the
 *     "built-in with indices" side cat mentioned; they're just emitted
 *     as `[list](…)` / `[table](…)` placeholders so the surrounding
 *     structure stays legible.
 */

import { resolveStyle, resolve_style_template } from '@sjtu-ai4math/snl-basics';
import type {
  MacroPackageEntry,
  MacroPackageStyle,
} from './snl-doc-schema.ts';
import type { SnlSyntaxTree } from './snl-parser.ts';

/** Result of a single-tree synth. */
export interface SynthResult {
  /** The assembled string. */
  output: string;
  /** Non-fatal notes: unregistered macros, unmapped LaTeX commands, etc. */
  notes: string[];
}

/** Text-synth substitution table: LaTeX command → Unicode. */
const LATEX_TO_TEXT_CHARS: Readonly<Record<string, string>> = {
  // Set operations
  '\\cup': '∪',
  '\\cap': '∩',
  '\\setminus': '∖',
  '\\emptyset': '∅',
  '\\subseteq': '⊆',
  '\\subset': '⊂',
  '\\supseteq': '⊇',
  '\\supset': '⊃',
  '\\in': '∈',
  '\\notin': '∉',
  '\\ni': '∋',
  // Logic
  '\\land': '∧',
  '\\wedge': '∧',
  '\\lor': '∨',
  '\\vee': '∨',
  '\\lnot': '¬',
  '\\neg': '¬',
  '\\implies': '⇒',
  '\\Rightarrow': '⇒',
  '\\Leftrightarrow': '⇔',
  '\\iff': '⇔',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\top': '⊤',
  '\\bot': '⊥',
  // Relations
  '\\leq': '≤',
  '\\le': '≤',
  '\\geq': '≥',
  '\\ge': '≥',
  '\\neq': '≠',
  '\\ne': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\sim': '∼',
  '\\cong': '≅',
  '\\mapsto': '↦',
  '\\to': '→',
  '\\rightarrow': '→',
  '\\leftarrow': '←',
  '\\leftrightarrow': '↔',
  // Arithmetic / operators
  '\\times': '×',
  '\\div': '÷',
  '\\pm': '±',
  '\\mp': '∓',
  '\\cdot': '·',
  '\\ast': '∗',
  '\\star': '⋆',
  '\\circ': '∘',
  '\\bullet': '•',
  '\\oplus': '⊕',
  '\\otimes': '⊗',
  '\\odot': '⊙',
  '\\ominus': '⊖',
  // Big operators
  '\\sum': '∑',
  '\\prod': '∏',
  '\\coprod': '∐',
  '\\int': '∫',
  '\\iint': '∬',
  '\\iiint': '∭',
  '\\oint': '∮',
  '\\bigcup': '⋃',
  '\\bigcap': '⋂',
  '\\bigoplus': '⊕',
  '\\bigotimes': '⊗',
  // Common symbols
  '\\infty': '∞',
  '\\partial': '∂',
  '\\nabla': '∇',
  '\\hbar': 'ℏ',
  '\\ell': 'ℓ',
  '\\Re': 'ℜ',
  '\\Im': 'ℑ',
  '\\aleph': 'ℵ',
  '\\wp': '℘',
  // Number sets
  '\\mathbb{N}': 'ℕ',
  '\\mathbb{Z}': 'ℤ',
  '\\mathbb{Q}': 'ℚ',
  '\\mathbb{R}': 'ℝ',
  '\\mathbb{C}': 'ℂ',
  '\\mathbb{F}': '𝔽',
  '\\mathbb{P}': 'ℙ',
  '\\mathbb{H}': 'ℍ',
  // Lowercase greek
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\varepsilon': 'ε',
  '\\zeta': 'ζ',
  '\\eta': 'η',
  '\\theta': 'θ',
  '\\vartheta': 'ϑ',
  '\\iota': 'ι',
  '\\kappa': 'κ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\nu': 'ν',
  '\\xi': 'ξ',
  '\\pi': 'π',
  '\\varpi': 'ϖ',
  '\\rho': 'ρ',
  '\\varrho': 'ϱ',
  '\\sigma': 'σ',
  '\\varsigma': 'ς',
  '\\tau': 'τ',
  '\\upsilon': 'υ',
  '\\phi': 'φ',
  '\\varphi': 'ϕ',
  '\\chi': 'χ',
  '\\psi': 'ψ',
  '\\omega': 'ω',
  // Uppercase greek (only the visually-distinct ones)
  '\\Gamma': 'Γ',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Xi': 'Ξ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Upsilon': 'Υ',
  '\\Phi': 'Φ',
  '\\Psi': 'Ψ',
  '\\Omega': 'Ω',
  // Spacing / whitespace
  '\\,': ' ',
  '\\;': ' ',
  '\\!': '',
  '\\ ': ' ',
  '\\quad': '  ',
  '\\qquad': '    ',
  // Ellipsis
  '\\ldots': '…',
  '\\cdots': '⋯',
  '\\dots': '…',
  '\\vdots': '⋮',
  '\\ddots': '⋱',
  // Delimiters (leave the char as-is; drop the \left/\right sizing)
  '\\left': '',
  '\\right': '',
  '\\lVert': '‖',
  '\\rVert': '‖',
  '\\|': '‖',
  '\\lvert': '|',
  '\\rvert': '|',
  '\\langle': '⟨',
  '\\rangle': '⟩',
  '\\lceil': '⌈',
  '\\rceil': '⌉',
  '\\lfloor': '⌊',
  '\\rfloor': '⌋',
};

/**
 * Best-effort LaTeX-fragment → plain-text conversion.
 *
 * Applied AFTER template `#N` slots are filled (so children have already
 * been text-synthesized recursively). Handles the common cases; anything
 * unrecognised passes through verbatim so the caller can spot it.
 *
 * Order matters: strip styling wrappers first (they contain other
 * commands that then get char-mapped), then \frac, then char map, then
 * cleanup.
 */
function latexToText(input: string, notes: string[]): string {
  let s = input;

  // Strip styling wrappers that carry no semantic content in text form.
  // Repeat to catch nested cases up to a depth cap.
  const wrappers = [
    'mathrm',
    'mathbf',
    'mathit',
    'mathsf',
    'mathtt',
    'mathcal',
    'mathscr',
    'mathfrak',
    'text',
    'textrm',
    'textbf',
    'textit',
    'textsf',
    'texttt',
    'operatorname',
    'boldsymbol',
    'bm',
  ];
  const wrapperRe = new RegExp(
    `\\\\(?:${wrappers.join('|')})\\s*\\{([^{}]*)\\}`,
    'g',
  );
  for (let i = 0; i < 5; i++) {
    const next = s.replace(wrapperRe, (_, inner: string) => inner);
    if (next === s) break;
    s = next;
  }

  // \frac{a}{b} → (a)/(b). Only single-brace-depth pairs; nested \frac
  // gets an outer pass.
  const fracRe = /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
  for (let i = 0; i < 5; i++) {
    const next = s.replace(fracRe, (_, a: string, b: string) => `(${a})/(${b})`);
    if (next === s) break;
    s = next;
  }

  // \sqrt{a} → √(a); \sqrt[n]{a} → n√(a)
  s = s.replace(
    /\\sqrt(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/g,
    (_, n: string | undefined, x: string) => (n ? `${n}√(${x})` : `√(${x})`),
  );

  // Char map: longest-first sort so `\mathbb{N}` beats `\mathbb`.
  const mapped = Object.entries(LATEX_TO_TEXT_CHARS).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [cmd, glyph] of mapped) {
    if (!s.includes(cmd)) continue;
    // Escape regex meta in the LaTeX command.
    const re = new RegExp(
      cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g',
    );
    s = s.replace(re, glyph);
  }

  // Any remaining `\name` command that survived — report once, leave
  // in place so the agent sees what didn't convert.
  const survivorRe = /\\[A-Za-z]+/g;
  const survivors = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = survivorRe.exec(s)) !== null) survivors.add(m[0]);
  for (const cmd of survivors) {
    notes.push(
      `Unmapped LaTeX command in text synth: \`${cmd}\` (survived as-is).`,
    );
  }

  // _{x} → _x, ^{x} → ^x (single-brace unwrap for legibility).
  s = s
    .replace(/_\{([^{}]*)\}/g, '_$1')
    .replace(/\^\{([^{}]*)\}/g, '^$1');

  // Drop leftover LaTeX braces that had no wrapping command.
  s = s.replace(/[{}]/g, '');

  return s;
}

/**
 * Assemble the value that fills a `#N` slot for a given child.
 *
 * The variadic separator/left/right delimiters used to join `#*` come
 * from the ACTIVE style. For text mode, formula-default `', '` is
 * fine but we let the style override.
 */
function joinVariadic(
  style: MacroPackageStyle,
  rendered: string[],
): string {
  const defaultSep = style.mode === 'text' ? '' : ', ';
  return rendered.join(style.separator ?? defaultSep);
}

/**
 * Simple `#N` template fill (no missing-slot placeholders — this is a
 * synth for review, not a live preview; missing slots surface as `#N`
 * verbatim so the agent sees what wasn't provided).
 */
function fillTemplate(
  template: string,
  values: Record<string, string | undefined>,
): string {
  const ESCAPED = '\u0001HASH\u0001';
  let out = template.replace(/\\#/g, ESCAPED);
  out = out.replace(/#(\d{1,2})/g, (_, d: string) => {
    const v = values[`child${Number(d)}`];
    return v === undefined ? `#${d}` : v;
  });
  out = out.replace(/#\*/g, () => {
    const j = values['children_joined'];
    return j === undefined ? '#*' : j;
  });
  return out.split(ESCAPED).join('\\#');
}

/** Pick the SNL-Basics v0.2.0 runtime-compatible style: explicit bracket, language default, English, then styles[0]. */
function pickStyle(
  macro: MacroPackageEntry,
  node: SnlSyntaxTree,
): MacroPackageStyle | undefined {
  if (macro.styles.length === 0) return undefined;
  return resolveStyle(node, macro, 'en') as MacroPackageStyle;
}

/** Escape temporary backtick payload for a LaTeX `\\texttt{...}` group. */
function escapeTemporaryText(value: string): string {
  return value.replace(/([\\{}%$#&_])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
}

/** Escape identifier text for inclusion in a LaTeX fragment. */
function escapeIdent(name: string): string {
  // Identifiers in SNL are already plain [A-Za-z0-9_.-]. Underscores are
  // the only real hazard — escape them so LaTeX doesn't treat them as
  // subscript starters.
  return name.replace(/_/g, '\\_');
}

function ownMacro(macros: Record<string, MacroPackageEntry>, name: string): MacroPackageEntry | undefined {
  return Object.hasOwn(macros, name) ? macros[name] : undefined;
}

type RenderedNode = { output: string; mode: MacroPackageStyle['mode'] };

function wrapForParent(child: RenderedNode, parentMode: MacroPackageStyle['mode']): string {
  const childText = child.mode === 'text';
  const parentText = parentMode === 'text';
  if (!parentText && childText) return `\\text{${child.output}}`;
  if (parentText && !childText && child.mode !== 'block') return `$${child.output}$`;
  return child.output;
}

/**
 * Recursively render a node.
 *
 * The SNL parser leaves nodes UNRESOLVED at parse time — `kind` is `""`
 * for anything the annotate-bind pass would classify as macro/bvar/fvar.
 * The toolkit doesn't run annotate-bind (that lives in the react view),
 * so we resolve on our own:
 *
 *   1. `env_mode` set → formula/text LEAF ($…$ / %…% / $$…$$). Content
 *      is `node.macro_name`, no children.
 *   2. Name resolves in the macro pool → macro node: pick style, recurse
 *      on children, fill template.
 *   3. No children, unresolved → bare identifier (bvar/fvar fallback):
 *      emit the name verbatim.
 *   4. Has children, unresolved → syntactically a macro call for a name
 *      the pool doesn't know. Emit `name(child1, child2)` with a note.
 */
function renderNode(
  node: SnlSyntaxTree,
  mode: 'latex' | 'text',
  macros: Record<string, MacroPackageEntry>,
  notes: string[],
): RenderedNode {
  // Formula / text leaves — the parser marks these with env_mode.
  const envMode = node.env_mode;
  if (typeof envMode === 'string' && envMode.length > 0) {
    const raw = node.temporary_source ?? node.macro_name;
    if (node.temporary_format === 'texttt') {
      return { output: `\\texttt{${escapeTemporaryText(raw)}}`, mode: 'formula_inline' };
    }
    if (envMode === 'text') {
      return { output: raw, mode: 'text' };
    }
    if (mode === 'latex') {
      return { output: raw, mode: envMode as MacroPackageStyle['mode'] };
    }
    return { output: `$${latexToText(raw, notes)}$`, mode: envMode as MacroPackageStyle['mode'] };
  }

  const name = node.macro_name;
  const children = Array.isArray(node.children) ? node.children : [];

  // Leaf identifier (no children, no macro match) → bare name.
  const macro = ownMacro(macros, name);
  if (!macro && children.length === 0) {
    return { output: mode === 'latex' ? escapeIdent(name) : name, mode: 'formula_inline' };
  }

  if (!macro) {
    const renderedChildren = children.map((c) => renderNode(c, mode, macros, notes));
    notes.push(
      `Unregistered macro '${name}' — emitted as \`${name}(...)\` fallback.`,
    );
    return { output: `${name}(${renderedChildren.map((child) => child.output).join(', ')})`, mode: 'formula_inline' };
  }
  const style = pickStyle(macro, node);
  if (!style) {
    const renderedChildren = children.map((c) => renderNode(c, mode, macros, notes));
    notes.push(
      `Macro '${name}' has no styles — emitted as \`${name}(...)\` fallback.`,
    );
    return { output: `${name}(${renderedChildren.map((child) => child.output).join(', ')})`, mode: 'formula_inline' };
  }

  const template = resolve_style_template(style, undefined, 'en');
  const renderedChildren = children.map((c) => renderNode(c, mode, macros, notes));
  const wrappedChildren = mode === 'latex'
    ? renderedChildren.map((child) => wrapForParent(child, style.mode))
    : renderedChildren.map((child) => child.output);

  // Assemble the slot map.
  const values: Record<string, string | undefined> = {};
  wrappedChildren.forEach((v, i) => {
    values[`child${i}`] = v;
  });
  if (macro.dynamic_arity) {
    if (!template.includes('#*')) {
      throw new Error(`Dynamic macro '${name}' style '${style.style_name}' requires #* in its template.`);
    }
    values['children_joined'] = joinVariadic(style, wrappedChildren);
  }

  // Pick the source template. LaTeX synth prefers style.latex.synthesis
  // (the consumer-owned "how do I compile this to real LaTeX" override)
  // and falls back to the KaTeX template itself — for pure-composition
  // macros the two are identical, which is cat's whole design: "如果一个
  // 宏是 #0 + #1, 那么它在 KaTeX in React 的宏写法和 LaTeX 宏写法应该
  // 是完全一样的." No index/htmlData annotation — those only appear in
  // the KaTeX-in-React output.
  if (mode === 'latex') {
    const explicit = style.latex?.synthesis?.macro;
    const src = typeof explicit === 'string' && explicit.length > 0
      ? explicit
      : template;
    return { output: fillTemplate(src, values), mode: style.mode };
  }
  // Text mode: prefer style.text if provided, else convert the KaTeX
  // template to Unicode-char text and fill afterwards (fill AFTER
  // conversion so child strings — already text-synthesized — don't get
  // char-mapped twice).
  const explicitText = style.text;
  if (typeof explicitText === 'string' && explicitText.length > 0) {
    return { output: fillTemplate(explicitText, values), mode: style.mode };
  }
  const converted = latexToText(template, notes);
  return { output: fillTemplate(converted, values), mode: style.mode };
}

/**
 * Public entry: render a parsed SNL tree as pure LaTeX.
 * The output is intended to be paste-able into a LaTeX document (for
 * pure-composition macros). Missing slots stay as `#N` so the agent
 * can spot them.
 */
export function renderTreeAsLatex(
  tree: SnlSyntaxTree,
  macros: Record<string, MacroPackageEntry>,
): SynthResult {
  const notes: string[] = [];
  const output = renderNode(tree, 'latex', macros, notes).output;
  return { output, notes: dedupe(notes) };
}

/**
 * Public entry: render a parsed SNL tree as plain text (Unicode-heavy,
 * legible approximation of the LaTeX rendering).
 */
export function renderTreeAsText(
  tree: SnlSyntaxTree,
  macros: Record<string, MacroPackageEntry>,
): SynthResult {
  const notes: string[] = [];
  const output = renderNode(tree, 'text', macros, notes).output;
  return { output, notes: dedupe(notes) };
}

function dedupe(a: string[]): string[] {
  return [...new Set(a)];
}
