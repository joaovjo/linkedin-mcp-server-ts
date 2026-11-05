// src/popup/popup.ts
var statusEl = document.getElementById("status");
var mcpUrlEl = document.getElementById("mcpUrl");
var copyBtn = document.getElementById("copyUrl");
var connectBtn = document.getElementById("connect");
var disconnectBtn = document.getElementById("disconnect");
var bridgeUrlEl = document.getElementById("bridgeUrl");
var bridgeHintEl = document.getElementById("bridgeHint");
var DEFAULT_MCP_URL = "http://127.0.0.1:8000/mcp";
var DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";
var STORAGE_KEYS = {
  mcpUrl: "popupMcpUrl",
  bridgeUrl: "popupBridgeUrl"
};
function render(connected, bridgeUrl, mcpUrl) {
  statusEl.textContent = connected ? "Conectado" : "Desconectado";
  statusEl.className = `status ${connected ? "connected" : "disconnected"}`;
  if (bridgeUrl)
    bridgeUrlEl.textContent = bridgeUrl;
  else
    bridgeUrlEl.textContent = DEFAULT_BRIDGE_URL;
  if (mcpUrl) {
    mcpUrlEl.textContent = mcpUrl;
    mcpUrlEl.setAttribute("data-value", mcpUrl);
  } else {
    mcpUrlEl.textContent = DEFAULT_MCP_URL;
    mcpUrlEl.setAttribute("data-value", DEFAULT_MCP_URL);
  }
  bridgeHintEl.innerHTML = connected ? "Servidor MCP embutido na extensão está ativo. A URL acima está pronta para uso na IA." : "O servidor MCP está embutido nesta extensão. Clique em Conectar para ativar o bridge e usar a URL MCP acima na sua IA.";
}
async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: "get_status" });
  const connected = Boolean(response?.bridgeConnected);
  const bridgeUrl = response?.bridgeUrl || undefined;
  const stored = await chrome.storage.local.get([STORAGE_KEYS.mcpUrl, STORAGE_KEYS.bridgeUrl]);
  const mcpUrl = stored?.[STORAGE_KEYS.mcpUrl] || undefined;
  render(connected, bridgeUrl, mcpUrl);
}
async function saveMcpUrl(url) {
  await chrome.storage.local.set({ [STORAGE_KEYS.mcpUrl]: url });
}
async function saveBridgeUrl(url) {
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
mcpUrlEl.addEventListener("click", async () => {
  const current = mcpUrlEl.getAttribute("data-value") || DEFAULT_MCP_URL;
  const input = prompt("URL MCP:", current);
  if (input && input.trim()) {
    await saveMcpUrl(input.trim());
    mcpUrlEl.textContent = input.trim();
    mcpUrlEl.setAttribute("data-value", input.trim());
    await navigator.clipboard.writeText(input.trim());
    copyBtn.textContent = "Copiado!";
    setTimeout(() => {
      copyBtn.textContent = "Copiar";
    }, 1500);
  }
});
refresh();
var interval = setInterval(refresh, 5000);
window.addEventListener("beforeunload", () => clearInterval(interval));
