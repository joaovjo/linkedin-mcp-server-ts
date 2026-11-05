import { createLogger, createReqId } from "../utils/logger.ts";
import type { BridgeHandle, BridgeOptions } from "./types.ts";

interface PendingRequest {
	ws: WebSocket;
	resolve: (value: unknown) => void;
	reject: (reason?: unknown) => void;
	timer: ReturnType<typeof setTimeout>;
	startedAt: number;
	target: string;
	timeoutMs: number;
	connId: string;
}

/**
 * Start a local WebSocket bridge that Chrome extensions can connect to.
 *
 * Disabled by default; callers must opt in via configuration/flags.
 */
export function startBridge(options: BridgeOptions = {}): BridgeHandle {
	const hostname = options.hostname ?? "127.0.0.1";
	const port = options.port ?? 8765;
	const log = createLogger({ module: "bridge" });

	const sockets = new Set<WebSocket>();
	const pending = new Map<string, PendingRequest>();
	const connIds = new Map<WebSocket, string>();
	let connCounter = 0;

	const nextConnId = (): string => {
		connCounter += 1;
		return `conn-${connCounter}`;
	};

	const connIdFor = (ws: WebSocket): string => connIds.get(ws) ?? "unknown";

	const remoteFor = (ws: WebSocket): string => {
		try {
			const remote = (ws as unknown as { remoteAddress?: unknown }).remoteAddress;
			return typeof remote === "string" && remote.length > 0 ? remote : "unknown";
		} catch {
			return "unknown";
		}
	};

	const rejectPendingForSocket = (ws: WebSocket, reason: Error) => {
		const connId = connIdFor(ws);
		for (const [id, entry] of pending) {
			if (entry.ws === ws) {
				clearTimeout(entry.timer);
				pending.delete(id);
				log.error("extract_error", {
					req_id: id,
					target: entry.target,
					conn_id: connId,
					latency_ms: Date.now() - entry.startedAt,
					timeout_ms: entry.timeoutMs,
					error: reason.message,
				});
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
				const socket = ws as unknown as WebSocket;
				const connId = nextConnId();
				connIds.set(socket, connId);
				sockets.add(socket);
				log.info("client_connected", {
					conn_id: connId,
					remote: remoteFor(socket),
					clients: sockets.size,
				});
			},
			message(ws, message) {
				const socket = ws as unknown as WebSocket;
				const connId = connIdFor(socket);
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
						const latencyMs = Date.now() - entry.startedAt;
						const obj = parsed as { ok?: unknown; error?: unknown };
						const ok = obj.ok !== false;
						log.info("extract_response", {
							req_id: id,
							target: entry.target,
							conn_id: connId,
							latency_ms: latencyMs,
							status: ok ? "ok" : "error",
						});
						if (obj.ok === false) {
							const errorText = typeof obj.error === "string" ? obj.error : "Bridge extract failed";
							log.error("extract_error", {
								req_id: id,
								target: entry.target,
								conn_id: connId,
								latency_ms: latencyMs,
								status: "error",
								error: errorText,
							});
							entry.reject(new Error(errorText));
						} else {
							entry.resolve(parsed);
						}
						return;
					}
				}

				log.debug("bridge_message", {
					conn_id: connId,
					remote: remoteFor(socket),
					received: parsed ?? message,
				});
				try {
					socket.send(JSON.stringify({ type: "ack", received: true }));
				} catch {
					// ignore send failures
				}
			},
			close(ws) {
				const socket = ws as unknown as WebSocket;
				const connId = connIdFor(socket);
				const remote = remoteFor(socket);
				sockets.delete(socket);
				connIds.delete(socket);
				rejectPendingForSocket(socket, new Error("Bridge client disconnected"));
				log.info("client_disconnected", {
					conn_id: connId,
					remote,
					clients: sockets.size,
				});
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
				log.error("extract_error", {
					target,
					status: "error",
					error: "No bridge client connected",
					clients: 0,
				});
				throw new Error("No bridge client connected");
			}
			const ws = clients[0];
			if (!ws) {
				log.error("extract_error", {
					target,
					status: "error",
					error: "No bridge client connected",
				});
				throw new Error("No bridge client connected");
			}
			const id = createReqId();
			const timeout = timeoutMs ?? 15000;
			const connId = connIdFor(ws);
			const startedAt = Date.now();
			const paramsKeys =
				params !== undefined && typeof params === "object" && params !== null
					? Object.keys(params as Record<string, unknown>)
					: [];

			log.info("extract_request", {
				req_id: id,
				target,
				timeout_ms: timeout,
				conn_id: connId,
				has_params: params !== undefined,
				params_keys: paramsKeys,
			});

			return new Promise<unknown>((resolve, reject) => {
				const timer = setTimeout(() => {
					if (pending.has(id)) {
						pending.delete(id);
						log.warn("extract_timeout", {
							req_id: id,
							target,
							conn_id: connId,
							latency_ms: Date.now() - startedAt,
							timeout_ms: timeout,
							status: "timeout",
							error: "Bridge extract timed out",
						});
						reject(new Error("Bridge extract timed out"));
					}
				}, timeout);

				pending.set(id, { ws, resolve, reject, timer, startedAt, target, timeoutMs: timeout, connId });

				try {
					ws.send(JSON.stringify({ id, type: "extract", target, params }));
				} catch (err) {
					clearTimeout(timer);
					pending.delete(id);
					log.error("extract_error", {
						req_id: id,
						target,
						conn_id: connId,
						latency_ms: Date.now() - startedAt,
						timeout_ms: timeout,
						status: "error",
						error: err instanceof Error ? err.message : String(err),
					});
					reject(err);
				}
			});
		},
		stop() {
			log.debug("bridge_stopped", { clients: sockets.size });
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
			connIds.clear();
			server.stop(true);
		},
	};

	log.info("bridge_listening", { host: hostname, port: server.port });

	return handle;
}
