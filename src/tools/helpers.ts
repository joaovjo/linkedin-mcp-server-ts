import { ensureAuthenticated } from "../browser/auth.ts";
import { browserManager } from "../browser/manager.ts";
import { getBridge } from "../bridge/state.ts";
import type { AppConfig } from "../config.ts";
import { raiseToolError } from "../errors/handler.ts";
import { serializationQueue } from "../middleware/serialization.ts";
import { readCookies } from "../session/store.ts";

/**
 * Standard MCP tool content response envelope.
 *
 * @public
 */
export type ToolContentResult = {
	/** Array of content items returned to the client. */
	content: Array<{ type: "text"; text: string }>;
	/** Optional flag indicating an error occurred during tool execution. */
	isError?: boolean;
};

/**
 * Wraps arbitrary structured data into a formatted JSON text response conforming to {@link ToolContentResult}.
 *
 * @param data - Any serializable object or primitive.
 * @returns Formatted MCP text content result.
 *
 * @public
 */
export function toolJson(data: unknown): ToolContentResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}

/**
 * Higher-order wrapper around MCP tool execution handling browser lifecycle, serialization queue, cookie syncing, and authentication.
 *
 * @remarks
 * Ensures calls do not collide on the browser driver, imports persistent cookies, guarantees authentication,
 * and intercepts exceptions to produce standard MCP error envelopes.
 *
 * @param config - Application configuration.
 * @param fn - The asynchronous tool business logic.
 * @returns The resolved tool execution result.
 *
 * @public
 */
export function wrapTool(
	config: AppConfig,
	fn: () => Promise<ToolContentResult | Record<string, unknown>>,
	options: { bridge?: boolean } = {},
): Promise<ToolContentResult> {
	return serializationQueue.execute("tool", async () => {
		try {
			// The Chrome extension already runs inside the user's authenticated
			// LinkedIn session, so bridge-capable tools must not require the
			// headless browser to log in first.
			const bridge = getBridge();
			if (options.bridge && bridge?.isConnected()) {
				return toToolContent(await fn());
			}

			await browserManager.ensureReady(config);
			const cookies = await readCookies(config.userDataDir);
			if (cookies?.length) {
				try {
					await browserManager.importCookies(cookies);
				} catch {
					// profile dataStore may already hold cookies
				}
			}
			await ensureAuthenticated(config);
			return toToolContent(await fn());
		} catch (err) {
			return raiseToolError(err);
		}
	});
}

function toToolContent(result: ToolContentResult | Record<string, unknown>): ToolContentResult {
	if (result && typeof result === "object" && "content" in result && Array.isArray((result as ToolContentResult).content)) {
		return result as ToolContentResult;
	}
	return toolJson(result);
}
