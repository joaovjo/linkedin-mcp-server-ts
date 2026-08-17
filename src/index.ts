#!/usr/bin/env bun

import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	localhostAllowedOrigins,
	originValidationResponse,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { performImportFromBrowser, performLogin, performLogout, performStatus } from "./browser/auth.ts";
import { browserManager } from "./browser/manager.ts";
import { loadConfig } from "./config.ts";
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from "./mcp/create-server.ts";
import { ensureSessionDirs } from "./session/store.ts";

const config = loadConfig();

await ensureSessionDirs(config.userDataDir);

if (config.mode === "login") {
	try {
		await performLogin(config);
		process.exit(0);
	} catch (err) {
		console.error("Login failed:", err instanceof Error ? err.message : err);
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
		console.error("Import failed:", err instanceof Error ? err.message : err);
		process.exit(1);
	}
}

console.error(`  ${SERVER_NAME} v${SERVER_VERSION}`);
console.error(`  Transport: ${config.transport}`);

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

if (config.transport === "stdio") {
	const handle = serveStdio(() => createMcpServer(config));
	console.error("  Listening on stdio");

	const shutdown = async () => {
		console.error("\nShutting down...");
		await handle.close();
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
		async fetch(req) {
			const url = new URL(req.url);

			if (url.pathname === "/health") {
				return new Response("OK", { status: 200 });
			}

			if (url.pathname === httpPath || url.pathname === `${httpPath}/`) {
				const hostErr = hostHeaderValidationResponse(req, localhostAllowedHostnames());
				if (hostErr) return hostErr;
				const originErr = originValidationResponse(req, localhostAllowedOrigins());
				if (originErr) return originErr;
				return mcpHandler.fetch(req);
			}

			return new Response("Not Found", { status: 404 });
		},
	});

	console.error(`  Server listening on http://${config.host}:${server.port}${httpPath}`);

	const shutdown = async () => {
		console.error("\nShutting down...");
		await mcpHandler.close();
		server.stop(true);
		await closeBrowser();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
