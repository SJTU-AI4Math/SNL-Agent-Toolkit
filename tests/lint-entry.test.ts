/**
 * Smoke tests for lintEntry. Runs under `node --test tests/`.
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
} from '../schema/index.ts';

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
    styles: [{ tag: 'default', mode: 'formula_inline', template: '\\mathbb{R}' }],
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

  it('warns on unknown macro reference (default)', () => {
    const r = lintEntry(
      {
        id: 'x',
        kind: 'theorem',
        title: '',
        content: { snl: 'UnknownMacroName' },
        contribution_info: null,
        pointer: null,
      },
      baseCtx(),
    );
    const issue = r.issues.find((i) => i.code === 'snl.unknown-macro');
    assert.ok(issue, 'expected snl.unknown-macro issue');
    assert.equal(issue!.severity, 'warning');
  });

  it('errors on unknown macro reference with --strict-macros', () => {
    const r = lintEntry(
      {
        id: 'x',
        kind: 'theorem',
        title: '',
        content: { snl: 'UnknownMacroName' },
        contribution_info: null,
        pointer: null,
      },
      baseCtx({ strictMacros: true }),
    );
    const issue = r.issues.find((i) => i.code === 'snl.unknown-macro');
    assert.ok(issue, 'expected snl.unknown-macro issue');
    assert.equal(issue!.severity, 'error');
  });

  it('rejects non-object payloads', () => {
    const r = lintEntry([1, 2, 3], baseCtx());
    assert.deepEqual(codes(r), ['entry.not-object']);
  });
});
