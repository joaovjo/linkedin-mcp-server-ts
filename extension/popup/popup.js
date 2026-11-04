// src/popup/popup.ts
var statusEl = document.getElementById("status");
var urlEl = document.getElementById("url");
var connectBtn = document.getElementById("connect");
var disconnectBtn = document.getElementById("disconnect");
function render(connected, bridgeUrl) {
  statusEl.textContent = connected ? "Connected" : "Disconnected";
  statusEl.className = `status ${connected ? "connected" : "disconnected"}`;
  if (bridgeUrl)
    urlEl.textContent = bridgeUrl;
}
async function refresh() {
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
refresh();
