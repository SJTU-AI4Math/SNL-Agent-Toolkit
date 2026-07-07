import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintGraph } from '../lib/lint-graph.ts';
import type { EntryData } from '../schema/index.ts';

const POOL: EntryData[] = [
  {
    id: 'e1',
    kind: 'theorem',
    title: 't',
    content: {},
    contribution_info: null,
    pointer: null,
  },
  {
    id: 'e2',
    kind: 'theorem',
    title: 't',
    content: {},
    contribution_info: null,
    pointer: null,
  },
];

function codes(report: ReturnType<typeof lintGraph>): string[] {
  return report.issues.map((i) => i.code).sort();
}

describe('lintGraph', () => {
  it('accepts a well-formed single-parent tree', () => {
    const g = {
      nodes: [
        { id: 'n1', label: 'Entry', props: { entryId: 'e1' } },
        { id: 'n2', label: 'Entry', props: { entryId: 'e2' } },
      ],
      relationships: [{ from: 'n1', to: 'n2', label: 'branch' }],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    assert.deepEqual(r.issues, []);
  });

  it('accepts a placeholder node (entryId unset)', () => {
    const g = {
      nodes: [{ id: 'n1', label: 'Entry', props: {} }],
      relationships: [],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    assert.deepEqual(r.issues, []);
  });

  it('errors when payload is not an object', () => {
    const r = lintGraph([1, 2, 3], { poolEntries: POOL });
    assert.deepEqual(codes(r), ['graph.not-object']);
  });

  it('errors on missing nodes/relationships arrays', () => {
    const r = lintGraph({}, { poolEntries: POOL });
    const c = codes(r);
    assert.ok(c.includes('graph.missing-nodes'));
    assert.ok(c.includes('graph.missing-relationships'));
  });

  it('errors on duplicate node id', () => {
    const g = {
      nodes: [
        { id: 'dup', label: 'Entry', props: {} },
        { id: 'dup', label: 'Entry', props: {} },
      ],
      relationships: [],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    assert.ok(codes(r).includes('graph.node.duplicate-id'));
  });

  it('warns on unknown node label (keeps parsing)', () => {
    const g = {
      nodes: [{ id: 'n1', label: 'Counter', props: {} }],
      relationships: [],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    const issue = r.issues.find((i) => i.code === 'graph.node.unknown-label');
    assert.ok(issue);
    assert.equal(issue!.severity, 'warning');
  });

  it('warns on unknown relationship label', () => {
    const g = {
      nodes: [
        { id: 'n1', label: 'Entry', props: {} },
        { id: 'n2', label: 'Entry', props: {} },
      ],
      relationships: [{ from: 'n1', to: 'n2', label: 'next' }],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    const issue = r.issues.find((i) => i.code === 'graph.rel.unknown-label');
    assert.ok(issue);
    assert.equal(issue!.severity, 'warning');
  });

  it('errors on dangling branch edge (unknown parent)', () => {
    const g = {
      nodes: [{ id: 'n1', label: 'Entry', props: {} }],
      relationships: [{ from: 'ghost', to: 'n1', label: 'branch' }],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    assert.ok(codes(r).includes('graph.rel.dangling-from'));
  });

  it('errors on multi-parent branch (two incoming edges on one node)', () => {
    const g = {
      nodes: [
        { id: 'p1', label: 'Entry', props: {} },
        { id: 'p2', label: 'Entry', props: {} },
        { id: 'c1', label: 'Entry', props: {} },
      ],
      relationships: [
        { from: 'p1', to: 'c1', label: 'branch' },
        { from: 'p2', to: 'c1', label: 'branch' },
      ],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    assert.ok(codes(r).includes('graph.multi-parent'));
  });

  it('errors on branch cycle', () => {
    const g = {
      nodes: [
        { id: 'a', label: 'Entry', props: {} },
        { id: 'b', label: 'Entry', props: {} },
      ],
      relationships: [
        { from: 'a', to: 'b', label: 'branch' },
        { from: 'b', to: 'a', label: 'branch' },
      ],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    // Two nodes with mutual incoming edges also trip multi-parent; that's
    // fine — both are real errors on this graph. We just care that cycle
    // is detected.
    assert.ok(codes(r).includes('graph.cycle'));
  });

  it('errors on entryId not in shared pool', () => {
    const g = {
      nodes: [{ id: 'n1', label: 'Entry', props: { entryId: 'ghost-entry' } }],
      relationships: [],
    };
    const r = lintGraph(g, { poolEntries: POOL });
    assert.ok(codes(r).includes('graph.node.entry-not-in-pool'));
  });
});
