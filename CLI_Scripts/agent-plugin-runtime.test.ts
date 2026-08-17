import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENTITY_TYPES,
  createToolkitTools,
  type EntityAdapter,
} from '../plugin-src/toolkit-tools.ts';
import { createMcpDispatcher } from '../plugin-src/mcp-server.ts';
import { apply as applyDshAdapter } from '../plugin-src/dsh-adapter.ts';

const root = '/tmp/snl-workspace';

function fixtureAdapter(calls: Array<{ method: string; request: unknown }>): EntityAdapter {
  return {
    async list(request) {
      calls.push({ method: 'list', request });
      return { entities: [{ id: 'group', title: 'Group' }], nextCursor: null };
    },
    async get(request) {
      calls.push({ method: 'get', request });
      return { entity: { id: request.id }, revision: 'rev-1' };
    },
    async apply(request) {
      calls.push({ method: 'apply', request });
      return { status: 'updated', entity: { id: request.id }, revision: 'rev-2' };
    },
    async validate(request) {
      calls.push({ method: 'validate', request });
      return { valid: true, issues: [] };
    },
  };
}

test('generic toolkit surface covers all eight entity types through one adapter contract', async () => {
  assert.deepEqual(ENTITY_TYPES, [
    'entry-kind', 'macro-kind', 'entry-package', 'macro-package',
    'entry', 'macro', 'relationship', 'library',
  ]);
  const calls: Array<{ method: string; request: unknown }> = [];
  const tools = createToolkitTools(fixtureAdapter(calls));
  assert.deepEqual(tools.map((tool) => tool.name), [
    'snl_entities_list', 'snl_entity_get', 'snl_entity_apply', 'snl_workspace_validate',
  ]);

  const listed = await tools[0].execute({ root, entityType: 'entry', query: 'group', limit: 10 });
  assert.deepEqual(listed, { entities: [{ id: 'group', title: 'Group' }], nextCursor: null });
  assert.deepEqual(calls[0], {
    method: 'list', request: { root, entityType: 'entry', query: 'group', limit: 10 },
  });
});

test('tool boundary rejects unsupported entity types before invoking the adapter', async () => {
  const calls: Array<{ method: string; request: unknown }> = [];
  const [list] = createToolkitTools(fixtureAdapter(calls));
  await assert.rejects(
    () => list.execute({ root, entityType: 'unknown' }),
    /entityType must be one of/,
  );
  assert.deepEqual(calls, []);
});

test('MCP dispatcher advertises the generic tools and routes calls to the adapter', async () => {
  const calls: Array<{ method: string; request: unknown }> = [];
  const dispatch = createMcpDispatcher(fixtureAdapter(calls));
  const initialized = await dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.deepEqual(initialized, {
    jsonrpc: '2.0', id: 1,
    result: {
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'snl-agent-toolkit', version: '0.1.0' },
    },
  });

  const listed = await dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal((listed as { result: { tools: unknown[] } }).result.tools.length, 4);

  const called = await dispatch({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'snl_entity_get', arguments: { root, entityType: 'macro', id: 'top' } },
  });
  assert.deepEqual(called, {
    jsonrpc: '2.0', id: 3,
    result: { content: [{ type: 'text', text: JSON.stringify({ entity: { id: 'top' }, revision: 'rev-1' }, null, 2) }], structuredContent: { entity: { id: 'top' }, revision: 'rev-1' } },
  });
});

test('MCP dispatcher returns protocol errors without crashing the stdio server', async () => {
  const dispatch = createMcpDispatcher(fixtureAdapter([]));
  assert.deepEqual(
    await dispatch({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'missing', arguments: {} } }),
    { jsonrpc: '2.0', id: 9, error: { code: -32602, message: 'Unknown tool: missing' } },
  );
});


test('DeepSeek Harness apply(ctx) registers the same four generic tools', async () => {
  const calls: Array<{ method: string; request: unknown }> = [];
  const registered: Array<{ name: string; execute(input: unknown): Promise<unknown> }> = [];
  const ctx = { tools: { register(tool: { name: string; execute(input: unknown): Promise<unknown> }) { registered.push(tool); return () => {}; } } };
  await applyDshAdapter(ctx, { adapter: fixtureAdapter(calls) });
  assert.deepEqual(registered.map((tool) => tool.name), [
    'snl_entities_list', 'snl_entity_get', 'snl_entity_apply', 'snl_workspace_validate',
  ]);
  assert.deepEqual(
    await registered[3].execute({ root }),
    { valid: true, issues: [] },
  );
});
