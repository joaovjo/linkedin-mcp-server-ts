#!/usr/bin/env bun

/**
 * Main entry point for the LinkedIn Model Context Protocol (MCP) server.
 *
 * @remarks
 * Supports both stdio and streamable-http transports, as well as CLI maintenance modes
 * (`--login`, `--logout`, `--status`, `--import-from-browser`).
 *
 * @packageDocumentation
 */

import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	localhostAllowedOrigins,
	originValidationResponse,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { startBridge } from "./bridge/index.ts";
import { setBridge } from "./bridge/state.ts";
import { performImportFromBrowser, performLogin, performLogout, performStatus } from "./browser/auth.ts";
import { browserManager } from "./browser/manager.ts";
import { loadConfig } from "./config.ts";
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from "./mcp/create-server.ts";
import { ensureSessionDirs } from "./session/store.ts";
import { createLogger, createReqId, setLogLevel } from "./utils/logger.ts";

const config = loadConfig();
setLogLevel(config.logLevel);
const log = createLogger({ module: "index" });

await ensureSessionDirs(config.userDataDir);

if (config.mode === "login") {
	try {
		await performLogin(config);
		process.exit(0);
	} catch (err) {
		log.error("login_failed", { error: err instanceof Error ? err.message : String(err) });
		process.exit(1);
	}
}

if (config.mode === "logout") {
	await performLogout(config);
	process.exit(0);
}

if (config.mode === "status") {
	process.exit(await performStatus(config));
}

if (config.mode === "import") {
	try {
		await performImportFromBrowser(config);
		process.exit(0);
	} catch (err) {
		log.error("import_failed", { error: err instanceof Error ? err.message : String(err) });
		process.exit(1);
	}
}

log.info("startup", {
	name: SERVER_NAME,
	version: SERVER_VERSION,
	transport: config.transport,
	bridge_enabled: config.bridgeEnabled,
	bridge_port: config.bridgePort,
	logLevel: config.logLevel,
	host: config.host,
	port: config.port,
});

try {
	Bun.dns.prefetch?.("www.linkedin.com");
} catch {
	// optional warmup
}

const closeBrowser = async () => {
	try {
		await browserManager.close();
	} catch {
		// ignore
	}
};

let bridgeHandle: ReturnType<typeof startBridge> | null = null;
if (config.bridgeEnabled) {
	try {
		bridgeHandle = startBridge({ port: config.bridgePort });
		setBridge(bridgeHandle);
		log.info("bridge_started", {
			port: bridgeHandle.server.port,
			requested_port: config.bridgePort,
			host: config.host,
		});
	} catch (err) {
		log.error("bridge_failed", {
			port: config.bridgePort,
			status: "error",
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
} else {
	log.info("bridge_disabled", {
		bridge_enabled: false,
		bridge_port: config.bridgePort,
	});
}

if (config.transport === "stdio") {
	const handle = serveStdio(() => createMcpServer(config));
	log.info("stdio_listening", { transport: "stdio" });

	const shutdown = async () => {
		log.info("shutdown", { transport: "stdio" });
		await handle.close();
		bridgeHandle?.stop();
		setBridge(null);
		await closeBrowser();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
} else {
	const mcpHandler = createMcpHandler(() => createMcpServer(config), {
		responseMode: "json",
	});

	const httpPath = config.httpPath.endsWith("/") ? config.httpPath.slice(0, -1) : config.httpPath;

	const server = Bun.serve({
		hostname: config.host,
		port: config.port,
		// Tool calls can legitimately run for minutes (login waits, paginated
		// scrapes). Bun's default 10s idle timeout would kill the request first.
		idleTimeout: Math.min(255, config.toolTimeout + 30),
		async fetch(req) {
			const reqId = createReqId();
			const startedAt = Date.now();
			const url = new URL(req.url);
			const path = url.pathname;
			let status = 500;
			try {
				let response: Response;
				if (url.pathname === "/health") {
					response = new Response("OK", { status: 200 });
				} else if (url.pathname === httpPath || url.pathname === `${httpPath}/`) {
					const hostErr = hostHeaderValidationResponse(req, localhostAllowedHostnames());
					if (hostErr) {
						response = hostErr;
					} else {
						const originErr = originValidationResponse(req, localhostAllowedOrigins());
						response = originErr ?? (await mcpHandler.fetch(req));
					}
				} else {
					response = new Response("Not Found", { status: 404 });
				}
				status = response.status;
				return response;
			} finally {
				const durationMs = Date.now() - startedAt;
				log.info("http_request", {
					req_id: reqId,
					method: req.method,
					path,
					status,
					duration_ms: durationMs,
					latency_ms: durationMs,
				});
			}
		},
	});

	log.info("http_listening", {
		host: config.host,
		port: server.port,
		path: httpPath,
		transport: config.transport,
	});

	const shutdown = async () => {
		log.info("shutdown", { transport: "streamable-http" });
		await mcpHandler.close();
		server.stop(true);
		bridgeHandle?.stop();
		setBridge(null);
		await closeBrowser();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
