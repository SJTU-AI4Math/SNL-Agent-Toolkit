import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { readEntries } from '../lib/snl-doc.ts';
import { COMMAND_PATHS } from '../src/cli/operation.ts';

const root = resolve(import.meta.dirname, '..');

test('published Initialize guide is complete and matches its canonical SNL sections', async () => {
  const entries = new Map((await readEntries(root)).map(entry => [entry.id, entry]));
  const sections = [
    ['Skill.Init', '# Initialize'],
    ['Skill.Init.sec.PrimaryInit', '## Primary Initialization'],
    ['Skill.Init.sec.EntryKindInit', '## Entry Kind Initialization'],
    ['Skill.Init.sec.MacroKindInit', '## Macro Kind Initialization'],
  ];
  const expected = sections.map(([id, heading]) => {
    const body = entries.get(id)?.content?.markdown;
    assert.ok(typeof body === 'string' && body.trim(), `${id} must contain authored plain Markdown guidance, not an empty placeholder`);
    return `${heading}\n\n${body.trim()}\n`;
  }).join('\n');
  const actual = await readFile(resolve(root, 'Skills/Initialize/SKILL.md'), 'utf8');
  assert.ok(actual.trim(), 'Initialize guide must not be empty');
  assert.equal(actual, expected, 'Update canonical Entries then run npm run generate:init-skill');
  assert.match(actual, /snl init --root \/absolute\/target --json/);
  assert.match(actual, /snl_execute/);
  assert.match(actual, /workspace\.already-initialized/);
  for (const route of ['AGENT.md', 'Skills/README.md']) {
    assert.match(await readFile(resolve(root, route), 'utf8'), /Initialize\/SKILL\.md/);
  }
});

test('CLI guide pointers name their actual command headings rather than stale line numbers', async () => {
  const lines = (await readFile(resolve(root, 'Skills/CLI Tools/SKILL.md'), 'utf8')).split('\n');
  const commands = (await readEntries(root)).filter(entry => entry.id.startsWith('Skill.CLI.snl-'));
  assert.ok(commands.length > 0);
  for (const entry of commands) {
    assert.equal(typeof entry.title, 'string');
    const command = (entry.title as string).match(/\\texttt\{([^}]+)\}/)?.[1];
    assert.ok(command, entry.id);
    const pointer = entry.pointer as Record<string, unknown> | null;
    assert.ok(pointer && typeof pointer === 'object', entry.id);
    assert.equal(pointer.file, 'Skills/CLI Tools/SKILL.md');
    assert.equal(pointer.mode, 'lines');
    assert.ok(typeof pointer.line === 'number');
    const heading = lines[pointer.line - 1];
    assert.match(heading ?? '', /^#{1,6} /, entry.id);
    assert.equal(heading.replace(/^#{1,6} /, ''), `\`${command}\``, entry.id);
  }
});

test('CLI guide includes every implemented operation without hiding planned contracts', async () => {
  const manual = await readFile(resolve(root, 'Skills/CLI Tools/SKILL.md'), 'utf8');
  const headings = new Set([...manual.matchAll(/^#{1,6} `snl ([^`]+)`$/gm)].map(match => match[1]));
  for (const command of COMMAND_PATHS.filter(command => command !== 'help')) {
    assert.ok(headings.has(command.replaceAll('/', ' ')), `${command} is implemented but absent from the guide`);
  }
  assert.ok(headings.has('batch apply'), 'The normative planned surface must not be deleted to match unfinished code');
});
