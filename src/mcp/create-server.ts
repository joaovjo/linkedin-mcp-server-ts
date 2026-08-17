import { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.ts";
import { registerCompanyTools } from "../tools/company.ts";
import { registerFeedTools } from "../tools/feed.ts";
import { registerJobTools } from "../tools/job.ts";
import { registerMessagingTools } from "../tools/messaging.ts";
import { registerPersonTools } from "../tools/person.ts";
import { registerPostTools } from "../tools/post.ts";
import { registerSessionTools } from "../tools/session.ts";

/** Canonical MCP server name identifier. */
export const SERVER_NAME = "linkedin-mcp-server-ts";
/** Current semver version string. */
export const SERVER_VERSION = "0.1.0";

/**
 * Creates and initializes a fully configured {@link McpServer} instance with all 19 LinkedIn tools registered.
 *
 * @remarks
 * Registers person profiles, company details, job search, direct messaging, feed posts, and session management tools.
 *
 * @param config - Application configuration defining transport and browser profile paths.
 * @returns An initialized {@link McpServer} ready to handle JSON-RPC requests.
 *
 * @public
 */
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
