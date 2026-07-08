import { performLogin } from "./browser/auth.ts";
import { browserManager } from "./browser/manager.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig();

console.error("LinkedIn MCP Server - Login Utility");
console.error("===================================");

try {
	await browserManager.initialize(config);
	await performLogin(config.profileDir);
	await browserManager.close();
	console.error(
		"\n✓ Login complete. Session saved. You can now run the server.",
	);
	process.exit(0);
} catch (err) {
	console.error(
		"\n✗ Login failed:",
		err instanceof Error ? err.message : String(err),
	);
	process.exit(1);
}
