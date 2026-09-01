import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const entriesDir = path.join(root, '.SNL_Doc', 'entries');

type Contract = { id: string; markdown: string; request: { protocol: string; command: string; root: string; arguments: Record<string, unknown> } };

async function contracts(): Promise<Map<string, Contract>> {
  const result = new Map<string, Contract>();
  for (const name of await readdir(entriesDir)) {
    if (!name.startsWith('CLI-') || !name.endsWith('.json')) continue;
    const raw = JSON.parse(await readFile(path.join(entriesDir, name), 'utf8'));
    const entry = raw.entry;
    const markdown = entry.content.markdown as string;
    const fences = [...markdown.matchAll(/```json\n([^`]+)\n```/g)];
    assert.equal(fences.length, 1, entry.id);
    const request = JSON.parse(fences[0][1]);
    result.set(entry.id, { id: entry.id, markdown, request });
  }
  return result;
}

function keys(value: Record<string, unknown>): string[] { return Object.keys(value).sort(); }

test('all 88 CLI product contracts declare availability and contain only valid protocol JSON examples', async () => {
  const all = await contracts();
  assert.equal(all.size, 88);
  for (const contract of all.values()) {
    assert.match(contract.markdown, /### Availability\nThis Entry is a normative product contract\./, contract.id);
    assert.doesNotMatch(contract.markdown, /"(?:data|details)":\.\.\./, contract.id);
    const inline = [...contract.markdown.matchAll(/`(\{"protocol":"snl\.result\/v1"[^`]+\})`/g)];
    assert.equal(inline.length, 2, contract.id);
    for (const example of inline) assert.doesNotThrow(() => JSON.parse(example[1]), contract.id);
    assert.equal(contract.request.protocol, 'snl.operation/v1');
    assert.equal(contract.request.command.length > 0, true);
  }
});

test('batch, rename, membership, occurrence, and artifact contracts bind their full authorities', async () => {
  const all = await contracts();
  const get = (id: string) => { const value = all.get(id); assert.ok(value, id); return value; };

  const batchCheck = get('CLI.snl-batch-check');
  assert.deepEqual(keys(batchCheck.request.arguments), ['operations']);
  assert.match(batchCheck.markdown, /checkedDigest.*expectedWorkspaceRevision/s);
  const batchApply = get('CLI.snl-batch-apply');
  assert.deepEqual(keys(batchApply.request.arguments), ['checkedDigest', 'expectedWorkspaceRevision', 'operations']);
  assert.match(batchApply.markdown, /partial publication is forbidden/);

  assert.deepEqual(keys(get('CLI.snl-library-add--entry').request.arguments), ['beforeOccurrenceId', 'entryId', 'expectedRevision', 'id', 'parentOccurrenceId']);
  assert.deepEqual(keys(get('CLI.snl-library-move--entry').request.arguments), ['beforeOccurrenceId', 'expectedRevision', 'id', 'occurrenceId', 'parentOccurrenceId']);
  assert.deepEqual(keys(get('CLI.snl-library-remove--entry').request.arguments), ['expectedRevision', 'id', 'occurrenceId']);

  for (const id of ['CLI.snl-entry-rename', 'CLI.snl-macro-rename', 'CLI.snl-library-rename']) {
    assert.deepEqual(keys(get(id).request.arguments), ['checkedDigest', 'dryRun', 'expectedRevision', 'expectedWorkspaceRevision', 'id', 'to']);
  }
  assert.deepEqual(keys(get('CLI.snl-entry-package-set').request.arguments), ['expectedDestinationPackageRevision', 'expectedEntryRevision', 'expectedSourcePackageRevision', 'id', 'package']);
  for (const id of ['CLI.snl-macro--package-add--member', 'CLI.snl-macro--package-remove--member']) {
    assert.deepEqual(keys(get(id).request.arguments), ['expectedMemberRevision', 'expectedPackageRevision', 'id', 'member']);
  }
  for (const id of ['CLI.snl-entry--package-export', 'CLI.snl-macro--package-export', 'CLI.snl-library-export', 'CLI.snl-library-html']) {
    const contract = get(id);
    assert.equal(Object.hasOwn(contract.request.arguments, 'output'), false, id);
    assert.match(contract.markdown, /data\.artifact/);
    assert.match(contract.markdown, /`--output -` is rejected/);
  }
});
