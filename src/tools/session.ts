import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.ts";
import { browserManager } from "../browser/manager.ts";
import { raiseToolError } from "../errors/handler.ts";
import { serializationQueue } from "../middleware/serialization.ts";
import { toolJson } from "./helpers.ts";

export function registerSessionTools(
	server: McpServer,
	_config: AppConfig,
): void {
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
						message:
							"Successfully closed the browser session and cleaned up resources",
					});
				} catch (err) {
					return raiseToolError(err);
				}
			}),
	);
}
