import type { McpServer } from "@modelcontextprotocol/server";
import { existsSync } from "node:fs";
import { z } from "zod";
import { browserManager } from "../browser/manager.ts";
import type { AppConfig } from "../config.ts";
import { raiseToolError } from "../errors/handler.ts";
import { serializationQueue } from "../middleware/serialization.ts";
import { readCookies, readSourceState, sessionLooksReady } from "../session/store.ts";
import { toolJson } from "./helpers.ts";

export function registerSessionTools(server: McpServer, config: AppConfig): void {
	server.registerTool(
		"close_session",
		{
			title: "Close Session",
			description: "Close the current browser session and clean up resources",
			inputSchema: z.object({}),
			annotations: { readOnlyHint: false, destructiveHint: true },
		},
		async () =>
			serializationQueue.execute("tool", async () => {
				try {
					await browserManager.close();
					return toolJson({
						status: "success",
						message: "Successfully closed the browser session and cleaned up resources",
					});
				} catch (err) {
					return raiseToolError(err);
				}
			}),
	);

	server.registerTool(
		"get_session_status",
		{
			title: "Get Session Status",
			description: "Read local session state without opening a browser",
			inputSchema: z.object({}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async () =>
			serializationQueue.execute("tool", async () => {
				try {
					const cookies = await readCookies(config.userDataDir);
					const sourceState = await readSourceState(config.userDataDir);
					const stored = await sessionLooksReady(config.userDataDir);
					return toolJson({
						scope: "serving_process",
						role: "server",
						session: {
							stored,
							profile: existsSync(config.userDataDir),
							cookies: !!(cookies && cookies.length),
						},
						runtime: sourceState?.runtime_id ?? null,
						browser: {
							state: browserManager.getState(),
						},
						source_state: sourceState,
					});
				} catch (err) {
					return raiseToolError(err);
				}
			}),
	);
}
