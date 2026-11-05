// src/mcp-server.ts
var MCP_PORT = 8000;
var MCP_HOST = "127.0.0.1";
var SERVER_NAME = "linkedin-mcp-bridge-extension";
var SERVER_VERSION = "0.1.0";
var tools = {};
function registerTool(name, def) {
  tools[name] = def;
}
function jsonRpcResult(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}
function jsonRpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}
async function callExtract(target, params = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab");
  }
  const result = await chrome.tabs.sendMessage(tab.id, { type: "extract", target, params });
  if (!result?.ok) {
    throw new Error(result?.error ?? `Extraction failed for ${target}`);
  }
  return result.data ?? result;
}
registerTool("get_person_profile", {
  inputSchema: {
    type: "object",
    properties: {
      linkedin_username: { type: "string" },
      sections: { type: "string" },
      max_scrolls: { type: "number" }
    },
    required: ["linkedin_username"]
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (args) => {
    const data = await callExtract("person", { username: args.linkedin_username });
    const name = String(data.name ?? "");
    const headline = String(data.headline ?? "");
    const location = String(data.location ?? "");
    const about = String(data.about ?? "");
    const experience = Array.isArray(data.experience) ? data.experience : [];
    const sections = {};
    sections.profile = [name, headline, location, about].filter((p) => p.trim().length > 0).join(`
`);
    sections.experience = experience.join(`
`);
    return {
      url: data.profileUrl ?? data.url ?? "",
      sections
    };
  }
});
registerTool("get_my_profile", {
  inputSchema: {
    type: "object",
    properties: {
      sections: { type: "string" },
      max_scrolls: { type: "number" }
    }
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (args) => {
    const data = await callExtract("person", { username: "me" });
    const name = String(data.name ?? "");
    const headline = String(data.headline ?? "");
    const location = String(data.location ?? "");
    const about = String(data.about ?? "");
    const experience = Array.isArray(data.experience) ? data.experience : [];
    const sections = {};
    sections.profile = [name, headline, location, about].filter((p) => p.trim().length > 0).join(`
`);
    sections.experience = experience.join(`
`);
    return {
      url: data.profileUrl ?? data.url ?? "",
      sections
    };
  }
});
registerTool("get_company_profile", {
  inputSchema: {
    type: "object",
    properties: {
      linkedin_username: { type: "string" },
      sections: { type: "string" }
    },
    required: ["linkedin_username"]
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (args) => {
    const data = await callExtract("company", { username: args.linkedin_username });
    return { url: data.url ?? "", sections: data.sections ?? {} };
  }
});
registerTool("search_jobs", {
  inputSchema: {
    type: "object",
    properties: {
      keywords: { type: "string" },
      location: { type: "string" },
      max_pages: { type: "number" }
    },
    required: ["keywords"]
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (args) => {
    const data = await callExtract("job", { keywords: args.keywords, location: args.location });
    return { url: data.url ?? "", job_ids: data.job_ids ?? [] };
  }
});
registerTool("get_job_details", {
  inputSchema: {
    type: "object",
    properties: {
      job_id: { type: "string" }
    },
    required: ["job_id"]
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (args) => {
    const data = await callExtract("job", { job_id: args.job_id });
    return { url: data.url ?? "", sections: data.sections ?? {} };
  }
});
registerTool("get_inbox", {
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number" }
    }
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (args) => {
    const data = await callExtract("messaging", { type: "inbox", limit: args.limit });
    return { url: data.url ?? "", sections: data.sections ?? {} };
  }
});
registerTool("get_feed", {
  inputSchema: {
    type: "object",
    properties: {
      num_posts: { type: "number" }
    }
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (args) => {
    const data = await callExtract("feed", { num_posts: args.num_posts });
    return { url: data.url ?? "", sections: data.sections ?? {} };
  }
});
registerTool("close_session", {
  inputSchema: { type: "object", properties: {} },
  annotations: { destructiveHint: true },
  handler: async () => {
    return { status: "success", message: "Session cleared (extension has no persistent state)" };
  }
});
async function handleMcpMessage(message) {
  const { jsonrpc, id, method, params } = message;
  if (jsonrpc !== "2.0") {
    return { error: { code: -32600, message: "Invalid Request" } };
  }
  if (method === "initialize") {
    return {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: { listChanged: false }
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION
      },
      instructions: "LinkedIn MCP Bridge extension. Tools read from your authenticated LinkedIn browser session via content scripts."
    };
  }
  if (method === "tools/list") {
    const list = Object.entries(tools).map(([name, def]) => ({
      name,
      description: def.description ?? "",
      inputSchema: def.inputSchema,
      annotations: def.annotations
    }));
    return { tools: list };
  }
  if (method === "tools/call") {
    const { name, arguments: callArgs } = params ?? {};
    const def = tools[name];
    if (!def) {
      return { error: { code: -32601, message: `Method not found: ${name}` } };
    }
    try {
      const result = await def.handler(callArgs ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: err.message ?? String(err) })
          }
        ],
        isError: true
      };
    }
  }
  if (method === "notifications/initialized") {
    return null;
  }
  return { error: { code: -32601, message: `Method not found: ${method}` } };
}
var serverSocketId = null;
var clientSockets = new Set;
async function startMcpServer() {
  const result = await chrome.sockets.tcpServer.create({});
  if (!result.socketId) {
    console.error("[mcp-server] failed to create socket");
    return;
  }
  serverSocketId = result.socketId;
  await chrome.sockets.tcpServer.listen(serverSocketId, MCP_HOST, MCP_PORT, (result) => {
    if (result < 0) {
      console.error("[mcp-server] listen failed:", result);
    } else {
      console.error(`[mcp-server] listening on ${MCP_HOST}:${MCP_PORT}`);
    }
  });
  chrome.sockets.tcpServer.onAccept.addListener(async (info) => {
    if (!info.serverSocketId || info.serverSocketId !== serverSocketId)
      return;
    const clientId = info.clientSocketId;
    clientSockets.add(clientId);
    let buffer = "";
    chrome.sockets.tcp.onReceive.addListener((recv) => {
      if (recv.socketId !== clientId)
        return;
      const chunk = new TextDecoder().decode(recv.data);
      buffer += chunk;
      let line;
      while ((line = buffer.split(`
`)[0]) !== buffer) {
        buffer = buffer.slice(buffer.indexOf(`
`) + 1);
        if (line.trim()) {
          handleLine(clientId, line.trim());
        }
      }
    });
    chrome.sockets.tcp.onReceiveError.addListener((recv) => {
      if (recv.socketId === clientId) {
        clientSockets.delete(clientId);
        chrome.sockets.tcp.close(clientId);
      }
    });
    chrome.sockets.tcp.onClose.addListener((recv) => {
      if (recv.socketId === clientId) {
        clientSockets.delete(clientId);
      }
    });
  });
}
async function handleLine(socketId, line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    const err = jsonRpcError(null, -32700, "Parse error");
    sendRaw(socketId, err + `
`);
    return;
  }
  if (!message || !("jsonrpc" in message)) {
    const err = jsonRpcError(null, -32600, "Invalid Request");
    sendRaw(socketId, err + `
`);
    return;
  }
  const response = await handleMcpMessage(message);
  if (response === null)
    return;
  const id = message.id ?? null;
  const payload = response.error ? jsonRpcError(id, response.error.code, response.error.message) : jsonRpcResult(id, response.result);
  sendRaw(socketId, payload + `
`);
}
function sendRaw(socketId, data) {
  const encoder = new TextEncoder;
  chrome.sockets.tcp.send(socketId, encoder.encode(data), () => {});
}
chrome.runtime.onInstalled.addListener(() => {
  startMcpServer();
});
chrome.runtime.onStartup.addListener(() => {
  startMcpServer();
});
startMcpServer();

// src/background.ts
var DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8765";
var STORAGE_KEYS = {
  mcpUrl: "popupMcpUrl",
  bridgeUrl: "popupBridgeUrl",
  lastConnectedAt: "lastConnectedAt"
};
var socket = null;
var reconnectTimer = null;
async function getBridgeUrl() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.bridgeUrl);
  return stored?.[STORAGE_KEYS.bridgeUrl] ?? DEFAULT_BRIDGE_URL;
}
async function setConnected(connected) {
  await chrome.storage.local.set({
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
  try {
    socket = new WebSocket(url);
  } catch {
    await setConnected(false);
    scheduleReconnect();
    return;
  }
  socket.addEventListener("open", () => {
    setConnected(true);
  });
  socket.addEventListener("close", () => {
    socket = null;
    setConnected(false);
    scheduleReconnect();
  });
  socket.addEventListener("error", () => {
    setConnected(false);
  });
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message;
  if (!msg?.type)
    return false;
  (async () => {
    try {
      switch (msg.type) {
        case "get_status": {
          const state = await chrome.storage.local.get([
            STORAGE_KEYS.lastConnectedAt
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
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "bridge-reconnect") {
    connectBridge();
  }
});
export {
  disconnectBridge
};
