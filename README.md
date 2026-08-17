# linkedin-mcp-server-ts

MCP server for LinkedIn scraping/automation — TypeScript + Bun port of [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server).

**Stack:** Bun runtime · `Bun.WebView` (Chrome backend + CDP) · `@modelcontextprotocol/server` v2 · Zod v4 · TypeScript 6

## Install

```bash
bun install
```

Requires a local Chrome/Edge/Chromium for the WebView Chrome backend and for `--login`.

## Quick start

```bash
# Interactive login (spawns Chrome with remote debugging, saves cookies.json)
bun run src/index.ts --login

# MCP over stdio (Cursor / Claude Desktop)
bun run src/index.ts --transport stdio

# MCP over Streamable HTTP
bun run src/index.ts --transport streamable-http --port 8000
```

### Cursor / Claude config (stdio)

```json
{
  "mcpServers": {
    "mcp-server-linkedin": {
      "command": "bun",
      "args": ["run", "D:/linkedin/linkedin-mcp-server-ts/src/index.ts", "--transport", "stdio"]
    }
  }
}
```

## CLI

| Flag | Effect |
|------|--------|
| `--login` | Headed Chrome + DevTools attach; persist session |
| `--logout` | Clear `cookies.json` / `source-state.json` |
| `--status` | Validate session (exit 0/1) |
| `--import-from-browser` | Re-validate cookies from disk |
| `--transport stdio\|streamable-http` | MCP transport |
| `--user-data-dir` | Profile root (default `~/.linkedin-mcp/profile`) |
| `--chrome-path` | Chrome/Edge binary |
| `--debug-port` | Remote debugging port for login (default 9222) |

## Tools (19)

`get_person_profile`, `get_my_profile`, `search_people`, `connect_with_person`, `get_sidebar_profiles`, `get_company_profile`, `get_company_posts`, `search_companies`, `get_company_employees`, `get_job_details`, `search_jobs`, `get_saved_jobs`, `search_posts`, `get_feed`, `get_inbox`, `get_conversation`, `search_conversations`, `send_message`, `close_session`

Person profiles use section key `main_profile` (parity with upstream Python).

## Session files

Under `~/.linkedin-mcp/`:

- `profile/bun-webview` — WebView `dataStore`
- `cookies.json` — portable cookie export
- `source-state.json` — login generation metadata

## Scripts

```bash
bun run src/index.ts          # serve (transport from env/TTY)
bun run login                 # same as --login
bun test                      # contract tests
```

## Paridade útil ~100%

Critério: um agente que já usa o Python continua a chamar as mesmas tools/args e a ler os mesmos campos-chave (`url`, `sections`, `references` com `kind` + URL relativa + `value?`, `profile_urn` / `company_urn` / `job_ids`, `section_errors` tipados, statuses de connect/send).

Fora do escopo útil (infra): Docker bridge, update-check PyPI, diagnostics completos de issue tracker, auto-import decrypt do Chrome, locale-perfect Accept DE.

### Smoke checklist (Chrome attach `:9222`)

Pré-requisito: Chrome com remote debugging (DevToolsActivePort) e sessão autenticada (`bun run src/index.ts --status` → authenticated).

| # | Tool | Esperado |
|---|------|----------|
| 1 | `get_person_profile` (+ `sections=experience`) | `sections.main_profile`, `references` tipadas, `profile_urn` quando Message existe |
| 2 | `get_company_profile` | `sections.about` via `/about/`, `company_urn` / refs `kind:"company_urn"` |
| 3 | `search_jobs` | `job_ids.length > 0`, refs `kind:"job"` com URL relativa; filtros mapeados (`f_EA`) |
| 4 | `get_saved_jobs` | `job_ids`, `sections.saved_jobs` |
| 5 | `get_feed` | refs `feed_post` relativos `/feed/update/…` ou `/posts/…` |
| 6 | `get_inbox` | refs `kind:"conversation"` via click-and-capture |
| 7 | `send_message` (`confirm_send=false`) | status `confirmation_required`, **sem** digitar |

Extras: `search_people` com `location=`, `get_conversation` por username/thread_id, connect com campo `profile`.

```bash
bun test   # contrato: 19 tools, kinds, filters, section_errors, statuses
```

## Notes

- `Bun.WebView` only supports `headless: true`; interactive login attaches to a spawned Chrome via CDP.
- Force Chrome backend (`backend: "chrome"`) for CDP Network/cookies.
- Attach preferencial via `DevToolsActivePort` quando `/json/version` retorna 404.
- API is experimental in Bun — pin your Bun version in production.
