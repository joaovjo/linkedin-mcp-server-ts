/* global chrome */
declare const chrome: any;

import "./mcp-server.ts";

const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";
const STORAGE_KEYS = {
	mcpUrl: "popupMcpUrl",
	bridgeUrl: "popupBridgeUrl",
	lastConnectedAt: "lastConnectedAt",
};

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function getBridgeUrl(): Promise<string> {
	const stored = await chrome.storage.local.get(STORAGE_KEYS.bridgeUrl);
	return (stored?.[STORAGE_KEYS.bridgeUrl] as string | undefined) ?? DEFAULT_BRIDGE_URL;
}

async function setConnected(connected: boolean): Promise<void> {
	await chrome.storage.local.set({
		[STORAGE_KEYS.lastConnectedAt]: connected ? Date.now() : undefined,
	});
}

function clearReconnect(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
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
	try {
		socket = new WebSocket(url);
	} catch {
		await setConnected(false);
		scheduleReconnect();
		return;
	}
	socket.addEventListener("open", () => {
		void setConnected(true);
	});
	socket.addEventListener("close", () => {
		socket = null;
		void setConnected(false);
		scheduleReconnect();
	});
	socket.addEventListener("error", () => {
		void setConnected(false);
	});
}

export function disconnectBridge(): void {
	clearReconnect();
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

chrome.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
	const msg = message as { type?: string; bridgeUrl?: string } | null;
	if (!msg?.type) return false;

	(async () => {
		try {
			switch (msg.type) {
				case "get_status": {
					const state = await chrome.storage.local.get([
						STORAGE_KEYS.lastConnectedAt,
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
