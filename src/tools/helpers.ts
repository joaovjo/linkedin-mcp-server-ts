import type { AppConfig } from "../config.ts";
import { ensureAuthenticated } from "../browser/auth.ts";
import { browserManager } from "../browser/manager.ts";
import { raiseToolError } from "../errors/handler.ts";
import { serializationQueue } from "../middleware/serialization.ts";
import { readCookies } from "../session/store.ts";

export type ToolContentResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

export function toolJson(data: unknown): ToolContentResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}

export function wrapTool(
	config: AppConfig,
	fn: () => Promise<ToolContentResult | Record<string, unknown>>,
): Promise<ToolContentResult> {
	return serializationQueue.execute("tool", async () => {
		try {
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
			const result = await fn();
			if (
				result &&
				typeof result === "object" &&
				"content" in result &&
				Array.isArray((result as ToolContentResult).content)
			) {
				return result as ToolContentResult;
			}
			return toolJson(result);
		} catch (err) {
			return raiseToolError(err);
		}
	});
}
