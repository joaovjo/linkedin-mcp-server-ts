export interface BridgeOptions {
	hostname?: string;
	port?: number;
	/**
	 * Keep-alive ping interval in milliseconds (server -> client).
	 * Pings keep the extension's MV3 service worker alive (Chrome resets its
	 * idle timer on WebSocket activity) and prevent idle socket timeouts.
	 * 0 disables pings. Default: 25000.
	 */
	pingIntervalMs?: number;
}

export interface BridgeMessage {
	id?: string;
	type: string;
	[key: string]: unknown;
}

export interface BridgeHandle {
	server: ReturnType<typeof Bun.serve>;
	stop: () => void;
	sockets: Set<WebSocket>;
	requestExtract(target: string, params?: unknown, timeoutMs?: number): Promise<unknown>;
	isConnected(): boolean;
}
