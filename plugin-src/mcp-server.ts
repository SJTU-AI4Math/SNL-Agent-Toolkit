import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createToolkitTools, type EntityAdapter } from './toolkit-tools.ts';

const SERVER_VERSION = '0.1.0';
const PROTOCOL_VERSION = '2025-06-18';

type RpcId = string | number | null;
type RpcRequest = { jsonrpc?: unknown; id?: RpcId; method?: unknown; params?: unknown };
type RpcResponse = { jsonrpc: '2.0'; id: RpcId; result?: unknown; error?: { code: number; message: string } };

function rpcError(id: RpcId, code: number, message: string): RpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export function createMcpDispatcher(adapter: EntityAdapter) {
  const tools = createToolkitTools(adapter);
  return async (request: RpcRequest): Promise<RpcResponse | undefined> => {
    if (request.id === undefined) return undefined;
    const id = request.id;
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      return rpcError(id, -32600, 'Invalid JSON-RPC request');
    }
    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'snl-agent-toolkit', version: SERVER_VERSION },
        },
      };
    }
    if (request.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0', id,
        result: { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
      };
    }
    if (request.method === 'tools/call') {
      const params = request.params && typeof request.params === 'object' && !Array.isArray(request.params)
        ? request.params as Record<string, unknown> : {};
      const name = typeof params.name === 'string' ? params.name : '';
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
      try {
        const value = await tool.execute(params.arguments ?? {});
        return {
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
            structuredContent: value,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: message }], isError: true },
        };
      }
    }
    return rpcError(id, -32601, `Method not found: ${request.method}`);
  };
}

function unavailableAdapter(reason: string): EntityAdapter {
  const fail = async (): Promise<never> => {
    throw new Error(`SNL entity adapter unavailable: ${reason}. Set SNL_ENTITY_ADAPTER_MODULE to the compiled adapter module.`);
  };
  return { list: fail, get: fail, apply: fail, validate: fail };
}

export async function loadEntityAdapter(specifier = process.env.SNL_ENTITY_ADAPTER_MODULE): Promise<EntityAdapter> {
  if (!specifier) return unavailableAdapter('no adapter module was configured');
  const url = specifier.startsWith('file:') || specifier.startsWith('data:') || specifier.startsWith('node:')
    ? specifier : pathToFileURL(resolve(specifier)).href;
  const loaded = await import(url) as {
    default?: EntityAdapter | (() => EntityAdapter | Promise<EntityAdapter>);
    createEntityAdapter?: () => EntityAdapter | Promise<EntityAdapter>;
  };
  const candidate = loaded.createEntityAdapter
    ? await loaded.createEntityAdapter()
    : typeof loaded.default === 'function' ? await loaded.default() : loaded.default;
  if (!candidate || !['list', 'get', 'apply', 'validate'].every((name) => typeof candidate[name as keyof EntityAdapter] === 'function')) {
    throw new Error('SNL entity adapter module must export createEntityAdapter() or a default adapter with list/get/apply/validate methods');
  }
  return candidate;
}

export async function runStdioServer(adapter?: EntityAdapter): Promise<void> {
  const dispatch = createMcpDispatcher(adapter ?? await loadEntityAdapter());
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === '') continue;
    let request: RpcRequest;
    try {
      request = JSON.parse(line) as RpcRequest;
    } catch {
      process.stdout.write(`${JSON.stringify(rpcError(null, -32700, 'Parse error'))}\n`);
      continue;
    }
    const response = await dispatch(request);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  runStdioServer().catch((error: unknown) => {
    process.stderr.write(`snl-agent-toolkit MCP: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
