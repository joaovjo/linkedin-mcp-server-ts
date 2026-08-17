import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

/**
 * Application configuration options for the LinkedIn MCP server.
 *
 * @remarks
 * Encapsulates network, browser, authentication, viewport, and execution settings.
 * Options are parsed from CLI arguments and fallback to environment variables.
 *
 * @public
 */
export interface AppConfig {
	/** Hostname or IP address for HTTP server binding. Default: `127.0.0.1`. */
	host: string;
	/** Port number for HTTP server. Default: `8000`. */
	port: number;
	/** HTTP endpoint route for the MCP handler. Default: `/mcp`. */
	httpPath: string;
	/** Whether to run Chrome in headless mode. Default: `true`. */
	headless: boolean;
	/** Maximum timeout (in seconds) for tool execution. Default: `180`. */
	toolTimeout: number;
	/** Page load navigation timeout in milliseconds. Default: `5000`. */
	pageTimeout: number;
	/** Maximum timeout (in seconds) for interactive login. Default: `1800`. */
	loginTimeout: number;
	/** Inline login wait period in seconds when no session exists. Default: `25`. */
	loginInlineWait: number;
	/** Logging severity level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). */
	logLevel: string;
	/** Profile directory for Chrome browser storage. */
	profileDir: string;
	/** User data directory path for storing session cookies and state. */
	userDataDir: string;
	/** Transport protocol mode (`stdio` or `streamable-http`). */
	transport: "stdio" | "streamable-http";
	/** Whether to check for upstream package updates on startup. */
	checkForUpdates: boolean;
	/** Automatically import authenticated session cookies from local browser profiles. */
	autoImportFromBrowser: boolean;
	/** Custom User-Agent header string. */
	userAgent?: string;
	/** Explicit path to Chrome or Edge executable binary. */
	chromePath?: string;
	/** Browser window dimensions (width x height). */
	viewport: { width: number; height: number };
	/** Remote debugging port for Chrome DevTools Protocol. Default: `9222`. */
	debugPort: number;
	/** Execution mode (`serve`, `login`, `logout`, `status`, `import`). */
	mode: "serve" | "login" | "logout" | "status" | "import";
	/** Optional browser target name for importing cookies. */
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

/**
 * Parses command-line arguments and environment variables into a strongly-typed {@link AppConfig}.
 *
 * @param args - Command-line arguments array. Defaults to `Bun.argv.slice(2)`.
 * @returns The resolved application configuration object.
 *
 * @example
 * ```ts
 * import { loadConfig } from "./config.ts";
 * const config = loadConfig(["--transport", "stdio"]);
 * console.log(config.transport); // "stdio"
 * ```
 *
 * @public
 */
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
	const userDataDir = String(parsed.values["user-data-dir"] || parsed.values["profile-dir"] || defaultUserData);

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

	const loginInlineWait = Math.min(45, Math.max(0, Number(parsed.values["login-inline-wait"] ?? 25)));

	return {
		host: String(parsed.values.host ?? "127.0.0.1"),
		port: Number(parsed.values.port ?? 8000),
		httpPath: String(parsed.values.path ?? "/mcp"),
		headless: parsed.values["no-headless"] ? false : String(parsed.values.headless ?? "true") !== "false",
		toolTimeout: Number(parsed.values["tool-timeout"] ?? 180),
		pageTimeout: Number(parsed.values.timeout ?? 5000),
		loginTimeout: Number(parsed.values["login-timeout"] ?? 1800),
		loginInlineWait,
		logLevel: String(parsed.values["log-level"] ?? "WARNING"),
		profileDir: userDataDir,
		userDataDir,
		transport: transport as "stdio" | "streamable-http",
		checkForUpdates: !parsed.values["no-update-check"] && envBool("LINKEDIN_MCP_CHECK_FOR_UPDATES", true),
		autoImportFromBrowser: autoImport,
		userAgent: parsed.values["user-agent"] ? String(parsed.values["user-agent"]) : undefined,
		chromePath: parsed.values["chrome-path"] ? String(parsed.values["chrome-path"]) : undefined,
		viewport: parseViewport(String(parsed.values.viewport ?? "1280x720")),
		debugPort: Number(parsed.values["debug-port"] ?? 9222),
		mode,
		importBrowser:
			parsed.values["import-from-browser"] === undefined ? undefined : String(parsed.values["import-from-browser"] || "auto"),
	};
}
