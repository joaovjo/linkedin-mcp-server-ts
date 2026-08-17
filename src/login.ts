// Compatibility entry: prefer `bun run src/index.ts --login`
import { performLogin } from "./browser/auth.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig(["--login", ...Bun.argv.slice(2)]);

console.error("LinkedIn MCP Server - Login Utility");
console.error("===================================");

try {
	await performLogin(config);
	console.error("\n✓ Login complete. Session saved.");
	process.exit(0);
} catch (err) {
	console.error(
		"\n✗ Login failed:",
		err instanceof Error ? err.message : String(err),
	);
	process.exit(1);
}
