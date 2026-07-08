import {
  LinkedInMCPError,
  LinkedInScraperException,
  RateLimitError,
  SessionExpiredError,
  BrowserSetupInProgressError,
  BrowserSetupFailedError,
  ProfileNotFoundError,
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
    return `❌ Session expired. Run \`bun run login\` to re-authenticate.`;
  }
  if (err instanceof BrowserSetupInProgressError) {
    return `⏳ Browser is still starting up. Please retry in a few seconds.`;
  }
  if (err instanceof BrowserSetupFailedError) {
    return `❌ Browser failed to start: ${err.message}. Check your Chromium/WebKit installation.`;
  }
  if (err instanceof RateLimitError) {
    return `⏳ LinkedIn rate limit hit. Wait ~${err.suggestedWaitTime}s before retrying.`;
  }
  if (err instanceof ProfileNotFoundError) {
    return `❌ ${err.message}`;
  }
  if (err instanceof LinkedInMCPError || err instanceof LinkedInScraperException) {
    return `❌ ${err.message}`;
  }
  if (err instanceof Error) {
    return `❌ Unexpected error: ${err.message}`;
  }
  return `❌ Unknown error: ${String(err)}`;
}
