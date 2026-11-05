import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { loadConfig } from "../../src/config.ts";

describe("Unit: config", () => {
	test("defaults transport to stdio when forced explicitly", () => {
		const cfg = loadConfig(["--transport", "stdio"]);
		expect(cfg.transport).toBe("stdio");
		expect(cfg.port).toBeGreaterThan(0);
		// Default is always an absolute path under $HOME.
		expect(isAbsolute(cfg.userDataDir)).toBe(true);
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
		// user-data-dir is resolved to an absolute path (Chrome requires it);
		// on POSIX "/tmp/custom-profile" stays as-is, on Windows it gets the drive prefix.
		expect(cfg.userDataDir).toBe(resolve("/tmp/custom-profile"));
		expect(cfg.viewport).toEqual({ width: 1920, height: 1080 });
		expect(cfg.headless).toBe(false);
	});

	test("expands ~ in --user-data-dir to an absolute home path", () => {
		const cfg = loadConfig(["--user-data-dir", "~/custom-profile"]);
		expect(cfg.userDataDir).toBe(resolve(join(homedir(), "custom-profile")));
	});

	test("clamps login-inline-wait to bounds [0, 45]", () => {
		expect(loadConfig(["--login-inline-wait", "100"]).loginInlineWait).toBe(45);
		expect(loadConfig(["--login-inline-wait", "-5"]).loginInlineWait).toBe(0);
		expect(loadConfig(["--login-inline-wait", "30"]).loginInlineWait).toBe(30);
	});
});
