/**
 * Quick smoke test for entry-preview-katex.
 *
 * Reproduces the visible regression: Type.literal(formula_inline) in
 * an entry's SNL body inserts the child renderer's `\htmlData` wrapper.
 * A template that places `#0` inside `\texttt{...}` makes that metadata
 * invalid in text mode; the fixed template keeps `#0` outside and compiles.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { checkEntryPreview } from '../lib/entry-preview-katex.ts';
import type {
  EntryData,
  MacroPackageEntry,
} from '../lib/snl-doc-schema.ts';

// A tiny macro pool that mirrors the API-doc macros involved in the
// SnlMacroStyle.mode field.
const BROKEN_TYPE_LITERAL_TEMPLATE =
  "\\texttt{\\color{CE9178}'}\\texttt{\\color{CE9178}#0}\\texttt{\\color{CE9178}'}";
const FIXED_TYPE_LITERAL_TEMPLATE =
  "{\\color{CE9178}\\texttt{'}#0\\color{CE9178}\\texttt{'}}";

function makeMacros(literalTemplate: string): Record<string, MacroPackageEntry> {
  return {
    'Type.judge': {
      name: 'Type.judge', description: '', source: { entries: [], urls: [] },
      dynamic_arity: false, tags: [],
      styles: [{ style_name: 'default', tags: [], template: { mode: 'formula_inline', body: '#0\\texttt{: }#1' } }],
    },
    'Type.union': {
      name: 'Type.union', description: '', source: { entries: [], urls: [] },
      dynamic_arity: true, tags: [],
      styles: [{ style_name: 'default', tags: [], template: { mode: 'formula_inline', body: '#*', separator: ' \\cup ' } }],
    },
    'Type.literal': {
      name: 'Type.literal', description: '', source: { entries: [], urls: [] },
      dynamic_arity: false, tags: [],
      styles: [{ style_name: 'default', tags: [], template: { mode: 'formula_inline', body: literalTemplate } }],
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
  it('detects child render metadata inside `\\texttt` when template is broken', async () => {
    const issues = await checkEntryPreview(makeEntry(), {
      macros: makeMacros(BROKEN_TYPE_LITERAL_TEMPLATE),
    });
    const snlIssues = issues.filter((i) => i.path === 'content.snl');
    assert.ok(
      snlIssues.length > 0,
      `expected KaTeX to reject broken Type.literal preview; got 0 issues. All issues: ${JSON.stringify(issues, null, 2)}`,
    );
    assert.match(snlIssues[0].source, /\\texttt.*\\htmlData/);
    assert.ok(snlIssues[0].message.length > 0, 'expected a concrete KaTeX parse error');
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
