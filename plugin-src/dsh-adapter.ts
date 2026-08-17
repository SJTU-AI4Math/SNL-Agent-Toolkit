import { createToolkitTools, type EntityAdapter } from './toolkit-tools.ts';
import { loadEntityAdapter } from './mcp-server.ts';

export const name = 'snl-agent-toolkit';
export const inject = ['tools'];

interface DshToolRegistry {
  register(tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output: { schema: Record<string, unknown>; render(args: unknown, value: unknown): Array<{ type: 'text'; text: string }> };
    execute(args: unknown): Promise<unknown>;
  }): unknown;
}

export interface DshContext {
  tools: DshToolRegistry;
}

export interface Config {
  adapter?: EntityAdapter;
  adapterModule?: string;
}

/** Mount the shared Toolkit surface in the current DeepSeek Harness profile. */
export async function apply(ctx: DshContext, config: Config = {}): Promise<void> {
  const adapter = config.adapter ?? await loadEntityAdapter(config.adapterModule);
  for (const tool of createToolkitTools(adapter)) {
    ctx.tools.register({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      output: {
        schema: {},
        render(_args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
        },
      },
      execute(args) {
        return tool.execute(args);
      },
    });
  }
}
