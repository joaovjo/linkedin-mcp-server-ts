// -- Server-level errors --
/**
 * Base error class for all server-level exceptions in the LinkedIn MCP server.
 *
 * @public
 */
export class LinkedInMCPError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkedInMCPError";
	}
}

/**
 * Thrown when the stored LinkedIn session has expired and requires re-authentication.
 *
 * @public
 */
export class SessionExpiredError extends LinkedInMCPError {
	constructor() {
		super("LinkedIn session expired. Please re-authenticate.");
		this.name = "SessionExpiredError";
	}
}

/**
 * Thrown when browser initialization is underway but not yet complete.
 *
 * @public
 */
export class BrowserSetupInProgressError extends LinkedInMCPError {
	constructor() {
		super("Browser setup is still in progress. Please try again shortly.");
		this.name = "BrowserSetupInProgressError";
	}
}

/**
 * Thrown when the browser fails to start or establish a DevTools connection.
 *
 * @public
 */
export class BrowserSetupFailedError extends LinkedInMCPError {
	constructor(cause?: string) {
		super(`Browser setup failed. ${cause ?? ""}`);
		this.name = "BrowserSetupFailedError";
	}
}

/**
 * Thrown when no authenticated session cookies or profile directory are found.
 *
 * @public
 */
export class CredentialsNotFoundError extends LinkedInMCPError {
	constructor() {
		super("No LinkedIn session found. Run `bun run login` or `--login` first.");
		this.name = "CredentialsNotFoundError";
	}
}

export class AuthenticationInProgressError extends LinkedInMCPError {
	constructor() {
		super("Authentication in progress. Complete LinkedIn login in the browser, then retry this tool in ~30 seconds.");
		this.name = "AuthenticationInProgressError";
	}
}

export class AuthenticationStartedError extends LinkedInMCPError {
	constructor() {
		super("Authentication started. Complete LinkedIn login in the browser, then retry.");
		this.name = "AuthenticationStartedError";
	}
}

// -- Scraping-level errors --
export class LinkedInScraperException extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkedInScraperException";
	}
}

export class AuthenticationError extends LinkedInScraperException {
	constructor() {
		super("Authentication required. Please log in to LinkedIn.");
		this.name = "AuthenticationError";
	}
}

export class RateLimitError extends LinkedInScraperException {
	public suggestedWaitTime: number;

	constructor(suggestedWaitTime = 60) {
		super(`Rate limited by LinkedIn. Suggested wait: ${suggestedWaitTime}s.`);
		this.name = "RateLimitError";
		this.suggestedWaitTime = suggestedWaitTime;
	}
}

export class ElementNotFoundError extends LinkedInScraperException {
	constructor(selector: string) {
		super(`Element not found: ${selector}`);
		this.name = "ElementNotFoundError";
	}
}

export class ProfileNotFoundError extends LinkedInScraperException {
	constructor(username: string) {
		super(`Profile not found: ${username}`);
		this.name = "ProfileNotFoundError";
	}
}

export class NetworkError extends LinkedInScraperException {
	constructor(cause: string) {
		super(`Network error: ${cause}`);
		this.name = "NetworkError";
	}
}

export class ScrapingError extends LinkedInScraperException {
	constructor(section: string, cause: string) {
		super(`Error scraping section "${section}": ${cause}`);
		this.name = "ScrapingError";
	}
}
