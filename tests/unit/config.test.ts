import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../src/config.ts";

describe("Unit: config", () => {
	test("defaults transport to stdio when forced explicitly", () => {
		const cfg = loadConfig(["--transport", "stdio"]);
		expect(cfg.transport).toBe("stdio");
		expect(cfg.port).toBeGreaterThan(0);
		expect(cfg.userDataDir.length).toBeGreaterThan(0);
	});

	test("sets transport to streamable-http when specified", () => {
		const cfg = loadConfig(["--transport", "streamable-http", "--port", "9090"]);
		expect(cfg.transport).toBe("streamable-http");
		expect(cfg.port).toBe(9090);
	});

	test("parses login, logout, and status modes correctly", () => {
		expect(loadConfig(["--login"]).mode).toBe("login");
		expect(loadConfig(["--logout"]).mode).toBe("logout");
		expect(loadConfig(["--status"]).mode).toBe("status");
	});

	test("parses custom user-data-dir and viewport", () => {
		const cfg = loadConfig(["--user-data-dir", "/tmp/custom-profile", "--viewport", "1920x1080", "--no-headless"]);
		expect(cfg.userDataDir).toBe("/tmp/custom-profile");
		expect(cfg.viewport).toEqual({ width: 1920, height: 1080 });
		expect(cfg.headless).toBe(false);
	});

	test("clamps login-inline-wait to bounds [0, 45]", () => {
		expect(loadConfig(["--login-inline-wait", "100"]).loginInlineWait).toBe(45);
		expect(loadConfig(["--login-inline-wait", "-5"]).loginInlineWait).toBe(0);
		expect(loadConfig(["--login-inline-wait", "30"]).loginInlineWait).toBe(30);
	});
});
