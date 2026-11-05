import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserManager } from "../../src/browser/manager.ts";
import { loadConfig } from "../../src/config.ts";
import { createMcpServer } from "../../src/mcp/create-server.ts";
import { writeCookies, writeSourceState } from "../../src/session/store.ts";
import type { ToolContentResult } from "../../src/tools/helpers.ts";

describe("E2E: Hermetic New Tools", () => {
	let tempDir: string;
	let userDataDir: string;
	let origEvaluate: typeof browserManager.evaluate;
	let origNavigate: typeof browserManager.navigate;
	let origGetCurrentUrl: typeof browserManager.getCurrentUrl;
	let origEnsureReady: typeof browserManager.ensureReady;
	let origExportCookies: typeof browserManager.exportCookies;
	let origWaitForSelector: typeof browserManager.waitForSelector;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "linkedin-mcp-e2e-new-"));
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
			{ name: "JSESSIONID", value: "ajax_session_val", domain: ".linkedin.com", path: "/" },
		]);
		await writeSourceState(userDataDir, {
			runtime_id: "test-runtime-e2e",
			login_generation: 1,
			updated_at: new Date().toISOString(),
			backend: "bun-webview-chrome",
		});

		origEvaluate = browserManager.evaluate;
		origNavigate = browserManager.navigate;
		origGetCurrentUrl = browserManager.getCurrentUrl;
		origEnsureReady = browserManager.ensureReady;
		origExportCookies = browserManager.exportCookies;
		origWaitForSelector = browserManager.waitForSelector;

		browserManager.ensureReady = async () => {};
		browserManager.navigate = async () => {};
		browserManager.getCurrentUrl = async () => "https://www.linkedin.com/messaging/thread/abc123/";
		browserManager.exportCookies = async () => [
			{ name: "li_at", value: "mock_session_secret_token_12345", domain: ".linkedin.com", path: "/" },
		];
		browserManager.waitForSelector = async () => true;
		browserManager.evaluate = async (script: unknown, ..._args: unknown[]) => {
			if (typeof script === "function") {
				return { text: "Jane Doe", references: [] } as never;
			}
			const s = String(script);
			if (s.includes("global-nav")) return true as never;
			if (s.includes("window.location.href")) return "https://www.linkedin.com/messaging/thread/abc123/" as never;
			return true as never;
		};
	});

	afterAll(async () => {
		browserManager.evaluate = origEvaluate;
		browserManager.navigate = origNavigate;
		browserManager.getCurrentUrl = origGetCurrentUrl;
		browserManager.ensureReady = origEnsureReady;
		browserManager.exportCookies = origExportCookies;
		browserManager.waitForSelector = origWaitForSelector;
		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {}
	});

	const config = () => loadConfig(["--transport", "stdio", "--user-data-dir", userDataDir, "--login-inline-wait", "0"]);

	async function invoke(name: string, args: Record<string, unknown>) {
		const server = createMcpServer(config());
		const registered = (
			server as unknown as {
				_registeredTools: Record<string, { handler: (a: Record<string, unknown>) => Promise<ToolContentResult> }>;
			}
		)._registeredTools;
		const tool = registered[name];
		expect(tool).toBeDefined();
		if (!tool) throw new Error(`${name} not registered`);
		return tool.handler(args);
	}

	test("archive_conversation", async () => {
		const result = await invoke("archive_conversation", { thread_id: "abc123" });
		expect(result.content).toHaveLength(1);
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.thread_id).toBe("abc123");
		expect(["archived", "already_archived"]).toContain(parsed.status);
	});

	test("reply_to_conversation dry run", async () => {
		browserManager.getCurrentUrl = async () => "https://www.linkedin.com/messaging/thread/abc123/";
		const result = await invoke("reply_to_conversation", { thread_id: "abc123", message: "hi", confirm_send: false });
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.status).toBe("confirmation_required");
		expect(parsed.retry_safe).toBe(true);
	});

	test("dismiss_job", async () => {
		browserManager.getCurrentUrl = async () => "https://www.linkedin.com/jobs/view/123/";
		const result = await invoke("dismiss_job", { job_id: "123" });
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.dismissed).toBe(true);
		expect(parsed.job_id).toBe("123");
	});

	test("get_job_apply_url", async () => {
		browserManager.getCurrentUrl = async () => "https://www.linkedin.com/jobs/view/123/";
		const result = await invoke("get_job_apply_url", { job_id: "123" });
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.apply).toBeDefined();
		expect(parsed.apply.type).toBeDefined();
	});

	test("get_easy_apply_form", async () => {
		browserManager.getCurrentUrl = async () => "https://www.linkedin.com/jobs/view/123/";
		const result = await invoke("get_easy_apply_form", { job_id: "123" });
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.form).toBeDefined();
		expect(Array.isArray(parsed.form.steps)).toBe(true);
	});

	test("get_session_status", async () => {
		const result = await invoke("get_session_status", {});
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.session).toBeDefined();
		expect(parsed.scope).toBe("serving_process");
	});
});
