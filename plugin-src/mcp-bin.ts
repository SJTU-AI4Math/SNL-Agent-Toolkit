import { runStdioServer } from './mcp-server.ts';

runStdioServer().catch((error: unknown) => {
  process.stderr.write(`snl-agent-toolkit MCP: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
