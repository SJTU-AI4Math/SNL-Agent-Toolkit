/**
 * Smoke tests for lintEntry. Runs under `node --test CLI_Scripts/`.
 *
 * These fixtures are inline so the test doesn't depend on any on-disk
 * .SNL_Doc/ layout. Keep them small — each named case pins down one
 * lint code so a regression yells with a specific name.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintEntry } from '../lib/lint-entry.ts';
import type {
  EntryData,
  EntryKind,
  MacroPackageEntry,
} from '../lib/snl-doc-schema.ts';

const ENTRY_KINDS: EntryKind[] = [
  {
    id: 'theorem',
    name: 'Theorem',
    coloring: { stroke: '#4a6a8a', background: '#e6efff' },
    numbering: '1',
    style: 'block',
  },
];

const MACROS: Record<string, MacroPackageEntry> = {
  R: {
    name: 'R',
    description: 'Real numbers',
    source: { entries: [], urls: [] },
    dynamic_arity: false,
    default_style: { en: 'default' },
    tags: [],
    styles: [{ style_name: 'default', mode: 'formula_inline', template: '\\mathbb{R}', tags: [] }],
  },
};

const SIBLINGS: EntryData[] = [
  {
    id: 'existing',
    kind: 'theorem',
    title: 'existing',
    content: { snl: '' },
    contribution_info: null,
    pointer: null,
  },
];

function baseCtx(overrides = {}) {
  return {
    entryKinds: ENTRY_KINDS,
    macros: MACROS,
    siblingEntries: SIBLINGS,
    ...overrides,
  };
}

function codes(report: ReturnType<typeof lintEntry>): string[] {
  return report.issues.map((i) => i.code).sort();
}

describe('lintEntry', () => {
  it('accepts a well-formed entry with known kind and known macro', () => {
    const r = lintEntry(
      {
        id: 'new-entry',
        kind: 'theorem',
        title: 'A theorem',
        content: { snl: 'R' },
        contribution_info: null,
        pointer: null,
      },
      baseCtx(),
    );
    assert.deepEqual(r.issues, []);
  });

  it('accepts empty SNL content (empty entries are allowed)', () => {
    const r = lintEntry(
      {
        id: 'stub',
        kind: 'theorem',
        title: '',
        content: {},
        contribution_info: null,
        pointer: null,
      },
      baseCtx(),
    );
    assert.deepEqual(r.issues, []);
  });

  it('errors on missing id / kind / title / contribution_info / pointer', () => {
    const r = lintEntry({ content: {} }, baseCtx());
    const found = codes(r);
    assert.ok(found.includes('entry.missing-id'));
    assert.ok(found.includes('entry.missing-kind'));
    assert.ok(found.includes('entry.missing-title'));
    assert.ok(found.includes('entry.missing-contribution-info'));
    assert.ok(found.includes('entry.missing-pointer'));
  });

  it('errors on duplicate id', () => {
    const r = lintEntry(
      {
        id: 'existing',
        kind: 'theorem',
        title: 'dup',
        content: {},
        contribution_info: null,
        pointer: null,
      },
      baseCtx(),
    );
    assert.ok(codes(r).includes('entry.duplicate-id'));
  });

  it('errors on unknown entry kind', () => {
    const r = lintEntry(
      {
        id: 'x',
        kind: 'made-up-kind',
        title: '',
        content: {},
        contribution_info: null,
        pointer: null,
      },
      baseCtx(),
    );
    assert.ok(codes(r).includes('entry.unknown-kind'));
  });

  it('errors on SNL parse failure', () => {
    const r = lintEntry(
      {
        id: 'x',
        kind: 'theorem',
        title: '',
        content: { snl: 'foo(bar' },
        contribution_info: null,
        pointer: null,
      },
      baseCtx(),
    );
    assert.ok(codes(r).includes('snl.parse'));
  });

  it('reports unresolved identifier as info by default (fvar/bvar fallback is OK)', () => {
    const r = lintEntry(
      {
        id: 'x',
        kind: 'theorem',
        title: '',
        content: { snl: 'UnknownIdentifier' },
        contribution_info: null,
        pointer: null,
      },
      baseCtx(),
    );
    const issue = r.issues.find((i) => i.code === 'snl.identifier-not-in-pool');
    assert.ok(issue, 'expected snl.identifier-not-in-pool issue');
    assert.equal(issue!.severity, 'info');
  });

  it('promotes unresolved identifier to error with --strict-macros', () => {
    const r = lintEntry(
      {
        id: 'x',
        kind: 'theorem',
        title: '',
        content: { snl: 'UnknownIdentifier' },
        contribution_info: null,
        pointer: null,
      },
      baseCtx({ strictMacros: true }),
    );
    const issue = r.issues.find((i) => i.code === 'snl.identifier-not-in-pool');
    assert.ok(issue, 'expected snl.identifier-not-in-pool issue');
    assert.equal(issue!.severity, 'error');
  });

  it('does not treat Tree3 backtick temporary payload as a Macro identifier', () => {
    const r = lintEntry({ id: 'x', kind: 'theorem', title: '', content: { snl: '`opaque_name`' }, contribution_info: null, pointer: null }, baseCtx({ strictMacros: true }));
    assert.ok(!codes(r).includes('snl.identifier-not-in-pool'));
  });

  it('does not accept Object.prototype names as registered Macros', () => {
    const r = lintEntry({ id: 'x', kind: 'theorem', title: '', content: { snl: 'constructor' }, contribution_info: null, pointer: null }, baseCtx());
    assert.ok(codes(r).includes('snl.identifier-not-in-pool'));
  });

  it('rejects non-object payloads', () => {
    const r = lintEntry([1, 2, 3], baseCtx());
    assert.deepEqual(codes(r), ['entry.not-object']);
  });

  describe('L4 src.dangling (cat 2026-07-09)', () => {
    it('reports dangling `x@foo` src as info (never fails)', () => {
      const r = lintEntry(
        {
          id: 'entry-a',
          kind: 'theorem',
          title: '',
          content: { snl: 'x@nonexistent-entry' },
          contribution_info: null,
          pointer: null,
        },
        baseCtx({ siblingEntries: [] }),
      );
      const issue = r.issues.find((i) => i.code === 'snl.src-dangling');
      assert.ok(issue, 'expected snl.src-dangling issue');
      assert.equal(issue!.severity, 'info');
      assert.match(issue!.message, /nonexistent-entry/);
    });

    it('does NOT flag a src that resolves to a sibling entry', () => {
      const siblings = [
        {
          id: 'context-linalg-vars',
          kind: 'context',
          title: '',
          content: { snl: 'root(@x)' },
          contribution_info: null,
          pointer: null,
        } as any,
      ];
      const r = lintEntry(
        {
          id: 'thm-a',
          kind: 'theorem',
          title: '',
          content: { snl: 'x@context-linalg-vars' },
          contribution_info: null,
          pointer: null,
        },
        baseCtx({ siblingEntries: siblings }),
      );
      const issue = r.issues.find((i) => i.code === 'snl.src-dangling');
      assert.equal(issue, undefined, 'sibling src should resolve');
      assert.equal(r.issues.find((i) => i.code === 'snl.src-no-declaration'), undefined);
    });

    it('reports an existing source Entry that does not export the requested binder', () => {
      const siblings = [{ id: 'ctx', kind: 'context', title: '', content: { snl: 'root(@y)' }, contribution_info: null, pointer: null }] as any;
      const r = lintEntry({ id: 'thm', kind: 'theorem', title: '', content: { snl: 'x@ctx' }, contribution_info: null, pointer: null }, baseCtx({ siblingEntries: siblings }));
      assert.ok(codes(r).includes('snl.src-no-declaration'));
    });

    it('allows a src pointing at the entry itself (self-ref)', () => {
      const r = lintEntry(
        {
          id: 'self',
          kind: 'context',
          title: '',
          content: { snl: 'x@self' },
          contribution_info: null,
          pointer: null,
        },
        baseCtx({ siblingEntries: [] }),
      );
      const issue = r.issues.find((i) => i.code === 'snl.src-dangling');
      assert.equal(issue, undefined, 'self-src should resolve');
    });

    it('does NOT flag the src-postfix target as an unresolved macro (cat 2026-07-10)', () => {
      // Regression: `x@srcEntry` used to report `srcEntry` as an
      // unresolved identifier via the L3 macro-pool scan. srcEntry is
      // an entry id, not a macro ref — L4 owns it.
      const siblings = [
        {
          id: 'ctx-alpha',
          kind: 'context',
          title: '',
          content: { snl: '' },
          contribution_info: null,
          pointer: null,
        } as any,
      ];
      const r = lintEntry(
        {
          id: 'thm-b',
          kind: 'theorem',
          title: '',
          content: { snl: 'x@ctx-alpha' },
          contribution_info: null,
          pointer: null,
        },
        baseCtx({ siblingEntries: siblings }),
      );
      const macroIssues = r.issues.filter(
        (i) => i.code === 'snl.identifier-not-in-pool',
      );
      // `x` is still valid to report (it's an unresolved bare
      // identifier — reader/agent decides bvar vs typo); `ctx-alpha`
      // must NOT appear.
      const flaggedNames = macroIssues.map((i) => {
        const m = /'([^']+)'/.exec(i.message);
        return m ? m[1] : '';
      });
      assert.ok(
        !flaggedNames.includes('ctx-alpha'),
        `src-postfix target must not be flagged as unresolved macro; got ${flaggedNames.join(', ')}`,
      );
    });
  });
});
