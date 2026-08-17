import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type CookieRecord,
	clearSession,
	cookiesPath,
	cookiesToHeader,
	ensureSessionDirs,
	readCookies,
	readSourceState,
	type SourceState,
	sessionLooksReady,
	sourceStatePath,
	webViewProfilePath,
	writeCookies,
	writeSourceState,
} from "../../src/session/store.ts";

describe("Unit: session-store", () => {
	let tempDir: string;
	let userDataDir: string;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "linkedin-mcp-test-session-"));
		userDataDir = join(tempDir, "profile");
	});

	afterAll(async () => {
		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {
			// ignore cleanup error
		}
	});

	test("generates expected file and profile paths", () => {
		expect(cookiesPath(userDataDir)).toContain("cookies.json");
		expect(sourceStatePath(userDataDir)).toContain("source-state.json");
		expect(webViewProfilePath(userDataDir)).toContain("bun-webview");
	});

	test("ensures session directories exist", async () => {
		await ensureSessionDirs(userDataDir);
		const stat = await Bun.file(cookiesPath(userDataDir)).exists();
		expect(stat).toBe(false);
	});

	test("writes and reads cookies correctly", async () => {
		const cookies: CookieRecord[] = [
			{
				name: "li_at",
				value: "session_secret_token_val",
				domain: ".linkedin.com",
				path: "/",
				httpOnly: true,
				secure: true,
			},
			{
				name: "JSESSIONID",
				value: "ajax_session_val",
				domain: ".linkedin.com",
				path: "/",
			},
		];

		await writeCookies(userDataDir, cookies);
		const loaded = await readCookies(userDataDir);
		expect(loaded).toEqual(cookies);
	});

	test("writes and reads source state", async () => {
		const state: SourceState = {
			runtime_id: "test-runtime-1",
			login_generation: 1,
			updated_at: new Date().toISOString(),
			backend: "bun-webview-chrome",
		};

		await writeSourceState(userDataDir, state);
		const loaded = await readSourceState(userDataDir);
		expect(loaded).toEqual(state);
	});

	test("sessionLooksReady returns true when required session cookies and state are present", async () => {
		await writeCookies(userDataDir, [{ name: "li_at", value: "valid_session_token", domain: ".linkedin.com", path: "/" }]);
		await writeSourceState(userDataDir, {
			runtime_id: "test-runtime-ready",
			login_generation: 1,
			updated_at: new Date().toISOString(),
			backend: "bun-webview-chrome",
		});

		const isReady = await sessionLooksReady(userDataDir);
		expect(isReady).toBe(true);
	});

	test("cookiesToHeader formats cookie list into HTTP header string", () => {
		const cookies: CookieRecord[] = [
			{ name: "li_at", value: "abc", domain: ".linkedin.com", path: "/" },
			{ name: "lang", value: "en", domain: ".linkedin.com", path: "/" },
		];
		const header = cookiesToHeader(cookies);
		expect(header).toContain("li_at=abc");
		expect(header).toContain("lang=en");
	});

	test("clearSession removes cookies and state files", async () => {
		await clearSession(userDataDir);
		expect(await readCookies(userDataDir)).toBeNull();
		expect(await readSourceState(userDataDir)).toBeNull();
		expect(await sessionLooksReady(userDataDir)).toBe(false);
	});
});
