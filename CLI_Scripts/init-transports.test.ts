import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMcpDispatcher } from '../plugin-src/mcp-server.ts';
import { createEntityAdapter } from '../plugin-src/entity-adapter.ts';
import { apply as applyDshAdapter } from '../plugin-src/dsh-adapter.ts';

async function snapshot(root: string, prefix = ''): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, item.name);
    if (item.isDirectory()) Object.assign(out, await snapshot(root, relative));
    else out[relative] = (await readFile(path.join(root, relative))).toString('base64');
  }
  return out;
}

for (const transport of ['mcp', 'dsh']) {
  test(`Initialize guide JSON examples execute through the real ${transport} adapter`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), `snl-init-guide-${transport}-`));
    try {
      const guide = await readFile(path.resolve(import.meta.dirname, '../Skills/Initialize/SKILL.md'), 'utf8');
      const examples = [...guide.matchAll(/```json\n([^`]+)\n```/g)].map(match => JSON.parse(match[1]));
      assert.deepEqual(examples.map(example => example.command), ['init', 'validate']);
      const dispatch = createMcpDispatcher(createEntityAdapter());
      const tools: Array<Record<string, any>> = [];
      await applyDshAdapter({ tools: { register(tool: Record<string, any>) { tools.push(tool); } } });
      const execute = tools.find(tool => tool.name === 'snl_execute');
      assert.ok(execute);
      const call = async (input: Record<string, unknown>) => {
        if (transport === 'dsh') return execute.execute(input, { signal: new AbortController().signal });
        const reply = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'snl_execute', arguments: input } });
        assert.ok(reply && !reply.error);
        const result = reply.result as Record<string, any>;
        assert.notEqual(result.isError, true, JSON.stringify(result));
        return result.structuredContent;
      };
      const help = await call({ root, command: 'help', arguments: {} });
      assert.equal(help.ok, true);
      assert.ok(help.data.commands.includes('init'));
      assert.deepEqual(await readdir(root), []);
      for (const example of examples) {
        const result = await call({ ...example, root });
        assert.equal(result.protocol, 'snl.result/v1');
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.data.valid, true);
        assert.equal(result.data.counts['entry-kind'], 3);
        assert.equal(result.data.counts['macro-kind'], 5);
      }
      const before = await snapshot(root);
      const repeated = await call({ ...examples[0], root });
      assert.equal(repeated.ok, false);
      assert.equal(repeated.error.code, 'workspace.already-initialized');
      assert.deepEqual(await snapshot(root), before);
      await assert.rejects(() => call({ ...examples[0], root, protocol: 'snl.operation/v1' }));
      assert.deepEqual(await snapshot(root), before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
