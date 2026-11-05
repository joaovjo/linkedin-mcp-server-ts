# LinkedIn MCP Bridge (Chrome Extension)

Extrai dados do LinkedIn diretamente da sua sessão autenticada no navegador e os expõe
como um servidor MCP (Model Context Protocol) **embutido na extensão** — não é necessário
iniciar nenhum servidor Bun separado.

## Install (load unpacked)

1. Build the extension:
   ```bash
   cd extension
   bun run build
   ```
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension/` folder.
5. Pin the extension for easy access.

## Usar com a IA (MCP via URL)

1. Clique no ícone da extensão, então clique em **Conectar Bridge**.
2. O popup mostra a **URL MCP** para configurar na sua IA:
   ```
   http://127.0.0.1:8000/mcp
   ```
3. Configure essa URL no seu cliente MCP (Claude Desktop, Cursor, OpenCode, etc.)
   como transporte **streamable-http**.
4. A IA agora acessa o LinkedIn através da extensão + servidor MCP embutido.

## Como funciona

- O **service worker** da extensão escuta em `127.0.0.1:8000` e fala o protocolo MCP
  (JSON-RPC 2.0) diretamente.
- As chamadas de ferramenta (ex: `get_person_profile`) são encaminhadas para o
  content script da aba do LinkedIn, que extrai dados do DOM da página autenticada.
- Não é necessário iniciar `bun run src/index.ts` separadamente.

## Desenvolvimento

- Source lives in `src/`. Build with `bun run build`.
- No `eval` is used in extension pages; all scripts are bundled by Bun.
- Service worker persists state in `chrome.storage`; no in-memory global state.
- Permissions: `tabs`, `storage`, `alarms`, `sockets.tcpServer`, `sockets.tcp`.
