# LinkedIn MCP Server (TypeScript / Bun)

<p align="left">
  <a href="https://www.npmjs.com/package/linkedin-mcp-server-ts" target="_blank"><img src="https://img.shields.io/npm/v/linkedin-mcp-server-ts?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://bun.sh" target="_blank"><img src="https://img.shields.io/badge/Runtime-Bun%201.2+-fbf0df?logo=bun&logoColor=black" alt="Bun Runtime"></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/Language-TypeScript%207-3178c6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://modelcontextprotocol.io/" target="_blank"><img src="https://img.shields.io/badge/MCP-SDK%202.0-8a2be2" alt="Model Context Protocol"></a>
  <a href="https://github.com/joaovjo/linkedin-mcp-server-ts/blob/main/LICENSE" target="_blank"><img src="https://img.shields.io/badge/License-MIT-3fb950" alt="License: MIT"></a>
  <a href="https://biomejs.dev" target="_blank"><img src="https://img.shields.io/badge/Linter-Biome-60a5fa?logo=biome&logoColor=white" alt="Biome"></a>
</p>

> **Disclaimer:** This is an independent, community-driven open-source project. It is not affiliated with, sponsored by, authorized by, or endorsed by LinkedIn Corporation or Microsoft Corporation. "LinkedIn" is a registered trademark of LinkedIn Corporation and is used purely descriptively.

A blazing-fast, lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for LinkedIn automation and scraping, rewritten in **TypeScript** and powered by the **[Bun](https://bun.sh)** runtime. 

It provides AI assistants (such as Claude Desktop, Cursor, OpenCode, VS Code, and Windsurf/Antigravity) with 19 production-grade MCP tools to navigate profiles, search jobs and companies, interact with messages, and extract feeds using your own authenticated browser session.

---

## ⚡ Why TypeScript + Bun?

`linkedin-mcp-server-ts` is a native TypeScript/Bun port of [`stickerdaniel/linkedin-mcp-server`](https://github.com/stickerdaniel/linkedin-mcp-server), built to deliver maximum efficiency and minimal resource footprint:

- 🚀 **Instant Startup & Near-Zero Overhead**: Bun's native JIT and fast package execution eliminate cold-start delays.
- 🌐 **Native WebView & Direct CDP Engine**: Automates Chromium through direct Chrome DevTools Protocol (CDP) and `Bun.WebView` without heavy external browser daemon layers.
- 🔄 **100% Contract & Schema Parity**: Complete 1:1 drop-in replacement for the Python MCP server tools, schemas, and return formats.
- 🔑 **Seamless Session Sharing**: 100% compatible with the standard `~/.linkedin-mcp/profile` session storage and cookies format.

### Architecture Comparison

| Feature | Python Version (`mcp-server-linkedin`) | TypeScript / Bun Version (`linkedin-mcp-server-ts`) |
|---|---|---|
| **Runtime** | Python 3.10+ (`uv` / `uvx`) | Bun 1.2+ (`bun` / `bunx`) |
| **Language** | Python (`fastmcp`) | TypeScript 7 (`@modelcontextprotocol/server` v2) |
| **Browser Engine** | Patchright Chromium fork | Native `Bun.WebView` + Direct Chrome DevTools Protocol (CDP) |
| **Memory / Footprint** | Moderate (~150MB+ runtime) | Ultra-lightweight (~30-60MB baseline) |
| **Transports** | `stdio`, `streamable-http` | `stdio`, `streamable-http` (via native `Bun.serve`) |
| **Session Directory** | `~/.linkedin-mcp/profile` | `~/.linkedin-mcp/profile` (Shared & Interoperable) |
| **Validation** | Pydantic | Zod schemas |
| **Tool Count** | 19 tools | 19 tools |

---

## 🛠️ MCP Tools Overview (19 Tools)

| Tool | Category | Description | Access Type |
|---|---|---|---|
| `get_person_profile` | People | Extract profile details with granular sections (experience, education, skills, projects, certifications, posts, etc.) | Read-Only |
| `get_my_profile` | People | Extract the authenticated user's own profile | Read-Only |
| `search_people` | People | Search people by keywords, location, connection degree (`F`=1st, `S`=2nd, `O`=3rd+), and current company | Read-Only |
| `connect_with_person` | People | Send a connection request or accept an invitation with an optional personalized note | Write / Action |
| `get_sidebar_profiles` | People | Extract recommended sidebar profile links ("People you may know", "More profiles") | Read-Only |
| `get_company_profile` | Company | Extract company details, about info, posts, jobs, and numeric company URN IDs | Read-Only |
| `get_company_posts` | Company | Retrieve recent company feed posts | Read-Only |
| `search_companies` | Company | Search companies by keyword | Read-Only |
| `get_company_employees` | Company | List company employees from the `/people/` section with optional filters | Read-Only |
| `get_job_details` | Jobs | Fetch full details and descriptions for a specific job posting | Read-Only |
| `search_jobs` | Jobs | Search jobs with filters: keywords, location, date posted, job type, work type, experience level, easy apply | Read-Only |
| `get_saved_jobs` | Jobs | Retrieve the authenticated user's saved job listings | Read-Only |
| `get_inbox` | Messaging | List recent conversation threads from the messaging inbox | Read-Only |
| `get_conversation` | Messaging | Read messages in a thread by username or `thread_id` | Read-Only |
| `search_conversations` | Messaging | Search messaging threads by keyword | Read-Only |
| `send_message` | Messaging | Send a LinkedIn direct message (requires `confirm_send: true` for safe two-step confirmation) | Write / Action |
| `get_feed` | Feed | Retrieve recent posts from your home timeline | Read-Only |
| `search_posts` | Feed | Global search across LinkedIn posts with recency filter (`past-24h`, `past-week`, `past-month`) | Read-Only |
| `close_session` | Session | Gracefully terminate the browser session and clean up background resources | Write / Action |

---

## 🚀 Quickstart

### Prerequisites

1. **Install [Bun](https://bun.sh)** (v1.2 or higher):
   ```powershell
   # Windows (PowerShell)
   powershell -c "irm bun.sh/install.ps1 | iex"

   # macOS / Linux
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Google Chrome / Chromium**: Installed on your system.

### One-Command Execution (`bunx`)

You can run the server directly without manual installation using `bunx`:

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

# Start the server (stdio mode for MCP clients)
bun run start

# Start the HTTP server (for web MCP debugging)
bun run dev
```

---

## 💻 MCP Client Configuration

### 1. Claude Desktop

Add to your `claude_desktop_config.json`:

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

*Or when running from a local clone:*

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

Add to your project's `.cursor/mcp.json` or Global Cursor Settings:

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

Add to your `opencode.json` (or `~/.config/opencode/opencode.json`):

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

To expose the server over HTTP for remote agents or containerized setups:

```bash
bun run src/index.ts --transport streamable-http --host 127.0.0.1 --port 8000
```

Endpoint URL: `http://127.0.0.1:8000/mcp`  
Healthcheck: `http://127.0.0.1:8000/health`

---

## 🔐 Authentication & Session Management

The server uses a persistent browser profile stored at `~/.linkedin-mcp/profile` so you only need to authenticate once.

### Option A: Auto-Import from your Everyday Browser (Fastest)

If you are already logged in to LinkedIn in your browser (Chrome, Brave, Edge, Arc, Vivaldi), import your session instantly:

```bash
# Auto-detect the most recent browser session
bunx linkedin-mcp-server-ts --import-from-browser

# Or specify a target browser
bunx linkedin-mcp-server-ts --import-from-browser brave
bunx linkedin-mcp-server-ts --import-from-browser chrome
bunx linkedin-mcp-server-ts --import-from-browser edge
```

### Option B: Interactive Visual Login

Launch an interactive Chrome window to log in:

```bash
bunx linkedin-mcp-server-ts --login
# Or from local source:
bun run login
```

1. A Chrome browser window will open to the LinkedIn login page.
2. Complete your login (including 2FA / CAPTCHA if prompted).
3. The server detects successful navigation to your feed and saves your session profile securely.

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

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the root directory (or pass CLI arguments) to customize behavior:

| Variable | CLI Flag | Default | Description |
|---|---|---|---|
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
| `CHROME_PATH` | `--chrome-path` | `""` (auto-detected) | Custom path to Chrome/Chromium executable |
| `USER_AGENT` | `--user-agent` | `""` | Optional custom browser User-Agent override |
| `VIEWPORT` | `--viewport` | `1280x720` | Browser viewport dimensions (`WIDTHxHEIGHT`) |
| `DEBUG_PORT` | `--debug-port` | `9222` | Chrome remote debugging port used during `--login` |
| `LOG_LEVEL` | `--log-level` | `WARNING` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

---

## 🧪 Development, Testing & Quality

### Run Contract & Unit Tests

Run the full test suite verifying all 19 tools, schema validations, link metadata classifiers, and error handling:

```bash
bun test
```

### Linting & Formatting

Code style and formatting are enforced with **[Biome](https://biomejs.dev)**:

```bash
# Check code for lint issues
bun run lint

# Auto-fix formatting and linting
bun run lint:fix

# Format files
bun run format
```

### Project Architecture

```
linkedin-mcp-server-ts/
├── src/
│   ├── index.ts               # CLI Entrypoint & Transport routing (stdio / HTTP)
│   ├── config.ts              # CLI flags & environment configuration
│   ├── browser/
│   │   ├── auth.ts            # Login, logout, status, and browser cookie importer
│   │   ├── cdp.ts             # Direct Chrome DevTools Protocol helper functions
│   │   ├── chrome-launch.ts   # Process launcher for visual login & remote attach
│   │   ├── manager.ts         # Bun.WebView & CDP lifecycle manager
│   │   └── types.ts           # Browser status types
│   ├── errors/                # Unified error handling & custom error hierarchy
│   ├── mcp/
│   │   └── create-server.ts   # MCP Server registration & tool mounting
│   ├── middleware/            # Concurrency serialization queue
│   ├── scraping/              # DOM extraction, noise removal, link classification & URNs
│   ├── session/               # Cookie storage, profile directories, and persistence
│   ├── tools/                 # 19 MCP tool implementations
│   └── utils/                 # General helpers
├── tests/                     # Bun test suite & contract validations
├── bunfig.toml                # Bun configuration & npm publish registry settings
└── package.json               # Package metadata, dependencies, and scripts
```

---

## 📦 Publishing to NPM

This project uses `bunfig.toml` to publish directly to the npm registry with Bun:

```bash
# Verify typecheck & tests pass
bun test
bun run lint

# Publish public package
bun publish
```

---

## 🤝 Contributing

Contributions, bug reports, and pull requests are welcome!

1. Fork the repository on GitHub: [`https://github.com/joaovjo/linkedin-mcp-server-ts`](https://github.com/joaovjo/linkedin-mcp-server-ts)
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Ensure all tests pass: `bun test && bun run lint`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request.

---

## 📄 License & Credits

- **License:** Distributed under the [MIT License](file:///d:/linkedin/linkedin-mcp-server-ts/LICENSE).
- **Credits:** Special thanks to [Daniel Sticker](https://github.com/stickerdaniel) and contributors of [`stickerdaniel/linkedin-mcp-server`](https://github.com/stickerdaniel/linkedin-mcp-server) for the original Python architecture, scraper logic, and research.
