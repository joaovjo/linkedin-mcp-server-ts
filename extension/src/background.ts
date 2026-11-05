/* global chrome */
declare const chrome: any;

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
	socket.addEventListener("message", (event: MessageEvent) => {
		void handleBridgeMessage(String(event.data ?? ""));
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
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		const tab = tabs?.[0];
		if (!tab?.id) {
			socket?.send(
				JSON.stringify({
					id: message.id,
					type: "extract_result",
					target: message.target,
					ok: false,
					error: "No active tab",
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
			socket?.send(JSON.stringify({ id: message.id, ...result }));
		} catch (err) {
			socket?.send(
				JSON.stringify({
					id: message.id,
					type: "extract_result",
					target: message.target,
					ok: false,
					error: err instanceof Error ? err.message : String(err),
				}),
			);
		}
	}
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
					const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
					const tab = tabs?.[0];
					if (!tab?.id) {
						sendResponse({ ok: false, error: "No active tab" });
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
