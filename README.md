# LinkedIn MCP Server (TypeScript / Bun)

<p align="left">
  <a href="https://www.npmjs.com/package/linkedin-mcp-server-ts" target="_blank"><img src="https://img.shields.io/npm/v/linkedin-mcp-server-ts?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://bun.sh" target="_blank"><img src="https://img.shields.io/badge/Runtime-Bun%201.2+-fbf0df?logo=bun&logoColor=black" alt="Bun Runtime"></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/Language-TypeScript%207-3178c6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://modelcontextprotocol.io/" target="_blank"><img src="https://img.shields.io/badge/MCP-SDK%202.0-8a2be2" alt="Model Context Protocol"></a>
  <a href="https://github.com/joaovjo/linkedin-mcp-server-ts/blob/main/LICENSE" target="_blank"><img src="https://img.shields.io/badge/License-MIT-3fb950" alt="License: MIT"></a>
  <a href="https://biomejs.dev" target="_blank"><img src="https://img.shields.io/badge/Linter-Biome-60a5fa?logo=biome&logoColor=white" alt="Biome"></a>
</p>

> **Disclaimer:** This is an independent open-source project. It is not affiliated with, sponsored by, or endorsed by LinkedIn Corporation or Microsoft Corporation. "LinkedIn" is a registered trademark of LinkedIn Corporation and is used purely descriptively.

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for LinkedIn scraping and automation, written in TypeScript and executed directly on [Bun](https://bun.sh).

It gives AI assistants (Claude Desktop, Cursor, OpenCode, VS Code, Windsurf, Antigravity) 19 MCP tools to inspect profiles, search jobs and companies, manage messages, and fetch feed updates through your existing authenticated browser session.

---

## Why TypeScript + Bun

`linkedin-mcp-server-ts` is a native TypeScript port of [`stickerdaniel/linkedin-mcp-server`](https://github.com/stickerdaniel/linkedin-mcp-server). Moving from Python to Bun reduced baseline memory usage and removed the need for separate browser daemon layers.

- **Fast startup:** Bun executes TypeScript directly without build steps or transpilation passes.
- **Direct CDP communication:** connects directly to Chromium instances via Chrome DevTools Protocol and `Bun.WebView`.
- **Full schema parity:** matching tool signatures, Zod validation schemas, and JSON envelope output corresponding to the original Python server.
- **Shared session storage:** reads and writes cookies to `~/.linkedin-mcp/profile` for complete interoperability.

### Architecture Comparison

| Feature | Python Version (`mcp-server-linkedin`) | TypeScript / Bun Version (`linkedin-mcp-server-ts`) |
| :--- | :--- | :--- |
| **Runtime** | Python 3.10+ (`uv` / `uvx`) | Bun 1.2+ (`bun` / `bunx`) |
| **Language** | Python (`fastmcp`) | TypeScript 5.8+ (`@modelcontextprotocol/server` v2) |
| **Browser Engine** | Patchright Chromium fork | Native `Bun.WebView` + Direct Chrome DevTools Protocol (CDP) |
| **Memory Baseline** | ~150MB+ | ~30-60MB |
| **Transports** | `stdio`, `streamable-http` | `stdio`, `streamable-http` (via native `Bun.serve`) |
| **Session Directory** | `~/.linkedin-mcp/profile` | `~/.linkedin-mcp/profile` (Shared & Interoperable) |
| **Validation** | Pydantic | Zod schemas |
| **Tool Count** | 19 tools | 19 tools |

---

## Available MCP Tools (19 Tools)

| Tool | Category | Description | Access |
| :--- | :--- | :--- | :--- |
| `get_person_profile` | People | Extract profile details with granular sections (experience, education, skills, projects, certifications, posts) | Read-Only |
| `get_my_profile` | People | Extract the authenticated user's own profile | Read-Only |
| `search_people` | People | Search people by keywords, location, connection degree (`F`=1st, `S`=2nd, `O`=3rd+), and current company | Read-Only |
| `connect_with_person` | People | Send a connection invitation or accept an incoming request with an optional note | Write / Action |
| `get_sidebar_profiles` | People | Extract sidebar recommendations ("People you may know", "More profiles") | Read-Only |
| `get_company_profile` | Company | Extract company details, about section, posts, jobs, and numeric URN IDs | Read-Only |
| `get_company_posts` | Company | Retrieve recent company feed posts | Read-Only |
| `search_companies` | Company | Search companies by keyword | Read-Only |
| `get_company_employees` | Company | List company employees from the `/people/` tab with optional filters | Read-Only |
| `get_job_details` | Jobs | Fetch full job descriptions, criteria, and company metadata | Read-Only |
| `search_jobs` | Jobs | Search jobs by keywords, location, date posted, job type, work type, and easy apply | Read-Only |
| `get_saved_jobs` | Jobs | Retrieve the authenticated user's saved job listings | Read-Only |
| `get_inbox` | Messaging | List recent conversation threads from the messaging inbox | Read-Only |
| `get_conversation` | Messaging | Read messages from a thread by username or `thread_id` | Read-Only |
| `search_conversations` | Messaging | Search messaging threads by keyword | Read-Only |
| `send_message` | Messaging | Send a LinkedIn direct message (requires `confirm_send: true` confirmation) | Write / Action |
| `get_feed` | Feed | Retrieve recent posts from your home timeline | Read-Only |
| `search_posts` | Feed | Global search across LinkedIn posts with recency filters | Read-Only |
| `close_session` | Session | Terminate the browser session and release background process handles | Write / Action |

---

## Quickstart

### Prerequisites

1. **Install [Bun](https://bun.sh)** (v1.2 or higher):
   ```powershell
   # Windows (PowerShell)
   powershell -c "irm bun.sh/install.ps1 | iex"

   # macOS / Linux
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Google Chrome or Chromium**: installed on the host system.

### One-Command Execution (`bunx`)

Run the server directly without cloning or manual builds:

```bash
bunx linkedin-mcp-server-ts
```

### Local Clone & Development Setup

```bash
# Clone the repository
git clone https://github.com/joaovjo/linkedin-mcp-server-ts.git
cd linkedin-mcp-server-ts

# Install dependencies
bun install

# Start in stdio mode (default for MCP clients)
bun run start

# Start in HTTP mode (for web MCP debugging)
bun run dev
```

---

## MCP Client Configuration

### 1. Claude Desktop

Add to `claude_desktop_config.json`:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "bunx",
      "args": ["linkedin-mcp-server-ts"]
    }
  }
}
```

*When running from a local checkout:*

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "bun",
      "args": ["run", "src/index.ts"],
      "cwd": "D:/linkedin/linkedin-mcp-server-ts"
    }
  }
}
```

---

### 2. Cursor

Add to your project's `.cursor/mcp.json` or Global Settings:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "bunx",
      "args": ["linkedin-mcp-server-ts"]
    }
  }
}
```

---

### 3. OpenCode

Add to `opencode.json` (or `~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "linkedin": {
      "type": "stdio",
      "command": "bunx",
      "args": ["linkedin-mcp-server-ts"]
    }
  }
}
```

---

### 4. Antigravity / Windsurf / VS Code (Cline / Roo Code)

Add to `mcp_config.json`:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "bunx",
      "args": ["linkedin-mcp-server-ts"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

### 5. Streamable HTTP Mode

Expose the server over HTTP for remote agents or container setups:

```bash
bun run src/index.ts --transport streamable-http --host 127.0.0.1 --port 8000
```

- **MCP Route**: `http://127.0.0.1:8000/mcp`
- **Healthcheck**: `http://127.0.0.1:8000/health`

---

## Authentication & Session Management

The server uses a persistent browser profile at `~/.linkedin-mcp/profile` to preserve cookies between runs.

### Option A: Auto-Import from Local Browser (Fastest)

If you are already logged in to LinkedIn on Chrome, Brave, Edge, Arc, or Vivaldi, import the cookies directly:

```bash
# Auto-detect the most recent browser session
bunx linkedin-mcp-server-ts --import-from-browser

# Target a specific browser
bunx linkedin-mcp-server-ts --import-from-browser brave
bunx linkedin-mcp-server-ts --import-from-browser chrome
bunx linkedin-mcp-server-ts --import-from-browser edge
```

### Option B: Interactive Visual Login

Open an interactive browser window to log in:

```bash
bunx linkedin-mcp-server-ts --login
# Or from local source:
bun run login
```

1. Chrome opens the LinkedIn login page.
2. Complete login (including 2FA or security challenges if prompted).
3. Once the feed loads, the server saves the session cookies and exits.

### Check Session Status

```bash
bunx linkedin-mcp-server-ts --status
# Or from local source:
bun run status
```

### Logout & Clear Session

```bash
bunx linkedin-mcp-server-ts --logout
# Or from local source:
bun run logout
```

---

## Configuration & Environment Variables

Configure settings via CLI flags or a `.env` file in the workspace root:

| Variable | CLI Flag | Default | Description |
| :--- | :--- | :--- | :--- |
| `USER_DATA_DIR` | `--user-data-dir` | `~/.linkedin-mcp/profile` | Path to persistent browser profile directory |
| `HEADLESS` | `--headless` / `--no-headless` | `true` | Run browser in headless mode |
| `TRANSPORT` | `--transport` | `stdio` | Transport protocol: `stdio` or `streamable-http` |
| `HOST` | `--host` | `127.0.0.1` | HTTP bind host |
| `PORT` | `--port` | `8000` | HTTP port |
| `HTTP_PATH` | `--path` | `/mcp` | HTTP endpoint path |
| `TIMEOUT` | `--timeout` | `5000` | DOM navigation/interaction timeout (ms) |
| `TOOL_TIMEOUT` | `--tool-timeout` | `180` | Per-tool MCP execution timeout (seconds) |
| `LOGIN_TIMEOUT` | `--login-timeout` | `1800` | Maximum wait time during `--login` (seconds) |
| `LOGIN_INLINE_WAIT` | `--login-inline-wait` | `25` | Wait time for inline authentication fallback (seconds) |
| `AUTO_IMPORT_FROM_BROWSER` | `--auto-import` / `--no-auto-import` | `true` | Automatically import cookies if no profile exists |
| `CHROME_PATH` | `--chrome-path` | `""` (auto-detected) | Path to Chrome/Chromium executable binary |
| `USER_AGENT` | `--user-agent` | `""` | Custom User-Agent string override |
| `VIEWPORT` | `--viewport` | `1280x720` | Browser viewport dimensions (`WIDTHxHEIGHT`) |
| `DEBUG_PORT` | `--debug-port` | `9222` | Chrome remote debugging port used during `--login` |
| `LOG_LEVEL` | `--log-level` | `WARNING` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

---

## Development, Testing & Code Quality

### Running Tests

Execute the full suite of unit, integration, and contract tests:

```bash
# Run all tests in parallel
bun test --parallel

# Run specific test suites
bun run test:unit
bun run test:integration
bun run test:e2e
bun run test:coverage
```

### Linting & Formatting

Code formatting and style rules follow [Biome](https://biomejs.dev) and the repository's [TypeScript Style Guide](.agents/rules/typescript-style.md):

```bash
# Check for lint issues and style violations
bun run lint

# Automatically apply safe fixes
bun run lint:fix

# Format files
bun run format
```

### Generating Documentation

Generate and preview the TypeDoc API documentation:

```bash
# Build static documentation to ./docs
bun run docs

# Serve documentation locally
bun run docs:serve
```

### Project Structure

```
linkedin-mcp-server-ts/
├── src/
│   ├── index.ts               # CLI entrypoint & transport routing (stdio / HTTP)
│   ├── config.ts              # CLI arguments & environment configuration
│   ├── browser/
│   │   ├── auth.ts            # Login, logout, status, and browser cookie importer
│   │   ├── cdp.ts             # Direct Chrome DevTools Protocol communication
│   │   ├── chrome-launch.ts   # Process launcher for visual login & remote attach
│   │   ├── manager.ts         # Bun.WebView & CDP lifecycle manager
│   │   └── types.ts           # Browser status types
│   ├── errors/                # Unified error handling & error hierarchy
│   ├── mcp/
│   │   └── create-server.ts   # MCP server registration & tool mounting
│   ├── middleware/            # Serialization queue for concurrent requests
│   ├── scraping/              # DOM extraction, text cleanup, link classifiers & URNs
│   ├── session/               # Cookie storage, profile directory, and persistence
│   ├── tools/                 # 19 MCP tool implementations
│   └── utils/                 # General text and DOM helpers
├── tests/                     # Unit, integration, and E2E test suites
├── .agents/                   # Coding standards, style rules, and agent skills
├── bunfig.toml                # Bun configuration & package registry settings
└── package.json               # Package metadata, dependencies, and scripts
```

---

## Publishing

Publishing to npm is handled directly with Bun:

```bash
# Verify linting and tests pass
bun run lint
bun test --parallel

# Publish package
bun publish
```

---

## Contributing

Contributions and pull requests are welcome.

1. Fork the repository: [`https://github.com/joaovjo/linkedin-mcp-server-ts`](https://github.com/joaovjo/linkedin-mcp-server-ts)
2. Create a feature branch following the [Conventional Branch](.agents/skills/conventional-branch/SKILL.md) spec: `git checkout -b feature/your-feature-name`
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/): `git commit -m 'feat: add specific feature'`
4. Ensure all tests and lint checks pass: `bun test --parallel && bun run lint`
5. Push to your branch: `git push origin feature/your-feature-name`
6. Open a Pull Request.

---

## License & Credits

- **License:** Distributed under the [MIT License](LICENSE).
- **Credits:** Based on the architecture and scraper logic of [`stickerdaniel/linkedin-mcp-server`](https://github.com/stickerdaniel/linkedin-mcp-server) by [Daniel Sticker](https://github.com/stickerdaniel) and contributors.
