import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ENTITY_TYPES,
  createToolkitTools,
  type EntityAdapter,
} from '../plugin-src/toolkit-tools.ts';
import { createMcpDispatcher, loadEntityAdapter } from '../plugin-src/mcp-server.ts';
import { ToolArgsError } from '@deepseek-ai/dsh-tools';
import { apply as applyDshAdapter } from '../plugin-src/dsh-adapter.ts';
import { createEntityAdapter } from '../plugin-src/entity-adapter.ts';

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
    async renderEntry(request) {
      calls.push({ method: 'renderEntry', request });
      return { entryId: request.id, latex: request.id, notes: [] };
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
    'snl_entities_list', 'snl_entity_get', 'snl_entry_latex', 'snl_entity_apply', 'snl_workspace_validate',
  ]);

  const listed = await tools[0].execute({ root, entityType: 'entry', query: 'group', limit: 10 });
  assert.deepEqual(listed, { entities: [{ id: 'group', title: 'Group' }], nextCursor: null });
  assert.deepEqual(calls[0], {
    method: 'list', request: { root, entityType: 'entry', query: 'group', limit: 10 },
  });
});

test('first-class Entry LaTeX tool renders one Entry through the adapter', async () => {
  const calls: Array<{ method: string; request: unknown }> = [];
  const adapter = {
    ...fixtureAdapter(calls),
    async renderEntry(request: { root: string; id: string }) {
      calls.push({ method: 'renderEntry', request });
      return { entryId: request.id, latex: 'A = 0', notes: [] };
    },
  } as EntityAdapter;
  const tool = createToolkitTools(adapter).find((candidate) => candidate.name === 'snl_entry_latex');
  assert.ok(tool);
  assert.deepEqual(await tool.execute({ root, id: 'target' }), {
    entryId: 'target', latex: 'A = 0', notes: [],
  });
  assert.deepEqual(calls.at(-1), {
    method: 'renderEntry', request: { root, id: 'target' },
  });
});

test('legacy custom adapters still load and keep unrelated tools available', async () => {
  const source = `export default {
    async list() { return {}; }, async get() { return {}; },
    async apply() { return {}; }, async validate() { return {}; }
  };`;
  const adapter = await loadEntityAdapter(`data:text/javascript,${encodeURIComponent(source)}`);
  const tools = createToolkitTools(adapter);
  assert.deepEqual(tools.map((tool) => tool.name), [
    'snl_entities_list', 'snl_entity_get', 'snl_entry_latex', 'snl_entity_apply', 'snl_workspace_validate',
  ]);
  assert.deepEqual(
    await tools[2].execute({ root, id: 'target' }),
    {
      status: 'unsupported', code: 'entry.render-unsupported',
      message: 'This SNL entity adapter does not implement Entry LaTeX rendering.',
    },
  );
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
  assert.equal((listed as { result: { tools: unknown[] } }).result.tools.length, 5);

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


test('DeepSeek Harness apply(ctx) registers the same five generic tools through defineTool', async () => {
  const calls: Array<{ method: string; request: unknown }> = [];
  const registered: Array<Record<string, any>> = [];
  const ctx = { tools: { register(tool: Record<string, any>) { registered.push(tool); return () => {}; } } };
  await applyDshAdapter(ctx, { adapter: fixtureAdapter(calls) });
  assert.deepEqual(registered.map((tool) => tool.name), [
    'snl_entities_list', 'snl_entity_get', 'snl_entry_latex', 'snl_entity_apply', 'snl_workspace_validate',
  ]);
  assert.ok(registered.every((tool) => tool.parameters && tool.output && typeof tool.execute === 'function'));
  assert.ok(registered.every((tool) => tool.inputSchema === undefined && tool.handler === undefined));
  const value = await registered[4].execute(
    { root },
    { signal: new AbortController().signal },
  );
  assert.deepEqual(value, { valid: true, issues: [] });
  await assert.rejects(
    registered[4].execute(
      { root: 42 },
      { signal: new AbortController().signal },
    ),
    ToolArgsError,
  );
});


test('real MCP and DSH paths invoke the first-class Entry renderer', async () => {
  const workspace = new URL('./fixtures/workspace-v0.1.0/', import.meta.url).pathname;
  const adapter = createEntityAdapter();
  const dispatch = createMcpDispatcher(adapter);
  const mcp = await dispatch({
    jsonrpc: '2.0', id: 30, method: 'tools/call',
    params: { name: 'snl_entry_latex', arguments: { root: workspace, id: 'entry.localized' } },
  }) as { result: { structuredContent: unknown; isError?: boolean } };
  assert.equal(mcp.result.isError, undefined);
  assert.deepEqual(mcp.result.structuredContent, {
    entryId: 'entry.localized', latex: '#0 \\to #1', notes: [],
  });

  const registered: Array<Record<string, any>> = [];
  await applyDshAdapter(
    { tools: { register(tool: Record<string, any>) { registered.push(tool); return () => {}; } } },
    { adapter },
  );
  assert.deepEqual(
    await registered[2].execute(
      { root: workspace, id: 'entry.localized' },
      { signal: new AbortController().signal },
    ),
    { entryId: 'entry.localized', latex: '#0 \\to #1', notes: [] },
  );
});

test('built-in Entry renderer returns structured invalid results for malformed Entry content', async () => {
  const source = new URL('./fixtures/workspace-v0.1.0/', import.meta.url).pathname;
  const parent = await mkdtemp(path.join(tmpdir(), 'snl-entry-render-invalid-'));
  const workspace = path.join(parent, 'workspace');
  try {
    await cp(source, workspace, { recursive: true });
    const entries = path.join(workspace, '.SNL_Doc', 'entries');
    const [file] = await readdir(entries);
    const entryPath = path.join(entries, file);
    const envelope = JSON.parse(await readFile(entryPath, 'utf8'));
    envelope.entry.content.snl = '';
    await writeFile(entryPath, `${JSON.stringify(envelope, null, 2)}\n`);
    assert.deepEqual(await createEntityAdapter().renderEntry!({ root: workspace, id: 'entry.localized' }), {
      status: 'invalid', code: 'entry.invalid',
      message: 'Entry entry.localized has no SNL content.',
    });
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('MCP and DSH reject non-block Entry projections that would leak htmlData', async () => {
  const source = new URL('./fixtures/workspace-v0.1.0/', import.meta.url).pathname;
  const parent = await mkdtemp(path.join(tmpdir(), 'snl-entry-render-htmldata-'));
  const workspace = path.join(parent, 'workspace');
  try {
    await cp(source, workspace, { recursive: true });
    const macros = path.join(workspace, '.SNL_Doc', 'macros');
    const [file] = await readdir(macros);
    const macroPath = path.join(macros, file);
    const envelope = JSON.parse(await readFile(macroPath, 'utf8'));
    envelope.macro.styles[0].template.latex.synthesis.macro = '\\htmlData{name=x}{#0 \\to #1}';
    await writeFile(macroPath, `${JSON.stringify(envelope, null, 2)}\n`);
    const adapter = createEntityAdapter();
    const expected = {
      status: 'invalid', code: 'entry.invalid',
      message: 'Entry entry.localized bare LaTeX synthesis produced forbidden \\htmlData.',
    };

    const dispatch = createMcpDispatcher(adapter);
    const mcp = await dispatch({
      jsonrpc: '2.0', id: 31, method: 'tools/call',
      params: { name: 'snl_entry_latex', arguments: { root: workspace, id: 'entry.localized' } },
    }) as { result: { structuredContent: unknown; isError?: boolean } };
    assert.equal(mcp.result.isError, undefined);
    assert.deepEqual(mcp.result.structuredContent, expected);

    const registered: Array<Record<string, any>> = [];
    await applyDshAdapter(
      { tools: { register(tool: Record<string, any>) { registered.push(tool); return () => {}; } } },
      { adapter },
    );
    assert.deepEqual(
      await registered[2].execute(
        { root: workspace, id: 'entry.localized' },
        { signal: new AbortController().signal },
      ),
      expected,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('built-in adapter serves all eight entity families from a v0.1.0 workspace', async () => {
  const adapter = createEntityAdapter();
  const workspace = new URL('./fixtures/workspace-v0.1.0/', import.meta.url).pathname;
  const entryPackages = await adapter.list({ root: workspace, entityType: 'entry-package', limit: 20 }) as { entities: Array<{ id: string }> };
  assert.deepEqual(entryPackages.entities.map(({ id }) => id), ['_unpackaged', 'Logic']);
  const macro = await adapter.get({ root: workspace, entityType: 'macro', id: 'Logic::FOL.implies' }) as { entity: { id: string }; revision: string };
  assert.equal(macro.entity.id, 'Logic::FOL.implies');
  assert.match(macro.revision, /^[0-9a-f]{64}$/);
  const rendered = await adapter.renderEntry!({ root: workspace, id: 'entry.localized' }) as { entryId: string; latex: string; notes: string[] };
  assert.deepEqual(rendered, { entryId: 'entry.localized', latex: '#0 \\to #1', notes: [] });
  assert.deepEqual(await adapter.renderEntry!({ root: workspace, id: 'missing' }), {
    status: 'not-found', code: 'entry.not-found', message: 'Entry not found: missing',
  });
  const validation = await adapter.validate({ root: workspace }) as { valid: boolean; counts: Record<string, number> };
  assert.equal(validation.valid, true);
  assert.deepEqual(Object.keys(validation.counts), ENTITY_TYPES);
});
