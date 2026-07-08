import { loadConfig } from "./config.ts";
import { createServer } from "./server.ts";

const config = loadConfig();

console.error(`  mcp-server-linkedin v0.1.0`);
console.error(`   Transport: ${config.transport}`);
console.error(`   Port: ${config.port}`);

const { handleMcpRequest, closeAll } = await createServer(config);

Bun.serve({
	port: config.port,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
			try {
				return await handleMcpRequest(req);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error("MCP error:", msg);
				return new Response(
					JSON.stringify({
						jsonrpc: "2.0",
						error: { code: -32603, message: msg },
						id: null,
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		if (url.pathname === "/health") {
			return new Response("OK", { status: 200 });
		}

		return new Response("Not Found", { status: 404 });
	},
});

console.error(`  Server listening on http://localhost:${config.port}/mcp`);

process.on("SIGINT", async () => {
	console.error("\nShutting down...");
	await closeAll();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	console.error("\nShutting down...");
	await closeAll();
	process.exit(0);
});
