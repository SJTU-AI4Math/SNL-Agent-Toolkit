import {
  defineTool,
  type JsonValue,
  type ParameterPropertySpec,
  type ParameterSchemaSpec,
  type ToolDefinition,
  type ValueSchemaSpec,
} from '@deepseek-ai/dsh-tools';

import { createToolkitTools, type EntityAdapter, type JsonObject } from './toolkit-tools.ts';
import { loadEntityAdapter } from './mcp-server.ts';

export const name = 'snl-agent-toolkit';
export const inject = ['tools'];

interface DshToolRegistry {
  register(tool: ToolDefinition): unknown;
}

export interface DshContext {
  tools: DshToolRegistry;
}

export interface Config {
  adapter?: EntityAdapter;
  adapterModule?: string;
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toDshValueSchema(raw: unknown): ValueSchemaSpec {
  if (!isRecord(raw)) throw new TypeError('tool schema property must be an object');
  const description = typeof raw.description === 'string' ? { description: raw.description } : {};
  const enumeration = Array.isArray(raw.enum) ? { enum: raw.enum as string[] } : {};
  switch (raw.type) {
    case 'string':
      return { type: 'string', ...description, ...enumeration };
    case 'integer':
      return { type: 'integer', ...description };
    case 'number':
      return { type: 'number', ...description };
    case 'boolean':
      return { type: 'boolean', ...description };
    case 'array':
      return {
        type: 'array',
        ...description,
        ...(raw.items !== undefined ? { items: toDshValueSchema(raw.items) } : {}),
      };
    case 'object':
      return { type: 'object', additionalProperties: true, ...description };
    default:
      throw new TypeError(`unsupported DeepSeek Harness tool schema type: ${String(raw.type)}`);
  }
}

function toDshParameters(inputSchema: JsonObject): ParameterSchemaSpec {
  if (inputSchema.type !== 'object' || !isRecord(inputSchema.properties)) {
    throw new TypeError('tool input schema must be an object schema with properties');
  }
  const required = new Set(Array.isArray(inputSchema.required) ? inputSchema.required : []);
  return Object.fromEntries(
    Object.entries(inputSchema.properties).map(([key, schema]) => {
      const property: ParameterPropertySpec = {
        ...toDshValueSchema(schema),
        ...(required.has(key) ? { required: true as const } : {}),
      };
      return [key, property];
    }),
  );
}

/** Mount the shared Toolkit surface in the current DeepSeek Harness profile. */
export async function apply(ctx: DshContext, config: Config = {}): Promise<void> {
  const adapter = config.adapter ?? await loadEntityAdapter(config.adapterModule);
  for (const tool of createToolkitTools(adapter)) {
    ctx.tools.register(defineTool({
      name: tool.name,
      description: tool.description,
      parameters: toDshParameters(tool.inputSchema),
      output: {
        schema: { type: 'json' },
        render(_args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
        },
      },
      async execute(args, exec) {
        exec.signal.throwIfAborted();
        const value = await tool.execute(args);
        exec.signal.throwIfAborted();
        return value as JsonValue;
      },
    }));
  }
}
