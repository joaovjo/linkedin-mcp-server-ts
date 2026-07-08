# Sprint 0 — Foundation & Scaffolding

## Goal

Stand up a TypeScript 6.0 + Bun reimplementation of `mcp-server-linkedin` with
the MCP Streamable HTTP transport working end-to-end and all 16 tool stubs
registered.

## What was done

### Project init

- Bun 1.3.14 project at `D:\linkedin-mcp-server-ts`
- `tsconfig.json` targeting ES2024 / `bundler` module
- Dependencies: `@modelcontextprotocol/sdk@1.29.0`
- Directory structure: `src/{config,errors,browser,middleware,tools,utils,index,server,login}.ts`

### Core modules

| Module | Purpose |
|---|---|
| `config.ts` | CLI args / env parsing; `--port`, `--transport`, `--log-level`, `--no-headless` |
| `errors/types.ts` | Error hierarchy: `LinkedInScraperError` → `AuthenticationError`, `ToolError`, etc. |
| `errors/handler.ts` | `raiseToolError()` — maps JS errors to MCP `content[0].isError` responses |
| `browser/types.ts` | Interfaces: `BrowserManager`, `BrowserConfig`, `AuthState` |
| `browser/manager.ts` | `BrowserManager` — lazy `Bun.WebView` singleton with `ensureReady()`, `close()` |
| `browser/auth.ts` | Stub `loginIfNeeded()` — no-op awaiting Sprint 1 |
| `middleware/serialization.ts` | `SerializationQueue` — serializes tool calls to avoid race conditions |
| `server.ts` | Single `WebStandardStreamableHTTPServerTransport` + `Server` pair; stateful sessions |
| `index.ts` | `Bun.serve()` HTTP server, `/mcp` route, SIGINT/SIGTERM cleanup |

### MCP transport

- **Stateful mode** with `sessionIdGenerator: () => crypto.randomUUID()`
- Single transport instance created at startup, reused across all requests
- Initialize → 200 with session ID in `mcp-session-id` header
- Tools/list → 200 with 16 stubbed tool definitions (see below)
- Session validation via `mcp-session-id` header on subsequent requests

### Tool stubs — VERIFIED

All 16 tools from the Python original are stubbed in `src/tools/` and confirmed
returned by `tools/list` (via MCP over Streamable HTTP):

| File | Tools |
|---|---|
| `person.ts` | `get_person_profile`, `search_people`, `connect_with_person`, `get_sidebar_profiles`, `get_my_profile` |
| `company.ts` | `get_company_profile`, `get_company_posts`, `search_companies`, `get_company_employees` |
| `job.ts` | `get_job_details`, `search_jobs` |
| `messaging.ts` | `get_inbox`, `get_conversation`, `search_conversations`, `send_message` |
| `feed.ts` | `get_feed` |

Every handler returns `raiseToolError(new Error("Not implemented (Sprint 1+)"))`.

### Known blockers

1. **Bun.WebView / Chrome**: `Bun.WebView` constructor throws on this Windows
   machine — no Chrome/Chromium binary found anywhere on PATH. The
   `~/.linkedin-mcp/profile/` cookie data exists in `ms-playwright` cache.
   - Option A: `bunx playwright install chromium` (downloads Chromium)
   - Option B: Fall back to Playwright driver (we already have its data)
   - Decision deferred to Sprint 1.

2. **Test workflow**: `Invoke-WebRequest` in PowerShell returns `Collection<string>`
   for `Headers['mcp-session-id']` — must cast with `[string]` before passing
   to subsequent requests. Use `curl -D` for reliable header capture.

### Testing without browser

Stubs let us test the MCP lifecycle without any browser:

```powershell
# Start server
uv run -m linkedin_mcp_server --transport streamable-http --log-level DEBUG

# Initialize
curl -s -D headers.txt -X POST http://localhost:8000/mcp `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Parse session ID
$SESSION_ID = (Get-Content headers.txt | Select-String -Pattern 'mcp-session-id: (.+)' | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()

# List tools
curl -s -X POST http://localhost:8000/mcp `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  -H "Mcp-Session-Id: $SESSION_ID" `
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

### Current Status

✅ **Sprint 0 complete** — MCP transport works, all 16 tools registered.
Ready for Sprint 1 (browser automation + scraping + tool implementation).

## Pending for Sprint 1

1. Browser automation: Install Chrome or adopt Playwright driver  
   (Bun.WebView needs a Chrome binary on Windows — fallback: `bunx playwright install chromium`)
2. Authenticate session: `--login` flow via `browser/auth.ts`
3. Port `linkedin_mcp_server/scraping/*` extractors one section at a time
4. Implement each tool handler (connect to scraping engine)
5. Write tests (`uv run pytest`)
