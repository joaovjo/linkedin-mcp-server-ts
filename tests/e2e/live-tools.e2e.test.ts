import { describe, expect, test } from "bun:test";
import { browserManager } from "../../src/browser/manager.ts";
import { loadConfig } from "../../src/config.ts";
import { createMcpServer } from "../../src/mcp/create-server.ts";
import { sessionLooksReady } from "../../src/session/store.ts";
import type { ToolContentResult } from "../../src/tools/helpers.ts";

const IS_LIVE_TEST = process.env.TEST_LIVE_LINKEDIN === "true";

describe("E2E: Live LinkedIn Suite (Optional / Conditional)", () => {
	const config = loadConfig();

	test("skips live scraping when TEST_LIVE_LINKEDIN is not enabled", () => {
		if (!IS_LIVE_TEST) {
			expect(true).toBe(true);
			return;
		}
	});

	test("initializes browser and invokes read-only live tool if running live test", async () => {
		if (!IS_LIVE_TEST) {
			expect(true).toBe(true);
			return;
		}

		const ready = await sessionLooksReady(config.userDataDir);
		expect(ready).toBe(true);

		await browserManager.ensureReady(config);
		const server = createMcpServer(config);
		const registered = (
			server as unknown as {
				_registeredTools: Record<string, { handler: (args: Record<string, unknown>) => Promise<ToolContentResult> }>;
			}
		)._registeredTools;

		const tool = registered.get_my_profile;
		expect(tool).toBeDefined();
		if (!tool) throw new Error("get_my_profile tool is not registered");
		const res = await tool.handler({});
		expect(res.content).toBeDefined();
		expect(res.content[0]?.text).toBeDefined();
	});
});
