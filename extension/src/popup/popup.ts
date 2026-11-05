/* global chrome */
declare const chrome: any;

const statusEl = document.getElementById("status") as HTMLDivElement;
const mcpUrlEl = document.getElementById("mcpUrl") as HTMLElement;
const copyBtn = document.getElementById("copyUrl") as HTMLButtonElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const disconnectBtn = document.getElementById("disconnect") as HTMLButtonElement;
const bridgeUrlEl = document.getElementById("bridgeUrl") as HTMLElement;
const bridgeHintEl = document.getElementById("bridgeHint") as HTMLElement;

const DEFAULT_MCP_URL = "http://127.0.0.1:8000/mcp";
const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";
const STORAGE_KEYS = {
	mcpUrl: "popupMcpUrl",
	bridgeUrl: "popupBridgeUrl",
};

function render(connected: boolean, bridgeUrl?: string, mcpUrl?: string): void {
	statusEl.textContent = connected ? "Conectado" : "Desconectado";
	statusEl.className = `status ${connected ? "connected" : "disconnected"}`;

	if (bridgeUrl) bridgeUrlEl.textContent = bridgeUrl;
	else bridgeUrlEl.textContent = DEFAULT_BRIDGE_URL;

	if (mcpUrl) {
		mcpUrlEl.textContent = mcpUrl;
		mcpUrlEl.setAttribute("data-value", mcpUrl);
	} else {
		mcpUrlEl.textContent = DEFAULT_MCP_URL;
		mcpUrlEl.setAttribute("data-value", DEFAULT_MCP_URL);
	}

	bridgeHintEl.innerHTML = connected
		? "Bridge conectado ao servidor MCP local. A URL acima está pronta para uso na IA."
		: "Inicie o servidor MCP com <code>bun run src/index.ts</code> (bridge ativo por padrão em ws://127.0.0.1:8765) e clique em Conectar.";
}

async function refresh(): Promise<void> {
	const response = await chrome.runtime.sendMessage({ type: "get_status" });
	const connected = Boolean(response?.bridgeConnected);
	const bridgeUrl = (response?.bridgeUrl as string) || undefined;
	const stored = await chrome.storage.local.get([STORAGE_KEYS.mcpUrl, STORAGE_KEYS.bridgeUrl]);
	const mcpUrl = (stored?.[STORAGE_KEYS.mcpUrl] as string) || undefined;
	render(connected, bridgeUrl, mcpUrl);
}

async function saveMcpUrl(url: string): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.mcpUrl]: url });
}

async function saveBridgeUrl(url: string): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.bridgeUrl]: url });
}

copyBtn.addEventListener("click", async () => {
	const value = mcpUrlEl.getAttribute("data-value") || DEFAULT_MCP_URL;
	await navigator.clipboard.writeText(value);
	const original = copyBtn.textContent;
	copyBtn.textContent = "Copiado!";
	setTimeout(() => {
		copyBtn.textContent = original;
	}, 1500);
});

connectBtn.addEventListener("click", async () => {
	const bridgeUrl = bridgeUrlEl.textContent || DEFAULT_BRIDGE_URL;
	await saveBridgeUrl(bridgeUrl);
	await chrome.runtime.sendMessage({ type: "connect", bridgeUrl });
	await refresh();
});

disconnectBtn.addEventListener("click", async () => {
	await chrome.runtime.sendMessage({ type: "disconnect" });
	await refresh();
});

// Permitir editar a URL MCP clicando no código
mcpUrlEl.addEventListener("click", async () => {
	const current = mcpUrlEl.getAttribute("data-value") || DEFAULT_MCP_URL;
	const input = prompt("URL MCP:", current);
	if (input && input.trim()) {
		await saveMcpUrl(input.trim());
		mcpUrlEl.textContent = input.trim();
		mcpUrlEl.setAttribute("data-value", input.trim());
		await navigator.clipboard.writeText(input.trim());
		copyBtn.textContent = "Copiado!";
		setTimeout(() => { copyBtn.textContent = "Copiar"; }, 1500);
	}
});

void refresh();

// Re-verifica status a cada 5s enquanto o popup estiver aberto
const interval = setInterval(refresh, 5000);
window.addEventListener("beforeunload", () => clearInterval(interval));
