// src/logger.ts
function log(level, event, fields = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
var logger = {
  info(event, fields) {
    log("info", event, fields);
  },
  warn(event, fields) {
    log("warn", event, fields);
  },
  error(event, fields) {
    log("error", event, fields);
  }
};

// src/background.ts
var DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";
var STORAGE_KEYS = {
  mcpUrl: "popupMcpUrl",
  bridgeUrl: "popupBridgeUrl",
  lastConnectedAt: "lastConnectedAt"
};
var BRIDGE_UNREACHABLE_MSG = "bridge unreachable — is bun run src/index.ts running?";
var socket = null;
var reconnectTimer = null;
var connId = null;
var connectStartedAt = 0;
function newConnId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `conn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}
async function getBridgeUrl() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.bridgeUrl);
  return stored?.[STORAGE_KEYS.bridgeUrl] ?? DEFAULT_BRIDGE_URL;
}
async function setConnected(connected) {
  await chrome.storage.local.set({
    bridgeConnected: connected,
    [STORAGE_KEYS.lastConnectedAt]: connected ? Date.now() : undefined
  });
}
function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
function scheduleReconnect() {
  clearReconnect();
  reconnectTimer = setTimeout(() => {
    connectBridge();
  }, 3000);
}
async function connectBridge() {
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
      msg: BRIDGE_UNREACHABLE_MSG
    });
    await setConnected(false);
    scheduleReconnect();
    return;
  }
  socket.addEventListener("open", () => {
    const latency_ms = Date.now() - connectStartedAt;
    logger.info("connect_open", { url, conn_id: connId, latency_ms });
    setConnected(true);
  });
  socket.addEventListener("message", (event) => {
    handleBridgeMessage(String(event.data ?? ""));
  });
  socket.addEventListener("close", (event) => {
    logger.info("connect_close", {
      url,
      conn_id: connId,
      code: event.code,
      reason: event.reason || undefined
    });
    socket = null;
    setConnected(false);
    scheduleReconnect();
  });
  socket.addEventListener("error", (event) => {
    logger.error("connect_error", {
      url,
      conn_id: connId,
      error: event.message ?? "WebSocket error",
      msg: BRIDGE_UNREACHABLE_MSG
    });
    setConnected(false);
  });
}
async function handleBridgeMessage(raw) {
  let message = null;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (!message)
    return;
  if (message.type === "ping") {
    socket?.send(JSON.stringify({ type: "pong", id: message.id }));
    return;
  }
  if (message.type === "extract" && message.target) {
    const reqId = message.id;
    const target = message.target;
    logger.info("extract_request", { reqId, target, conn_id: connId });
    const extractStartedAt = Date.now();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs?.[0];
    if (!tab?.id) {
      const error = "No active tab";
      logger.error("extract_error", { reqId, target, error, conn_id: connId });
      socket?.send(JSON.stringify({
        id: message.id,
        type: "extract_result",
        target: message.target,
        ok: false,
        error
      }));
      return;
    }
    try {
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "extract",
        target: message.target,
        params: message.params
      });
      const latency_ms = Date.now() - extractStartedAt;
      logger.info("extract_success", { reqId, target, latency_ms, conn_id: connId });
      socket?.send(JSON.stringify({ id: message.id, ...result }));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error("extract_error", { reqId, target, error, conn_id: connId });
      socket?.send(JSON.stringify({
        id: message.id,
        type: "extract_result",
        target: message.target,
        ok: false,
        error
      }));
    }
  }
}
function disconnectBridge() {
  clearReconnect();
  if (socket) {
    try {
      socket.close();
    } catch {}
    socket = null;
  }
  setConnected(false);
}
logger.info("extension_sw_started", { bridgeUrl: DEFAULT_BRIDGE_URL });
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(STORAGE_KEYS.bridgeUrl).then((stored) => {
    if (!stored?.[STORAGE_KEYS.bridgeUrl]) {
      return chrome.storage.local.set({ [STORAGE_KEYS.bridgeUrl]: DEFAULT_BRIDGE_URL });
    }
    return;
  });
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message;
  if (!msg?.type)
    return false;
  (async () => {
    try {
      switch (msg.type) {
        case "get_status": {
          const state = await chrome.storage.local.get([
            STORAGE_KEYS.lastConnectedAt,
            "bridgeConnected",
            STORAGE_KEYS.bridgeUrl
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
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "bridge-reconnect") {
    connectBridge();
  }
});
export {
  disconnectBridge
};
