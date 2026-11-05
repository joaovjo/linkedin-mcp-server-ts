import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBridge } from "../../src/bridge/index.ts";
import { setBridge } from "../../src/bridge/state.ts";
import { browserManager } from "../../src/browser/manager.ts";
import { loadConfig } from "../../src/config.ts";
import { createMcpServer } from "../../src/mcp/create-server.ts";
import { writeCookies, writeSourceState } from "../../src/session/store.ts";
import type { ToolContentResult } from "../../src/tools/helpers.ts";

describe("E2E: Bridge Person Profile", () => {
	let tempDir: string;
	let userDataDir: string;
	let origEvaluate: typeof browserManager.evaluate;
	let origNavigate: typeof browserManager.navigate;
	let origGetCurrentUrl: typeof browserManager.getCurrentUrl;
	let origEnsureReady: typeof browserManager.ensureReady;
	let origExportCookies: typeof browserManager.exportCookies;
	let handle: ReturnType<typeof startBridge>;
	let wsClient: WebSocket;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "linkedin-mcp-bridge-e2e-"));
		userDataDir = join(tempDir, "profile");

		await writeCookies(userDataDir, [
			{
				name: "li_at",
				value: "mock_session_secret_token_12345",
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
		]);
		await writeSourceState(userDataDir, {
			runtime_id: "test-runtime-bridge-e2e",
			login_generation: 1,
			updated_at: new Date().toISOString(),
			backend: "bun-webview-chrome",
		});

		origEvaluate = browserManager.evaluate;
		origNavigate = browserManager.navigate;
		origGetCurrentUrl = browserManager.getCurrentUrl;
		origEnsureReady = browserManager.ensureReady;
		origExportCookies = browserManager.exportCookies;

		browserManager.ensureReady = async () => {};
		browserManager.navigate = async () => {};
		browserManager.getCurrentUrl = async () => "https://www.linkedin.com/in/janedoe/";
		browserManager.exportCookies = async () => [
			{
				name: "li_at",
				value: "mock_session_secret_token_12345",
				domain: ".linkedin.com",
				path: "/",
			},
		];
		browserManager.evaluate = async (script: unknown) => {
			if (typeof script === "function") {
				return { text: "mock", references: [] } as never;
			}
			const s = String(script);
			if (s.includes("global-nav")) return true as never;
			if (s.includes("window.location.href")) return "https://www.linkedin.com/in/janedoe/" as never;
			return true as never;
		};

		handle = startBridge({ hostname: "127.0.0.1", port: 0 });
		setBridge(handle);

		const url = `ws://127.0.0.1:${handle.server.port}`;
		wsClient = new WebSocket(url);
		await new Promise<void>((resolve, reject) => {
			wsClient.onopen = () => resolve();
			wsClient.onerror = () => reject(new Error("bridge client failed to connect"));
		});

		wsClient.onmessage = (event) => {
			let msg: { type?: string; target?: string; id?: string } | null = null;
			try {
				msg = JSON.parse(String(event.data));
			} catch {
				msg = null;
			}
			if (msg?.type !== "extract" || msg?.target !== "person" || typeof msg?.id !== "string") return;
			const data = {
				name: "Bridge Person",
				headline: "Bridge Headline",
				location: "Bridge Location",
				about: "Bridge About",
				experience: ["Bridge Exp 1", "Bridge Exp 2"],
				profileUrl: "https://www.linkedin.com/in/bridgeperson/",
				extractedAt: Date.now(),
			};
			wsClient.send(
				JSON.stringify({
					id: msg.id,
					type: "extract_result",
					target: "person",
					ok: true,
					data,
					url: data.profileUrl,
				}),
			);
		};
	});

	afterAll(async () => {
		try {
			wsClient?.close();
		} catch {
			// ignore
		}
		handle?.stop();
		setBridge(null);

		browserManager.evaluate = origEvaluate;
		browserManager.navigate = origNavigate;
		browserManager.getCurrentUrl = origGetCurrentUrl;
		browserManager.ensureReady = origEnsureReady;
		browserManager.exportCookies = origExportCookies;

		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {
			// ignore cleanup error
		}
	});

	test("uses bridge data for get_person_profile when connected", async () => {
		const config = loadConfig(["--transport", "stdio", "--user-data-dir", userDataDir, "--login-inline-wait", "0"]);

		const server = createMcpServer(config);
		const registered = (
			server as unknown as {
				_registeredTools: Record<string, { handler: (args: Record<string, unknown>) => Promise<ToolContentResult> }>;
			}
		)._registeredTools;

		const tool = registered.get_person_profile;
		expect(tool).toBeDefined();
		if (!tool) throw new Error("get_person_profile tool is not registered");
		const result = await tool.handler({
			linkedin_username: "bridgeperson",
		});

		expect(result.isError).toBeUndefined();
		expect(result.content).toHaveLength(1);
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.url).toContain("bridgeperson");
		expect(parsed.sections.profile).toContain("Bridge Person");
		expect(parsed.sections.profile).toContain("Bridge Headline");
		expect(parsed.sections.experience).toContain("Bridge Exp 1");
	});
});
