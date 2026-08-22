import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatLibraryEntryTree,
  type CounterNode,
  type LibraryEntryTreeOptions,
} from '../lib/library-entry-tree.ts';
import type { EntryData, EntryKind, LibraryGraph } from '../lib/snl-doc-schema.ts';

const graph: LibraryGraph = {
  nodes: [
    { id: 'root', label: 'Entry', props: { entryId: 'intro', counterId: 'chapter' } },
    // Node declaration order intentionally differs from branch relationship order.
    { id: 'child-b', label: 'Entry', props: { entryId: 'theorem', counterId: 'theorem' } },
    { id: 'child-a', label: 'Entry', props: { entryId: 'definition' } },
    { id: 'root-2', label: 'Entry', props: { entryId: 'appendix', counterId: 'chapter' } },
  ],
  relationships: [
    { from: 'root', to: 'child-a', label: 'branch' },
    { from: 'root', to: 'child-b', label: 'branch' },
  ],
};

const entries: EntryData[] = [
  { id: 'intro', kind: 'section', title: 'Introduction', content: {}, contribution_info: null, pointer: null },
  { id: 'definition', kind: 'definition', title: { type: 'i18n', default_language: 'zh', values: { zh: '群', en: 'Group' } }, content: {}, contribution_info: null, pointer: null },
  { id: 'theorem', kind: 'theorem', title: 'Closure', content: {}, contribution_info: null, pointer: null },
  { id: 'appendix', kind: 'section', title: 'Appendix', content: {}, contribution_info: null, pointer: null },
];

const kinds: EntryKind[] = [
  { id: 'section', name: 'Section', coloring: { stroke: '', background: '' }, defaultCounterName: 'Chapter', style: '' },
  { id: 'definition', name: 'Definition', coloring: { stroke: '', background: '' }, defaultCounterName: 'Definition', style: '' },
  { id: 'theorem', name: 'Theorem', coloring: { stroke: '', background: '' }, defaultCounterName: 'Theorem', style: '' },
];

const counters: CounterNode[] = [{
  id: 'chapter', name: 'Chapter', numbering: '1', children: [
    { id: 'definition', name: 'Definition', numbering: '.1', children: [] },
    { id: 'theorem', name: 'Theorem', numbering: '.A', children: [] },
  ],
}];

test('prints a Library Entry hierarchy as a folder-style multiline tree with resolved counters', () => {
  assert.equal(formatLibraryEntryTree({ graph, entries, kinds, counters }), [
    '├── [Section] 1. Introduction <intro> (counter id: chapter)',
    '│   ├── [Definition] 1.1. 群 <definition> (counter id: definition)',
    '│   └── [Theorem] 1.A. Closure <theorem> (counter id: theorem)',
    '└── [Section] 2. Appendix <appendix> (counter id: chapter)',
  ].join('\n'));
});

test('uses the requested language for localized Entry Kind names and titles', () => {
  assert.equal(formatLibraryEntryTree({
    graph, entries,
    kinds: kinds.map((kind) => kind.id === 'definition'
      ? { ...kind, name: { type: 'i18n', default_language: 'zh', values: { zh: '定义', en: 'Definition' } } }
      : kind),
    counters,
    options: { language: 'en' },
  }).split('\n')[1], '│   ├── [Definition] 1.1. Group <definition> (counter id: definition)');
});

test('independently toggles every optional line component', () => {
  assert.equal(formatLibraryEntryTree({
    graph, entries, kinds, counters,
    options: {
      includeEntryKind: false,
      includeNumber: false,
      includeTitle: false,
      includeEntryId: true,
      includeCounterId: false,
    },
  }), [
    '├── <intro>',
    '│   ├── <definition>',
    '│   └── <theorem>',
    '└── <appendix>',
  ].join('\n'));
});

test('rejects an empty projection instead of printing connector-only lines', () => {
  assert.throws(() => formatLibraryEntryTree({
    graph, entries, kinds, counters,
    options: {
      includeEntryKind: false,
      includeNumber: false,
      includeTitle: false,
      includeEntryId: false,
      includeCounterId: false,
    },
  }), /at least one Library Entry tree field/);
});


test('preserves valid placeholder nodes so their Entry children keep tree structure', () => {
  assert.equal(formatLibraryEntryTree({
    graph: {
      nodes: [
        { id: 'placeholder', label: 'Entry', props: {} },
        { id: 'entry-node', label: 'Entry', props: { entryId: 'intro' } },
      ],
      relationships: [{ from: 'placeholder', to: 'entry-node', label: 'branch' }],
    },
    entries, kinds, counters,
  }), [
    '└── [Placeholder] <placeholder> <none> (counter id: none)',
    '    └── [Section] 1. Introduction <intro> (counter id: chapter)',
  ].join('\n'));
});


test('keeps each Entry on one physical line and does not duplicate terminal number punctuation', () => {
  assert.equal(formatLibraryEntryTree({
    graph: {
      nodes: [{ id: 'only', label: 'Entry', props: { entryId: 'intro', counterId: 'chapter' } }],
      relationships: [],
    },
    entries: entries.map((entry) => entry.id === 'intro' ? { ...entry, title: 'Line 1\nLine 2' } : entry),
    kinds,
    counters: [{ id: 'chapter', name: 'Chapter', numbering: '§I.', children: [] }],
  }), '└── [Section] §I. Line 1 Line 2 <intro> (counter id: chapter)');
});


test('each display field can be disabled independently', () => {
  const one = {
    graph: {
      nodes: [{ id: 'only', label: 'Entry', props: { entryId: 'intro', counterId: 'chapter' } }],
      relationships: [],
    } as LibraryGraph,
    entries, kinds, counters,
  };
  const cases: Array<[keyof Omit<LibraryEntryTreeOptions, 'language'>, string]> = [
    ['includeEntryKind', '└── 1. Introduction <intro> (counter id: chapter)'],
    ['includeNumber', '└── [Section] Introduction <intro> (counter id: chapter)'],
    ['includeTitle', '└── [Section] 1. <intro> (counter id: chapter)'],
    ['includeEntryId', '└── [Section] 1. Introduction (counter id: chapter)'],
    ['includeCounterId', '└── [Section] 1. Introduction <intro>'],
  ];
  for (const [field, expected] of cases) {
    assert.equal(formatLibraryEntryTree({ ...one, options: { [field]: false } }), expected);
  }
});


test('formats a numbering slot correctly after astral Unicode prefixes', () => {
  assert.equal(formatLibraryEntryTree({
    graph: {
      nodes: [{ id: 'only', label: 'Entry', props: { entryId: 'intro', counterId: 'chapter' } }],
      relationships: [],
    },
    entries, kinds,
    counters: [{ id: 'chapter', name: 'Chapter', numbering: '📘1', children: [] }],
  }), '└── [Section] 📘1. Introduction <intro> (counter id: chapter)');
});


test('an explicit occurrence counter overrides the Entry Kind default counter', () => {
  assert.equal(formatLibraryEntryTree({
    graph: {
      nodes: [
        { id: 'chapter-node', label: 'Entry', props: { entryId: 'intro' } },
        { id: 'overridden-node', label: 'Entry', props: { entryId: 'appendix', counterId: 'definition' } },
      ],
      relationships: [{ from: 'chapter-node', to: 'overridden-node', label: 'branch' }],
    },
    entries, kinds, counters,
  }), [
    '└── [Section] 1. Introduction <intro> (counter id: chapter)',
    '    └── [Section] 1.1. Appendix <appendix> (counter id: definition)',
  ].join('\n'));
});


test('an explicitly undefined option retains its documented default', () => {
  const one: LibraryGraph = {
    nodes: [{ id: 'only', label: 'Entry', props: { entryId: 'intro', counterId: 'chapter' } }],
    relationships: [],
  };
  assert.equal(formatLibraryEntryTree({
    graph: one, entries, kinds, counters,
    options: { includeTitle: undefined },
  }), '└── [Section] 1. Introduction <intro> (counter id: chapter)');
});


test('rejects an explicit counterId that does not exist instead of falling back', () => {
  const invalidGraph: LibraryGraph = {
    nodes: [{ id: 'only', label: 'Entry', props: { entryId: 'intro', counterId: 'missing-explicit' } }],
    relationships: [],
  };
  assert.throws(
    () => formatLibraryEntryTree({ graph: invalidGraph, entries, kinds, counters }),
    /explicit counterId .*missing-explicit.* does not exist/,
  );
});

test('rejects duplicate Counter names instead of guessing the first match', () => {
  const ambiguousCounters: CounterNode[] = [
    { id: 'first', name: 'Chapter', numbering: '1', children: [] },
    { id: 'second', name: 'Chapter', numbering: 'A', children: [] },
  ];
  assert.throws(
    () => formatLibraryEntryTree({ graph, entries, kinds, counters: ambiguousCounters }),
    /Duplicate Counter name .*Chapter/,
  );
});
