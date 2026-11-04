/* global chrome */
declare const chrome: any;

const statusEl = document.getElementById("status") as HTMLDivElement;
const urlEl = document.getElementById("url") as HTMLElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const disconnectBtn = document.getElementById("disconnect") as HTMLButtonElement;

function render(connected: boolean, bridgeUrl?: string): void {
	statusEl.textContent = connected ? "Connected" : "Disconnected";
	statusEl.className = `status ${connected ? "connected" : "disconnected"}`;
	if (bridgeUrl) urlEl.textContent = bridgeUrl;
}

async function refresh(): Promise<void> {
	const response = await chrome.runtime.sendMessage({ type: "get_status" });
	render(Boolean(response?.bridgeConnected), response?.bridgeUrl);
}

connectBtn.addEventListener("click", async () => {
	await chrome.runtime.sendMessage({ type: "connect" });
	await refresh();
});

disconnectBtn.addEventListener("click", async () => {
	await chrome.runtime.sendMessage({ type: "disconnect" });
	await refresh();
});

void refresh();