import { describe, expect, test } from "bun:test";
import { raiseToolError } from "../../src/errors/handler.ts";
import {
	AuthenticationInProgressError,
	AuthenticationStartedError,
	BrowserSetupFailedError,
	BrowserSetupInProgressError,
	CredentialsNotFoundError,
	ElementNotFoundError,
	LinkedInMCPError,
	NetworkError,
	ProfileNotFoundError,
	RateLimitError,
	ScrapingError,
	SessionExpiredError,
} from "../../src/errors/types.ts";

describe("Unit: error-handler", () => {
	test("formats SessionExpiredError with login guidance", () => {
		const res = raiseToolError(new SessionExpiredError());
		expect(res.isError).toBe(true);
		expect(res.content[0]?.text).toContain("Session expired. Run with --login");
	});

	test("formats AuthenticationInProgressError and AuthenticationStartedError", () => {
		const inProgress = raiseToolError(new AuthenticationInProgressError());
		expect(inProgress.isError).toBe(true);
		expect(inProgress.content[0]?.text).toContain("Authentication in progress");

		const started = raiseToolError(new AuthenticationStartedError());
		expect(started.isError).toBe(true);
		expect(started.content[0]?.text).toContain("Authentication started");
	});

	test("formats CredentialsNotFoundError", () => {
		const res = raiseToolError(new CredentialsNotFoundError());
		expect(res.isError).toBe(true);
		expect(res.content[0]?.text).toContain("No LinkedIn session found");
	});

	test("formats BrowserSetupInProgressError and BrowserSetupFailedError", () => {
		const inProgress = raiseToolError(new BrowserSetupInProgressError());
		expect(inProgress.content[0]?.text).toContain("Browser is still starting up");

		const failed = raiseToolError(new BrowserSetupFailedError("Chrome process exited"));
		expect(failed.content[0]?.text).toContain("Browser failed to start");
		expect(failed.content[0]?.text).toContain("Chrome process exited");
	});

	test("formats RateLimitError with suggested wait time", () => {
		const res = raiseToolError(new RateLimitError(90));
		expect(res.isError).toBe(true);
		expect(res.content[0]?.text).toContain("Wait 90 seconds");
	});

	test("formats ProfileNotFoundError", () => {
		const res = raiseToolError(new ProfileNotFoundError("ghost_user"));
		expect(res.isError).toBe(true);
		expect(res.content[0]?.text).toContain("Profile not found");
	});

	test("formats generic LinkedInMCPError and LinkedInScraperException", () => {
		const mcpErr = raiseToolError(new LinkedInMCPError("Custom MCP failure"));
		expect(mcpErr.content[0]?.text).toBe("Custom MCP failure");

		const scraperErr = raiseToolError(new ScrapingError("skills", "Element missing"));
		expect(scraperErr.content[0]?.text).toContain('Error scraping section "skills"');

		const networkErr = raiseToolError(new NetworkError("Connection refused"));
		expect(networkErr.content[0]?.text).toContain("Network error: Connection refused");

		const elementErr = raiseToolError(new ElementNotFoundError(".nav-btn"));
		expect(elementErr.content[0]?.text).toContain("Element not found: .nav-btn");
	});

	test("formats standard JS Error and string error", () => {
		const jsErr = raiseToolError(new Error("Generic DB crash"));
		expect(jsErr.content[0]?.text).toBe("Unexpected error: Generic DB crash");

		const stringErr = raiseToolError("Just a string error");
		expect(stringErr.content[0]?.text).toBe("Unknown error: Just a string error");
	});
});
