import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AppConfig } from "./config.ts";
import { browserManager } from "./browser/manager.ts";
import { serializationQueue } from "./middleware/serialization.ts";
import { raiseToolError } from "./errors/handler.ts";
import { loadAllTools, type ToolDef } from "./tools/index.ts";

export async function createServer(config: AppConfig) {
  const tools = loadAllTools();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  const server = new Server(
    { name: "mcp-server-linkedin", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return raiseToolError(new Error(`Unknown tool: ${request.params.name}`));
    }

    return await serializationQueue.execute("tool", async () => {
      try {
        await browserManager.ensureReady(config);
        return await tool.handler(request.params.arguments ?? {});
      } catch (err) {
        return raiseToolError(err);
      }
    });
  });

  await server.connect(transport);

  const handleMcpRequest = async (request: Request): Promise<Response> => {
    return await transport.handleRequest(request);
  };

  const closeAll = async () => {
    try { await transport.close(); } catch {}
    try { await browserManager.close(); } catch {}
  };

  return { handleMcpRequest, closeAll };
}
