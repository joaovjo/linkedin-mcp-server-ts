import type { BridgeHandle, BridgeOptions } from "./types.ts";

/**
 * Start a local WebSocket bridge that Chrome extensions can connect to.
 *
 * Disabled by default; callers must opt in via configuration/flags.
 */
export function startBridge(options: BridgeOptions = {}): BridgeHandle {
	const hostname = options.hostname ?? "127.0.0.1";
	const port = options.port ?? 8765;

	const sockets = new Set<WebSocket>();

	const server = Bun.serve({
		hostname,
		port,
		fetch(req, srv) {
			const upgraded = srv.upgrade(req);
			if (upgraded) return undefined;
			return new Response("LinkedIn MCP Bridge", { status: 200 });
		},
		websocket: {
			open(ws) {
				sockets.add(ws as unknown as WebSocket);
				console.error("[bridge] client connected");
			},
			message(ws, message) {
				let parsed: unknown = null;
				try {
					parsed = JSON.parse(String(message));
				} catch {
					parsed = null;
				}
				console.error("[bridge] received:", parsed ?? message);
				try {
					(ws as unknown as { send: (data: string) => void }).send(JSON.stringify({ type: "ack", received: true }));
				} catch {
					// ignore send failures
				}
			},
			close(ws) {
				sockets.delete(ws as unknown as WebSocket);
				console.error("[bridge] client disconnected");
			},
		},
	});

	console.error(`  Bridge listening on ws://${hostname}:${server.port}`);

	return {
		server,
		stop: () => {
			for (const ws of sockets) {
				try {
					ws.close();
				} catch {
					// ignore
				}
			}
			sockets.clear();
			server.stop(true);
		},
	};
}
