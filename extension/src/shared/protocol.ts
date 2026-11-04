/**
 * Typed request/response protocol shared by the extension and the local bridge.
 */

export type ExtractTarget = "person" | "company" | "job" | "messaging" | "feed";

export interface ExtractParams {
	[key: string]: unknown;
}

export interface ExtractRequestMessage {
	type: "extract";
	target: ExtractTarget;
	params?: ExtractParams;
	tabId?: number;
}

export interface ExtractResponseMessage {
	type: "extract_result";
	target: ExtractTarget;
	ok: boolean;
	data?: unknown;
	error?: string;
	url?: string;
}

export interface BridgeRequest {
	id: string;
	method: "extract" | "ping";
	params?: unknown;
}

export interface BridgeResponse {
	id: string;
	ok: boolean;
	result?: unknown;
	error?: string;
}

export interface StatusMessage {
	type: "status";
	connected: boolean;
	bridgeUrl?: string;
}

export interface ConnectMessage {
	type: "connect" | "disconnect";
}

export type RuntimeMessage =
	| ExtractRequestMessage
	| ExtractResponseMessage
	| StatusMessage
	| ConnectMessage;

export function createId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}