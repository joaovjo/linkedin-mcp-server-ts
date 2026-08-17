import { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.ts";
import { registerCompanyTools } from "../tools/company.ts";
import { registerFeedTools } from "../tools/feed.ts";
import { registerJobTools } from "../tools/job.ts";
import { registerMessagingTools } from "../tools/messaging.ts";
import { registerPersonTools } from "../tools/person.ts";
import { registerPostTools } from "../tools/post.ts";
import { registerSessionTools } from "../tools/session.ts";

export const SERVER_NAME = "mcp-server-linkedin";
export const SERVER_VERSION = "0.1.0";

export function createMcpServer(config: AppConfig): McpServer {
	const server = new McpServer({
		name: SERVER_NAME,
		version: SERVER_VERSION,
	});

	registerPersonTools(server, config);
	registerCompanyTools(server, config);
	registerJobTools(server, config);
	registerMessagingTools(server, config);
	registerFeedTools(server, config);
	registerPostTools(server, config);
	registerSessionTools(server, config);

	return server;
}
