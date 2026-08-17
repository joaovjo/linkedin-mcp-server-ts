import {
	AuthenticationInProgressError,
	AuthenticationStartedError,
	BrowserSetupFailedError,
	BrowserSetupInProgressError,
	CredentialsNotFoundError,
	LinkedInMCPError,
	LinkedInScraperException,
	ProfileNotFoundError,
	RateLimitError,
	SessionExpiredError,
} from "./types.ts";

export interface ToolErrorResult {
	content: Array<{ type: "text"; text: string }>;
	isError: boolean;
}

export function raiseToolError(err: unknown): ToolErrorResult {
	const message = formatErrorMessage(err);
	return {
		content: [{ type: "text", text: message }],
		isError: true,
	};
}

function formatErrorMessage(err: unknown): string {
	if (err instanceof SessionExpiredError) {
		return "Session expired. Run with --login to create a new browser profile.";
	}
	if (err instanceof AuthenticationInProgressError || err instanceof AuthenticationStartedError) {
		return err.message;
	}
	if (err instanceof CredentialsNotFoundError) {
		return err.message;
	}
	if (err instanceof BrowserSetupInProgressError) {
		return "Browser is still starting up. Please retry in 1–2 minutes.";
	}
	if (err instanceof BrowserSetupFailedError) {
		return `Browser failed to start: ${err.message}. Ensure Chrome is installed (backend: chrome).`;
	}
	if (err instanceof RateLimitError) {
		return `Rate limit detected. Wait ${err.suggestedWaitTime} seconds before trying again.`;
	}
	if (err instanceof ProfileNotFoundError) {
		return "Profile not found. Check the profile URL is correct.";
	}
	if (err instanceof Error && err.name === "FilterValidationError") {
		return err.message;
	}
	if (err instanceof LinkedInMCPError || err instanceof LinkedInScraperException) {
		return err.message;
	}
	if (err instanceof Error) {
		return `Unexpected error: ${err.message}`;
	}
	return `Unknown error: ${String(err)}`;
}
