/**
 * Quick smoke test for entry-preview-katex.
 *
 * Reproduces the visible regression: Type.literal(formula_inline) in
 * an entry's SNL body renders (via the extension's Preview) to a
 * KaTeX source containing `\mathrm{formula\_inline}` inside a
 * `\texttt{...}` (text-mode) wrapper. Under the OLD broken template
 * that would fail KaTeX with "Can't use function '\\mathrm' in text
 * mode". Under the FIXED template it compiles.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { checkEntryPreview } from '../lib/entry-preview-katex.ts';
import type {
  EntryData,
  MacroPackageEntry,
} from '../schema/index.ts';

// A tiny macro pool that mirrors the API-doc macros involved in the
// SnlMacroStyle.mode field.
const BROKEN_TYPE_LITERAL_TEMPLATE =
  "\\texttt{\\color{CE9178}'}\\texttt{\\color{CE9178}#0}\\texttt{\\color{CE9178}'}";
const FIXED_TYPE_LITERAL_TEMPLATE =
  "{\\color{CE9178}\\texttt{'}#0\\color{CE9178}\\texttt{'}}";

function makeMacros(literalTemplate: string): Record<string, MacroPackageEntry> {
  return {
    'Type.judge': {
      name: 'Type.judge',
      description: '',
      source: { entries: [], urls: [] },
      dynamic_arity: false,
      styles: [
        {
          tag: 'default',
          mode: 'formula_inline',
          template: '#0\\texttt{: }#1',
        },
      ],
    },
    'Type.union': {
      name: 'Type.union',
      description: '',
      source: { entries: [], urls: [] },
      dynamic_arity: true,
      styles: [
        {
          tag: 'default',
          mode: 'formula_inline',
          template: '#*',
          variadic_join: ' \\cup ',
        },
      ],
    },
    'Type.literal': {
      name: 'Type.literal',
      description: '',
      source: { entries: [], urls: [] },
      dynamic_arity: false,
      styles: [
        {
          tag: 'default',
          mode: 'formula_inline',
          template: literalTemplate,
        },
      ],
    },
  };
}

function makeEntry(): EntryData {
  return {
    id: 'mac.iface.snl-macro-style.mode',
    kind: 'theorem',
    title: '$\\texttt{mode}$',
    content: {
      snl: 'Type.judge(SnlMacroStyle.mode,Type.union(Type.literal(formula_inline),Type.literal(formula_display),Type.literal(text),Type.literal(block)))',
    },
    contribution_info: null,
    pointer: null,
  };
}

describe('checkEntryPreview: Type.literal Preview regression', () => {
  it('detects `\\mathrm` inside `\\texttt` when template is broken', async () => {
    const issues = await checkEntryPreview(makeEntry(), {
      macros: makeMacros(BROKEN_TYPE_LITERAL_TEMPLATE),
    });
    const snlIssues = issues.filter((i) => i.path === 'content.snl');
    assert.ok(
      snlIssues.length > 0,
      `expected KaTeX to reject broken Type.literal preview; got 0 issues. All issues: ${JSON.stringify(issues, null, 2)}`,
    );
    assert.match(
      snlIssues[0].message,
      /mathrm.*text mode|text mode.*mathrm/i,
      `expected "Can't use function '\\mathrm' in text mode" style error; got: ${snlIssues[0].message}`,
    );
  });

  it('passes with the fixed template', async () => {
    const issues = await checkEntryPreview(makeEntry(), {
      macros: makeMacros(FIXED_TYPE_LITERAL_TEMPLATE),
    });
    assert.deepEqual(
      issues,
      [],
      `expected no preview issues with fixed template; got: ${JSON.stringify(issues, null, 2)}`,
    );
  });

  it('title-only entry with $…$ compiles fine', async () => {
    const entry: EntryData = {
      id: 'x',
      kind: 'theorem',
      title: '$a + b$',
      content: {},
      contribution_info: null,
      pointer: null,
    };
    const issues = await checkEntryPreview(entry, {
      macros: makeMacros(FIXED_TYPE_LITERAL_TEMPLATE),
    });
    assert.deepEqual(issues, []);
  });
});
