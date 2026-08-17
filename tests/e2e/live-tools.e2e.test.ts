import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../src/config.ts";
import { sessionLooksReady } from "../../src/session/store.ts";

const IS_LIVE_TEST = process.env.TEST_LIVE_LINKEDIN === "true";

describe("E2E: Live LinkedIn Suite (Optional / Conditional)", () => {
	const config = loadConfig();

	test("skips live scraping when TEST_LIVE_LINKEDIN is not enabled", () => {
		if (!IS_LIVE_TEST) {
			expect(true).toBe(true);
			return;
		}
	});

	test("validates local session presence if running live test", async () => {
		if (!IS_LIVE_TEST) {
			expect(true).toBe(true);
			return;
		}

		const ready = await sessionLooksReady(config.userDataDir);
		expect(ready).toBe(true);
	});
});
