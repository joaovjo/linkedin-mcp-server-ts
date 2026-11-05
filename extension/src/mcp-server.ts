/* global chrome */
declare const chrome: any;

/**
 * MCP server embedded in the Chrome extension service worker.
 * Listens on a local TCP port and speaks the MCP protocol (JSON-RPC).
 * Tool calls are forwarded to the active LinkedIn tab's content script
 * and results are returned to the AI client.
 */

const MCP_PORT = 8000;
const MCP_HOST = "127.0.0.1";

const SERVER_NAME = "linkedin-mcp-bridge-extension";
const SERVER_VERSION = "0.1.0";

// Tool registry: name -> { handler, inputSchema, annotations }
const tools: Record<string, any> = {};

function registerTool(name: string, def: any): void {
	tools[name] = def;
}

// --- JSON-RPC helpers ---

function makeId(): string {
	return crypto.randomUUID();
}

function jsonRpcResult(id: any, result: any): string {
	return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: any, code: number, message: string): string {
	return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

// --- Tool execution ---

/**
 * Forward an extract request to the active LinkedIn tab content script.
 * Returns the extraction result.
 */
async function callExtract(target: string, params: Record<string, unknown> = {}): Promise<any> {
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

// --- Tool implementations ---

registerTool("get_person_profile", {
	inputSchema: {
		type: "object",
		properties: {
			linkedin_username: { type: "string" },
			sections: { type: "string" },
			max_scrolls: { type: "number" },
		},
		required: ["linkedin_username"],
	},
	annotations: { readOnlyHint: true, openWorldHint: true },
	handler: async (args: any) => {
		const data = await callExtract("person", { username: args.linkedin_username });
		const name = String(data.name ?? "");
		const headline = String(data.headline ?? "");
		const location = String(data.location ?? "");
		const about = String(data.about ?? "");
		const experience = Array.isArray(data.experience) ? data.experience : [];
		const sections: Record<string, string> = {};
		sections.profile = [name, headline, location, about].filter((p: string) => p.trim().length > 0).join("\n");
		sections.experience = experience.join("\n");
		return {
			url: data.profileUrl ?? data.url ?? "",
			sections,
		};
	},
});

registerTool("get_my_profile", {
	inputSchema: {
		type: "object",
		properties: {
			sections: { type: "string" },
			max_scrolls: { type: "number" },
		},
	},
	annotations: { readOnlyHint: true, openWorldHint: true },
	handler: async (args: any) => {
		const data = await callExtract("person", { username: "me" });
		const name = String(data.name ?? "");
		const headline = String(data.headline ?? "");
		const location = String(data.location ?? "");
		const about = String(data.about ?? "");
		const experience = Array.isArray(data.experience) ? data.experience : [];
		const sections: Record<string, string> = {};
		sections.profile = [name, headline, location, about].filter((p: string) => p.trim().length > 0).join("\n");
		sections.experience = experience.join("\n");
		return {
			url: data.profileUrl ?? data.url ?? "",
			sections,
		};
	},
});

registerTool("get_company_profile", {
	inputSchema: {
		type: "object",
		properties: {
			linkedin_username: { type: "string" },
			sections: { type: "string" },
		},
		required: ["linkedin_username"],
	},
	annotations: { readOnlyHint: true, openWorldHint: true },
	handler: async (args: any) => {
		const data = await callExtract("company", { username: args.linkedin_username });
		return { url: data.url ?? "", sections: data.sections ?? {} };
	},
});

registerTool("search_jobs", {
	inputSchema: {
		type: "object",
		properties: {
			keywords: { type: "string" },
			location: { type: "string" },
			max_pages: { type: "number" },
		},
		required: ["keywords"],
	},
	annotations: { readOnlyHint: true, openWorldHint: true },
	handler: async (args: any) => {
		const data = await callExtract("job", { keywords: args.keywords, location: args.location });
		return { url: data.url ?? "", job_ids: data.job_ids ?? [] };
	},
});

registerTool("get_job_details", {
	inputSchema: {
		type: "object",
		properties: {
			job_id: { type: "string" },
		},
		required: ["job_id"],
	},
	annotations: { readOnlyHint: true, openWorldHint: true },
	handler: async (args: any) => {
		const data = await callExtract("job", { job_id: args.job_id });
		return { url: data.url ?? "", sections: data.sections ?? {} };
	},
});

registerTool("get_inbox", {
	inputSchema: {
		type: "object",
		properties: {
			limit: { type: "number" },
		},
	},
	annotations: { readOnlyHint: true, openWorldHint: true },
	handler: async (args: any) => {
		const data = await callExtract("messaging", { type: "inbox", limit: args.limit });
		return { url: data.url ?? "", sections: data.sections ?? {} };
	},
});

registerTool("get_feed", {
	inputSchema: {
		type: "object",
		properties: {
			num_posts: { type: "number" },
		},
	},
	annotations: { readOnlyHint: true, openWorldHint: true },
	handler: async (args: any) => {
		const data = await callExtract("feed", { num_posts: args.num_posts });
		return { url: data.url ?? "", sections: data.sections ?? {} };
	},
});

registerTool("close_session", {
	inputSchema: { type: "object", properties: {} },
	annotations: { destructiveHint: true },
	handler: async () => {
		// No persistent session in extension; just acknowledge.
		return { status: "success", message: "Session cleared (extension has no persistent state)" };
	},
});

// --- MCP protocol handler ---

async function handleMcpMessage(message: any): Promise<any> {
	const { jsonrpc, id, method, params } = message;

	if (jsonrpc !== "2.0") {
		return { error: { code: -32600, message: "Invalid Request" } };
	}

	if (method === "initialize") {
		return {
			protocolVersion: "2025-03-26",
			capabilities: {
				tools: { listChanged: false },
			},
			serverInfo: {
				name: SERVER_NAME,
				version: SERVER_VERSION,
			},
			instructions:
				"LinkedIn MCP Bridge extension. Tools read from your authenticated LinkedIn browser session via content scripts.",
		};
	}

	if (method === "tools/list") {
		const list = Object.entries(tools).map(([name, def]) => ({
			name,
			description: def.description ?? "",
			inputSchema: def.inputSchema,
			annotations: def.annotations,
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
		} catch (err: any) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ error: err.message ?? String(err) }),
					},
				],
				isError: true,
			};
		}
	}

	if (method === "notifications/initialized") {
		return null;
	}

	return { error: { code: -32601, message: `Method not found: ${method}` } };
}

// --- TCP server ---

let serverSocketId: number | null = null;
const clientSockets: Set<number> = new Set();

async function startMcpServer(): Promise<void> {
	const result = await chrome.sockets.tcpServer.create({});
	if (!result.socketId) {
		console.error("[mcp-server] failed to create socket");
		return;
	}
	serverSocketId = result.socketId;

	await chrome.sockets.tcpServer.listen(serverSocketId, MCP_HOST, MCP_PORT, (result: any) => {
		if (result < 0) {
			console.error("[mcp-server] listen failed:", result);
		} else {
			console.error(`[mcp-server] listening on ${MCP_HOST}:${MCP_PORT}`);
		}
	});

	chrome.sockets.tcpServer.onAccept.addListener(async (info: any) => {
		if (!info.serverSocketId || info.serverSocketId !== serverSocketId) return;
		const clientId = info.clientSocketId;
		clientSockets.add(clientId);

		// Read loop
		let buffer = "";
		chrome.sockets.tcp.onReceive.addListener((recv: any) => {
			if (recv.socketId !== clientId) return;
			const chunk = new TextDecoder().decode(recv.data);
			buffer += chunk;

			// Process complete lines (JSON-RPC messages)
			let line: string;
			while ((line = buffer.split("\n")[0]) !== buffer) {
				buffer = buffer.slice(buffer.indexOf("\n") + 1);
				if (line.trim()) {
					void handleLine(clientId, line.trim());
				}
			}
		});

		chrome.sockets.tcp.onReceiveError.addListener((recv: any) => {
			if (recv.socketId === clientId) {
				clientSockets.delete(clientId);
				chrome.sockets.tcp.close(clientId);
			}
		});

		chrome.sockets.tcp.onClose.addListener((recv: any) => {
			if (recv.socketId === clientId) {
				clientSockets.delete(clientId);
			}
		});
	});
}

async function handleLine(socketId: number, line: string): Promise<void> {
	let message: any;
	try {
		message = JSON.parse(line);
	} catch {
		const err = jsonRpcError(null, -32700, "Parse error");
		sendRaw(socketId, err + "\n");
		return;
	}

	if (!message || !("jsonrpc" in message)) {
		const err = jsonRpcError(null, -32600, "Invalid Request");
		sendRaw(socketId, err + "\n");
		return;
	}

	const response = await handleMcpMessage(message);

	// notifications/initialized has no response
	if (response === null) return;

	const id = message.id ?? null;
	const payload = response.error ? jsonRpcError(id, response.error.code, response.error.message) : jsonRpcResult(id, response.result);
	sendRaw(socketId, payload + "\n");
}

function sendRaw(socketId: number, data: string): void {
	const encoder = new TextEncoder();
	chrome.sockets.tcp.send(socketId, encoder.encode(data), () => {
		// ignore send errors
	});
}

async function stopMcpServer(): Promise<void> {
	if (serverSocketId !== null) {
		try {
			chrome.sockets.tcpServer.close(serverSocketId);
		} catch {
			// ignore
		}
		serverSocketId = null;
	}
	for (const id of clientSockets) {
		try {
			chrome.sockets.tcp.close(id);
		} catch {
			// ignore
		}
	}
	clientSockets.clear();
}

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener(() => {
	void startMcpServer();
});

chrome.runtime.onStartup.addListener(() => {
	void startMcpServer();
});

// Start immediately if service worker is already alive
void startMcpServer();

export { registerTool };
