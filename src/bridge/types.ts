export interface BridgeOptions {
	hostname?: string;
	port?: number;
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
