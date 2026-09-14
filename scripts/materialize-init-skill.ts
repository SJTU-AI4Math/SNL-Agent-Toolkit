import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readEntries } from '../lib/snl-doc.ts';

// Only this projection is owned here; other Skills remain independently authored.
const root = resolve(import.meta.dirname, '..');
const entries = new Map((await readEntries(root)).map(entry => [entry.id, entry]));
const sections = [
  ['Skill.Init', '# Initialize'],
  ['Skill.Init.sec.PrimaryInit', '## Primary Initialization'],
  ['Skill.Init.sec.EntryKindInit', '## Entry Kind Initialization'],
  ['Skill.Init.sec.MacroKindInit', '## Macro Kind Initialization'],
];
const text = sections.map(([id, heading]) => {
  const markdown = entries.get(id)?.content?.markdown;
  assert.ok(typeof markdown === 'string' && markdown.trim(), `Missing plain Markdown in ${id}; complete the canonical guide first.`);
  return `${heading}\n\n${markdown.trim()}\n`;
}).join('\n');
await writeFile(resolve(root, 'Skills/Initialize/SKILL.md'), text);
console.log('Materialized Skills/Initialize/SKILL.md from canonical Initialize Entries.');
