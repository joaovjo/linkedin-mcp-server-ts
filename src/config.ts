import { parseArgs } from "node:util";

export interface AppConfig {
	port: number;
	headless: boolean;
	toolTimeout: number;
	loginTimeout: number;
	logLevel: string;
	profileDir: string;
	transport: "stdio" | "streamable-http";
	checkForUpdates: boolean;
}

function env(key: string, fallback: string): string {
	return process.env[key] ?? fallback;
}

export function loadConfig(args?: string[]): AppConfig {
	const parsed = parseArgs({
		args,
		options: {
			port: { type: "string", default: env("PORT", "8000") },
			headless: { type: "string", default: env("HEADLESS", "true") },
			"tool-timeout": { type: "string", default: env("TOOL_TIMEOUT", "180") },
			"login-timeout": {
				type: "string",
				default: env("LOGIN_TIMEOUT", "1800"),
			},
			"log-level": { type: "string", default: env("LOG_LEVEL", "WARNING") },
			"profile-dir": { type: "string", default: env("PROFILE_DIR", "") },
			transport: {
				type: "string",
				default: env("TRANSPORT", "streamable-http"),
			},
			"no-update-check": { type: "boolean", default: false },
		},
		allowPositionals: true,
	});

	const profileDir =
		parsed.values["profile-dir"] ||
		`${process.env.HOME || process.env.USERPROFILE || "~"}/.linkedin-mcp/profile`;

	return {
		port: parseInt(parsed.values.port ?? "8000", 10),
		headless: (parsed.values.headless ?? "true") !== "false",
		toolTimeout: parseInt(parsed.values["tool-timeout"] ?? "180", 10),
		loginTimeout: parseInt(parsed.values["login-timeout"] ?? "1800", 10),
		logLevel: parsed.values["log-level"] ?? "WARNING",
		profileDir,
		transport: (parsed.values.transport ?? "streamable-http") as
			| "stdio"
			| "streamable-http",
		checkForUpdates: !parsed.values["no-update-check"],
	};
}
