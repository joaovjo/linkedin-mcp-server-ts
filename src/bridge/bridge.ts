import type { BridgeHandle, BridgeOptions } from "./types.ts";

interface PendingRequest {
	ws: WebSocket;
	resolve: (value: unknown) => void;
	reject: (reason?: unknown) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * Start a local WebSocket bridge that Chrome extensions can connect to.
 *
 * Disabled by default; callers must opt in via configuration/flags.
 */
export function startBridge(options: BridgeOptions = {}): BridgeHandle {
	const hostname = options.hostname ?? "127.0.0.1";
	const port = options.port ?? 8765;

	const sockets = new Set<WebSocket>();
	const pending = new Map<string, PendingRequest>();

	const rejectPendingForSocket = (ws: WebSocket, reason: Error) => {
		for (const [id, entry] of pending) {
			if (entry.ws === ws) {
				clearTimeout(entry.timer);
				pending.delete(id);
				entry.reject(reason);
			}
		}
	};

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
				const socket = ws as unknown as WebSocket;
				let parsed: unknown = null;
				try {
					parsed = JSON.parse(String(message));
				} catch {
					parsed = null;
				}

				if (parsed && typeof parsed === "object" && "id" in (parsed as Record<string, unknown>)) {
					const id = (parsed as { id?: unknown }).id;
					if (typeof id === "string" && pending.has(id)) {
						const entry = pending.get(id);
						if (!entry) return;
						clearTimeout(entry.timer);
						pending.delete(id);
						const obj = parsed as { ok?: unknown; error?: unknown };
						if (obj.ok === false) {
							entry.reject(new Error(typeof obj.error === "string" ? obj.error : "Bridge extract failed"));
						} else {
							entry.resolve(parsed);
						}
						return;
					}
				}

				console.error("[bridge] received:", parsed ?? message);
				try {
					socket.send(JSON.stringify({ type: "ack", received: true }));
				} catch {
					// ignore send failures
				}
			},
			close(ws) {
				const socket = ws as unknown as WebSocket;
				sockets.delete(socket);
				rejectPendingForSocket(socket, new Error("Bridge client disconnected"));
				console.error("[bridge] client disconnected");
			},
		},
	});

	const handle: BridgeHandle = {
		server,
		sockets,
		isConnected() {
			return sockets.size > 0;
		},
		async requestExtract(target, params, timeoutMs) {
			const clients = [...sockets];
			if (clients.length === 0) {
				throw new Error("No bridge client connected");
			}
			const ws = clients[0];
			if (!ws) throw new Error("No bridge client connected");
			const id = crypto.randomUUID();
			const timeout = timeoutMs ?? 15000;

			return new Promise<unknown>((resolve, reject) => {
				const timer = setTimeout(() => {
					if (pending.has(id)) {
						pending.delete(id);
						reject(new Error("Bridge extract timed out"));
					}
				}, timeout);

				pending.set(id, { ws, resolve, reject, timer });

				try {
					ws.send(JSON.stringify({ id, type: "extract", target, params }));
				} catch (err) {
					clearTimeout(timer);
					pending.delete(id);
					reject(err);
				}
			});
		},
		stop() {
			for (const [id, entry] of pending) {
				clearTimeout(entry.timer);
				pending.delete(id);
				entry.reject(new Error("Bridge stopped"));
			}
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

	console.error(`  Bridge listening on ws://${hostname}:${server.port}`);

	return handle;
}
