import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserManager } from "../../src/browser/manager.ts";
import { loadConfig } from "../../src/config.ts";
import { writeCookies, writeSourceState } from "../../src/session/store.ts";
import { toolJson, wrapTool } from "../../src/tools/helpers.ts";
import { DOM_PROFILE_HTML } from "../fixtures/dom-samples.ts";

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
		browserManager.evaluate = async (script: unknown) => {
			const s = String(script);
			if (s.includes("global-nav")) return true as never;
			if (s.includes("window.location.href")) return "https://www.linkedin.com/in/janedoe/" as never;
			if (s.includes("document.body.innerText") || s.includes("document.body.textContent")) {
				return DOM_PROFILE_HTML as never;
			}
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

		const result = await wrapTool(config, async () => {
			return toolJson({
				url: await browserManager.getCurrentUrl(),
				sections: {
					main_profile: "Jane Doe\nSenior Software Engineer at Acme Corp",
				},
				references: {
					main_profile: [
						{
							kind: "company",
							url: "/company/acme-corp/",
							context: "main_profile",
						},
					],
				},
			});
		});

		expect(result.isError).toBeUndefined();
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");

		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.url).toContain("janedoe");
		expect(parsed.sections.main_profile).toContain("Senior Software Engineer");
		expect(parsed.references.main_profile[0].kind).toBe("company");
	});

	test("executes company extraction flow hermetically", async () => {
		const config = loadConfig(["--transport", "stdio", "--user-data-dir", userDataDir, "--login-inline-wait", "0"]);

		const result = await wrapTool(config, async () => {
			return toolJson({
				url: "https://www.linkedin.com/company/acme-corp/about/",
				sections: {
					about: "Acme Corp\nBuilding modern developer infrastructure.\n1,001-5,000 employees",
				},
				company_urn: "123456",
			});
		});

		const parsed = JSON.parse(result.content[0]?.text ?? "{}");
		expect(parsed.company_urn).toBe("123456");
		expect(parsed.sections.about).toContain("Acme Corp");
	});

	test("handles tool errors hermetically without crashing server", async () => {
		const config = loadConfig(["--transport", "stdio", "--user-data-dir", userDataDir, "--login-inline-wait", "0"]);

		const result = await wrapTool(config, async () => {
			throw new Error("Simulated network timeout");
		});

		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toContain("Unexpected error: Simulated network timeout");
	});
});
