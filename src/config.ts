import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

export interface AppConfig {
	host: string;
	port: number;
	httpPath: string;
	headless: boolean;
	toolTimeout: number;
	pageTimeout: number;
	loginTimeout: number;
	loginInlineWait: number;
	logLevel: string;
	profileDir: string;
	userDataDir: string;
	transport: "stdio" | "streamable-http";
	checkForUpdates: boolean;
	autoImportFromBrowser: boolean;
	userAgent?: string;
	chromePath?: string;
	viewport: { width: number; height: number };
	debugPort: number;
	mode: "serve" | "login" | "logout" | "status" | "import";
	importBrowser?: string;
}

function env(key: string, fallback = ""): string {
	return Bun.env[key] ?? process.env[key] ?? fallback;
}

function envBool(key: string, fallback: boolean): boolean {
	const raw = env(key);
	if (!raw) return fallback;
	return !["0", "false", "off", "no"].includes(raw.toLowerCase());
}

function parseViewport(raw: string): { width: number; height: number } {
	const match = /^(\d+)x(\d+)$/.exec(raw.trim());
	if (!match) return { width: 1280, height: 720 };
	return { width: Number(match[1]), height: Number(match[2]) };
}

export function loadConfig(args: string[] = Bun.argv.slice(2)): AppConfig {
	const parsed = parseArgs({
		args,
		options: {
			host: { type: "string", default: env("HOST", "127.0.0.1") },
			port: { type: "string", default: env("PORT", "8000") },
			path: { type: "string", default: env("HTTP_PATH", "/mcp") },
			headless: { type: "string", default: env("HEADLESS", "true") },
			"no-headless": { type: "boolean", default: false },
			"tool-timeout": {
				type: "string",
				default: env("TOOL_TIMEOUT", "180"),
			},
			timeout: { type: "string", default: env("TIMEOUT", "5000") },
			"login-timeout": {
				type: "string",
				default: env("LOGIN_TIMEOUT", "1800"),
			},
			"login-inline-wait": {
				type: "string",
				default: env("LOGIN_INLINE_WAIT", "25"),
			},
			"log-level": { type: "string", default: env("LOG_LEVEL", "WARNING") },
			"user-data-dir": {
				type: "string",
				default: env("USER_DATA_DIR", ""),
			},
			"profile-dir": { type: "string", default: env("PROFILE_DIR", "") },
			transport: {
				type: "string",
				default: env("TRANSPORT", ""),
			},
			"no-update-check": { type: "boolean", default: false },
			"auto-import": { type: "boolean", default: false },
			"no-auto-import": { type: "boolean", default: false },
			"user-agent": { type: "string", default: env("USER_AGENT", "") },
			"chrome-path": { type: "string", default: env("CHROME_PATH", "") },
			viewport: {
				type: "string",
				default: env("VIEWPORT", "1280x720"),
			},
			"debug-port": {
				type: "string",
				default: env("DEBUG_PORT", "9222"),
			},
			login: { type: "boolean", default: false },
			logout: { type: "boolean", default: false },
			status: { type: "boolean", default: false },
			"import-from-browser": { type: "string" },
		},
		allowPositionals: true,
		strict: false,
	});

	const home = homedir();
	const defaultUserData = join(home, ".linkedin-mcp", "profile");
	const userDataDir = String(
		parsed.values["user-data-dir"] ||
			parsed.values["profile-dir"] ||
			defaultUserData,
	);

	let transport = String(parsed.values.transport || "").toLowerCase();
	if (transport !== "stdio" && transport !== "streamable-http") {
		transport = process.stdin.isTTY ? "streamable-http" : "stdio";
	}

	let mode: AppConfig["mode"] = "serve";
	if (parsed.values.logout) mode = "logout";
	else if (parsed.values.login) mode = "login";
	else if (parsed.values.status) mode = "status";
	else if (parsed.values["import-from-browser"] !== undefined) mode = "import";

	const autoImport = parsed.values["no-auto-import"]
		? false
		: parsed.values["auto-import"]
			? true
			: envBool("AUTO_IMPORT_FROM_BROWSER", true);

	const loginInlineWait = Math.min(
		45,
		Math.max(0, Number(parsed.values["login-inline-wait"] ?? 25)),
	);

	return {
		host: String(parsed.values.host ?? "127.0.0.1"),
		port: Number(parsed.values.port ?? 8000),
		httpPath: String(parsed.values.path ?? "/mcp"),
		headless: parsed.values["no-headless"]
			? false
			: String(parsed.values.headless ?? "true") !== "false",
		toolTimeout: Number(parsed.values["tool-timeout"] ?? 180),
		pageTimeout: Number(parsed.values.timeout ?? 5000),
		loginTimeout: Number(parsed.values["login-timeout"] ?? 1800),
		loginInlineWait,
		logLevel: String(parsed.values["log-level"] ?? "WARNING"),
		profileDir: userDataDir,
		userDataDir,
		transport: transport as "stdio" | "streamable-http",
		checkForUpdates:
			!parsed.values["no-update-check"] &&
			envBool("LINKEDIN_MCP_CHECK_FOR_UPDATES", true),
		autoImportFromBrowser: autoImport,
		userAgent: parsed.values["user-agent"]
			? String(parsed.values["user-agent"])
			: undefined,
		chromePath: parsed.values["chrome-path"]
			? String(parsed.values["chrome-path"])
			: undefined,
		viewport: parseViewport(String(parsed.values.viewport ?? "1280x720")),
		debugPort: Number(parsed.values["debug-port"] ?? 9222),
		mode,
		importBrowser:
			parsed.values["import-from-browser"] === undefined
				? undefined
				: String(parsed.values["import-from-browser"] || "auto"),
	};
}
