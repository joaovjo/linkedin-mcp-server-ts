/* global chrome */
declare const chrome: any;

import { logger } from "./logger";

const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";
const STORAGE_KEYS = {
	mcpUrl: "popupMcpUrl",
	bridgeUrl: "popupBridgeUrl",
	lastConnectedAt: "lastConnectedAt",
};

const BRIDGE_UNREACHABLE_MSG =
	"bridge unreachable — is bun run src/index.ts running?";

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connId: string | null = null;
let connectStartedAt = 0;

function newConnId(): string {
	try {
		return crypto.randomUUID();
	} catch {
		return `conn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
	}
}

async function getBridgeUrl(): Promise<string> {
	const stored = await chrome.storage.local.get(STORAGE_KEYS.bridgeUrl);
	return (stored?.[STORAGE_KEYS.bridgeUrl] as string | undefined) ?? DEFAULT_BRIDGE_URL;
}

async function setConnected(connected: boolean): Promise<void> {
	await chrome.storage.local.set({
		bridgeConnected: connected,
		[STORAGE_KEYS.lastConnectedAt]: connected ? Date.now() : undefined,
	});
}

function clearReconnect(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
}

const KEEP_ALIVE_INTERVAL_MS = 25_000;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function clearKeepAlive(): void {
	if (keepAliveTimer) {
		clearInterval(keepAliveTimer);
		keepAliveTimer = null;
	}
}

function startKeepAlive(ws: WebSocket): void {
	clearKeepAlive();
	// The MV3 service worker idles out after ~30s without WebSocket activity,
	// which kills this connection. Client pings (together with the bridge's own
	// server-side pings) keep the socket constantly active so the SW stays up.
	keepAliveTimer = setInterval(() => {
		if (ws.readyState === WebSocket.OPEN) {
			try {
				ws.send(JSON.stringify({ type: "ping", id: newConnId() }));
			} catch {
				// ignore send failures; the close handler reconnects
			}
		}
	}, KEEP_ALIVE_INTERVAL_MS);
}

function scheduleReconnect(): void {
	clearReconnect();
	reconnectTimer = setTimeout(() => {
		void connectBridge();
	}, 3000);
}

async function connectBridge(): Promise<void> {
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		return;
	}
	const url = await getBridgeUrl();
	connId = newConnId();
	connectStartedAt = Date.now();
	logger.info("connect_start", { url, conn_id: connId });
	try {
		socket = new WebSocket(url);
	} catch (err) {
		logger.error("connect_failed", {
			url,
			conn_id: connId,
			error: err instanceof Error ? err.message : String(err),
			msg: BRIDGE_UNREACHABLE_MSG,
		});
		await setConnected(false);
		scheduleReconnect();
		return;
	}
	socket.addEventListener("open", () => {
		const latency_ms = Date.now() - connectStartedAt;
		logger.info("connect_open", { url, conn_id: connId, latency_ms });
		startKeepAlive(socket);
		void setConnected(true);
	});
	socket.addEventListener("message", (event: MessageEvent) => {
		void handleBridgeMessage(String(event.data ?? ""));
	});
	socket.addEventListener("close", (event: CloseEvent) => {
		logger.info("connect_close", {
			url,
			conn_id: connId,
			code: event.code,
			reason: event.reason || undefined,
		});
		clearKeepAlive();
		socket = null;
		void setConnected(false);
		scheduleReconnect();
	});
	socket.addEventListener("error", (event: Event) => {
		logger.error("connect_error", {
			url,
			conn_id: connId,
			error: (event as { message?: string }).message ?? "WebSocket error",
			msg: BRIDGE_UNREACHABLE_MSG,
		});
		void setConnected(false);
	});
}

const LINKEDIN_ORIGIN = "https://www.linkedin.com/";
const PREFERRED_PAGE_HINTS = ["/in/", "/company/", "/jobs/", "/feed/", "/messaging/"];

async function findLinkedInTab(): Promise<{
	tab: { id?: number; url?: string } | undefined;
	tabsCount: number;
	allTabsCount: number;
}> {
	const allTabs: Array<{ id?: number; url?: string }> = await chrome.tabs.query({});
	const tabs = allTabs.filter((t) => t.url?.startsWith(LINKEDIN_ORIGIN));
	const tab = tabs.find((t) => PREFERRED_PAGE_HINTS.some((hint) => t.url?.includes(hint))) ?? tabs[0];
	return { tab, tabsCount: tabs.length, allTabsCount: allTabs.length };
}

async function handleBridgeMessage(raw: string): Promise<void> {
	let message: { id?: string; type?: string; target?: string; params?: unknown } | null = null;
	try {
		message = JSON.parse(raw);
	} catch {
		return;
	}
	if (!message) return;

	if (message.type === "ping") {
		socket?.send(JSON.stringify({ type: "pong", id: message.id }));
		return;
	}

	if (message.type === "extract" && message.target) {
		const reqId = message.id;
		const target = message.target;
		logger.info("extract_request", { reqId, target, conn_id: connId });
		const extractStartedAt = Date.now();
		const { tab, tabsCount, allTabsCount } = await findLinkedInTab();
		if (!tab?.id) {
			const error = `No LinkedIn tab found (tabs=${tabsCount}/${allTabsCount})`;
			logger.error("extract_error", { reqId, target, error, conn_id: connId, tabs: tabsCount, allTabs: allTabsCount });
			socket?.send(
				JSON.stringify({
					id: message.id,
					type: "extract_result",
					target: message.target,
					ok: false,
					error,
				}),
			);
			return;
		}
		try {
			const result = await chrome.tabs.sendMessage(tab.id, {
				type: "extract",
				target: message.target,
				params: message.params,
			});
			const latency_ms = Date.now() - extractStartedAt;
			logger.info("extract_success", { reqId, target, latency_ms, conn_id: connId });
			socket?.send(JSON.stringify({ id: message.id, ...result }));
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			logger.error("extract_error", { reqId, target, error, conn_id: connId });
			socket?.send(
				JSON.stringify({
					id: message.id,
					type: "extract_result",
					target: message.target,
					ok: false,
					error,
				}),
			);
		}
	}
}

export function disconnectBridge(): void {
	clearReconnect();
	clearKeepAlive();
	if (socket) {
		try {
			socket.close();
		} catch {
			// ignore
		}
		socket = null;
	}
	void setConnected(false);
}

logger.info("extension_sw_started", { bridgeUrl: DEFAULT_BRIDGE_URL });

chrome.runtime.onInstalled.addListener(() => {
	void chrome.storage.local.get(STORAGE_KEYS.bridgeUrl).then((stored: Record<string, unknown>) => {
		if (!stored?.[STORAGE_KEYS.bridgeUrl]) {
			return chrome.storage.local.set({ [STORAGE_KEYS.bridgeUrl]: DEFAULT_BRIDGE_URL });
		}
		return undefined;
	});
});

chrome.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
	const msg = message as { type?: string; bridgeUrl?: string } | null;
	if (!msg?.type) return false;

	(async () => {
		try {
			switch (msg.type) {
				case "get_status": {
					const state = await chrome.storage.local.get([
						STORAGE_KEYS.lastConnectedAt,
						"bridgeConnected",
						STORAGE_KEYS.bridgeUrl,
					]);
					sendResponse({ ok: true, ...state });
					break;
				}
				case "connect": {
					if (msg.bridgeUrl) {
						await chrome.storage.local.set({ [STORAGE_KEYS.bridgeUrl]: msg.bridgeUrl });
					}
					await connectBridge();
					sendResponse({ ok: true });
					break;
				}
				case "disconnect": {
					disconnectBridge();
					sendResponse({ ok: true });
					break;
				}
				case "extract": {
					const { tab } = await findLinkedInTab();
					if (!tab?.id) {
						sendResponse({ ok: false, error: "No LinkedIn tab open" });
						break;
					}
					const result = await chrome.tabs.sendMessage(tab.id, msg);
					sendResponse(result);
					break;
				}
				default:
					sendResponse({ ok: false, error: `Unknown message type: ${msg.type}` });
			}
		} catch (err) {
			sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
		}
	})();
	return true;
});

chrome.alarms.onAlarm.addListener((alarm: { name: string }) => {
	if (alarm.name === "bridge-reconnect") {
		void connectBridge();
	}
});
