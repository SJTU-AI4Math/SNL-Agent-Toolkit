/**
 * Tests for the pure-LaTeX / plain-text SNL synthesis (cat 2026-07-10 §1).
 *
 * The point of these two views: an agent looking at an emitted
 * `content.snl` tree can't tell whether it renders sensibly. Piping
 * the tree through the synth gives it a preview it CAN read without
 * pulling in KaTeX.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderTreeAsLatex, renderTreeAsText } from '../lib/snl-render.ts';
import { tryParseSnlSyntaxTree } from '../lib/snl-parser.ts';
import type { MacroPackageEntry } from '../lib/snl-doc-schema.ts';

/** Convenience: parse SNL, assert success, render as LaTeX. */
function synthLatex(
  snl: string,
  macros: Record<string, MacroPackageEntry>,
): { output: string; notes: string[] } {
  const p = tryParseSnlSyntaxTree(snl);
  if (!p.ok) throw new Error(`parse fail: ${p.error}`);
  return renderTreeAsLatex(p.tree, macros);
}
function synthText(
  snl: string,
  macros: Record<string, MacroPackageEntry>,
): { output: string; notes: string[] } {
  const p = tryParseSnlSyntaxTree(snl);
  if (!p.ok) throw new Error(`parse fail: ${p.error}`);
  return renderTreeAsText(p.tree, macros);
}

const macros: Record<string, MacroPackageEntry> = {
  plus: {
    name: 'plus',
    description: 'infix +',
    source: { entries: [], urls: [] },
    dynamic_arity: false,
    styles: [
      { tag: 'default', mode: 'formula_inline', template: '#0 + #1' },
    ],
  },
  union: {
    name: 'union',
    description: 'set union',
    source: { entries: [], urls: [] },
    dynamic_arity: false,
    styles: [
      { tag: 'default', mode: 'formula_inline', template: '#0 \\cup #1' },
    ],
  },
  frac: {
    name: 'frac',
    description: 'fraction',
    source: { entries: [], urls: [] },
    dynamic_arity: false,
    styles: [
      { tag: 'default', mode: 'formula_inline', template: '\\frac{#0}{#1}' },
    ],
  },
  leq: {
    name: 'leq',
    description: 'less or equal',
    source: { entries: [], urls: [] },
    dynamic_arity: false,
    styles: [
      { tag: 'default', mode: 'formula_inline', template: '#0 \\leq #1' },
    ],
  },
  norm: {
    name: 'norm',
    description: 'norm',
    source: { entries: [], urls: [] },
    dynamic_arity: false,
    styles: [
      { tag: 'default', mode: 'formula_inline', template: '\\lVert #0 \\rVert' },
    ],
  },
};

describe('renderTreeAsLatex', () => {
  test('pure composition — template mirrors directly to LaTeX', () => {
    // Cat's example: `#0 + #1` template should synth to `a + b`.
    const r = synthLatex('plus(a, b)', macros);
    assert.equal(r.output, 'a + b');
    assert.deepEqual(r.notes, []);
  });

  test('nested composition threads children through recursively', () => {
    const r = synthLatex('leq(plus(a, b), norm(x))', macros);
    assert.equal(r.output, 'a + b \\leq \\lVert x \\rVert');
  });

  test('unregistered macro survives as name(...) with a note', () => {
    const r = synthLatex('mystery(a, b)', macros);
    assert.equal(r.output, 'mystery(a, b)');
    assert.equal(r.notes.length, 1);
    assert.match(r.notes[0], /Unregistered macro 'mystery'/);
  });

  test('formula leaves survive as $...$', () => {
    const r = synthLatex('plus($x^2$, b)', macros);
    assert.equal(r.output, '$x^2$ + b');
  });

  test('text leaves survive verbatim', () => {
    const r = synthLatex('plus(%hello%, b)', macros);
    assert.equal(r.output, 'hello + b');
  });
});

describe('renderTreeAsText', () => {
  test("\\cup maps to ∪ (cat's exact example)", () => {
    const r = synthText('union(A, B)', macros);
    assert.equal(r.output, 'A ∪ B');
  });

  test('unicode chars survive nested composition', () => {
    // (a + b) ≤ ‖x‖
    const r = synthText('leq(plus(a, b), norm(x))', macros);
    assert.equal(r.output, 'a + b ≤ ‖ x ‖');
  });

  test('\\frac{a}{b} becomes (a)/(b)', () => {
    const r = synthText('frac(a, b)', macros);
    assert.equal(r.output, '(a)/(b)');
  });

  test('formula leaves get LaTeX→text conversion', () => {
    const r = synthText('plus($\\alpha \\leq \\beta$, b)', macros);
    // $α ≤ β$ + b
    assert.equal(r.output, '$α ≤ β$ + b');
  });

  test('unknown LaTeX commands survive and get noted', () => {
    const withWeird: Record<string, MacroPackageEntry> = {
      ...macros,
      weird: {
        name: 'weird',
        description: 'unmapped',
        source: { entries: [], urls: [] },
        dynamic_arity: false,
        styles: [
          { tag: 'default', mode: 'formula_inline', template: '#0 \\weirdop #1' },
        ],
      },
    };
    const r = synthText('weird(a, b)', withWeird);
    // Command survives; note logged so agent sees the miss.
    assert.match(r.output, /\\weirdop/);
    assert.ok(
      r.notes.some((n) => /\\weirdop/.test(n)),
      'expected note about unmapped command',
    );
  });
});
