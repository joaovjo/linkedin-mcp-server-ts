import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserManager } from "../../src/browser/manager.ts";
import { loadConfig } from "../../src/config.ts";
import { createMcpServer } from "../../src/mcp/create-server.ts";
import { writeCookies, writeSourceState } from "../../src/session/store.ts";
import type { ToolContentResult } from "../../src/tools/helpers.ts";

describe("E2E: Hermetic Tools Execution", () => {
	let tempDir: string;
	let userDataDir: string;
	let origEvaluate: typeof browserManager.evaluate;
	let origNavigate: typeof browserManager.navigate;
	let origGetCurrentUrl: typeof browserManager.getCurrentUrl;
	let origEnsureReady: typeof browserManager.ensureReady;
	let origExportCookies: typeof browserManager.exportCookies;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "linkedin-mcp-e2e-"));
		userDataDir = join(tempDir, "profile");

		// Seed valid mock session cookies so ensureAuthenticated passes instantly
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
			runtime_id: "test-runtime-e2e",
			login_generation: 1,
			updated_at: new Date().toISOString(),
			backend: "bun-webview-chrome",
		});

		// Save original methods
		origEvaluate = browserManager.evaluate;
		origNavigate = browserManager.navigate;
		origGetCurrentUrl = browserManager.getCurrentUrl;
		origEnsureReady = browserManager.ensureReady;
		origExportCookies = browserManager.exportCookies;

		// Mock instance methods
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
		browserManager.evaluate = async (script: unknown, ..._args: unknown[]) => {
			if (typeof script === "function") {
				return {
					text: "Jane Doe\nSenior Software Engineer at Acme Corp\nSan Francisco, California\nAbout\nAcme Corp is a leading technology company transforming developer infrastructure.",
					references: [
						{
							href: "https://www.linkedin.com/company/acme-corp/",
							text: "Acme Corp",
							aria_label: "",
							title: "",
							heading: "Experience",
							in_article: false,
							in_nav: false,
							in_footer: false,
						},
					],
				} as never;
			}
			const s = String(script);
			if (s.includes("global-nav")) return true as never;
			if (s.includes("window.location.href")) return "https://www.linkedin.com/in/janedoe/" as never;
			return true as never;
		};
	});

	afterAll(async () => {
		// Restore original methods
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

	test("executes get_person_profile hermetic flow and produces structured envelope", async () => {
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
			linkedin_username: "janedoe",
		});

		expect(result.isError).toBeUndefined();
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");

		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.url).toContain("janedoe");
		expect(parsed.sections.main_profile).toContain("Senior Software Engineer");
		expect(parsed.references.main_profile[0]?.kind).toBe("company");
	});

	test("executes get_company_profile hermetic flow and produces structured envelope", async () => {
		const config = loadConfig(["--transport", "stdio", "--user-data-dir", userDataDir, "--login-inline-wait", "0"]);
		browserManager.getCurrentUrl = async () => "https://www.linkedin.com/company/acme-corp/about/";

		const server = createMcpServer(config);
		const registered = (
			server as unknown as {
				_registeredTools: Record<string, { handler: (args: Record<string, unknown>) => Promise<ToolContentResult> }>;
			}
		)._registeredTools;

		const tool = registered.get_company_profile;
		expect(tool).toBeDefined();
		if (!tool) throw new Error("get_company_profile tool is not registered");
		const result = await tool.handler({
			company_name: "acme-corp",
		});

		expect(result.isError).toBeUndefined();
		expect(result.content).toHaveLength(1);
		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.url).toContain("acme-corp");
		expect(parsed.sections.about).toContain("Acme Corp");
	});

	test("handles tool errors hermetically without crashing server", async () => {
		const config = loadConfig(["--transport", "stdio", "--user-data-dir", userDataDir, "--login-inline-wait", "0"]);

		const origGetUrl = browserManager.getCurrentUrl;
		browserManager.getCurrentUrl = async () => {
			throw new Error("Simulated network timeout");
		};

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
			linkedin_username: "janedoe",
		});

		browserManager.getCurrentUrl = origGetUrl;

		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toContain("Unexpected error: Simulated network timeout");
	});
});
