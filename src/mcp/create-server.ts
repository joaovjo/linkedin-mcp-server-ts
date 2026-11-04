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
export const SERVER_VERSION = "0.3.0";

/** Server instructions ported from the Python implementation. */
export const _SERVER_INSTRUCTIONS = `send_message and connect_with_person act for the user. Use them only for the
exact action, recipient and text the user approved; when the user asks for a
draft, or for something these tools cannot do, reply with the text instead. If
a write's outcome is unknown, ask the user to check LinkedIn before acting
again.

Report what the tools returned, and say when a result may be incomplete.

If LinkedIn waits for a captcha or other verification, ask the user to
complete it in the browser, then continue when they say so.
`;

export const SERVER_INSTRUCTIONS = _SERVER_INSTRUCTIONS;

/**
 * Creates and initializes a fully configured {@link McpServer} instance with all 25 LinkedIn tools registered.
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
	const server = new McpServer(
		{
			name: SERVER_NAME,
			version: SERVER_VERSION,
		},
		{
			instructions: _SERVER_INSTRUCTIONS,
		},
	);

	registerPersonTools(server, config);
	registerCompanyTools(server, config);
	registerJobTools(server, config);
	registerMessagingTools(server, config);
	registerFeedTools(server, config);
	registerPostTools(server, config);
	registerSessionTools(server, config);

	return server;
}
