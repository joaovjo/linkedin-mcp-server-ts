# LinkedIn MCP Server - TypeScript 6.x & Bun

## Overview

TypeScript/Bun reimplementation of [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server) targeting useful MCP parity (same tools, schemas, envelopes, CLI/auth/transports).

## Stack

- Runtime: Bun 1.x
- Language: TypeScript 6
- MCP: `@modelcontextprotocol/server` v2 + Zod v4
- Browser: `Bun.WebView` Chrome backend + CDP (`view.cdp`)
- Login: `Bun.spawn` Chrome with remote debugging, then WebView attach

## Architecture

- `src/index.ts` — CLI + stdio / Streamable HTTP
- `src/mcp/create-server.ts` — `McpServer` factory (18 tools)
- `src/browser/manager.ts` — WebView singleton
- `src/browser/auth.ts` / `chrome-launch.ts` / `cdp.ts` — session lifecycle
- `src/session/store.ts` — cookies.json + source-state.json
- `src/tools/*` — domain tools
- `src/scraping/*` — extraction helpers

## Parity notes

- Person section key: `main_profile`
- Includes `search_posts` and `close_session`
- Default transport: stdio when non-TTY
