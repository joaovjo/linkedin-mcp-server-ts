# LinkedIn MCP Bridge (Chrome Extension)

Conecta sua sessão autenticada do LinkedIn no navegador ao servidor MCP local (Bun) via
WebSocket bridge. A IA acessa o LinkedIn através da URL MCP exposta pelo servidor.

## Instalar a extensão (load unpacked)

1. Build the extension:
   ```bash
   cd extension
   bun run build
   ```
2. Abra `chrome://extensions` no Chrome.
3. Ative o **Modo de desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** (Load unpacked) e selecione a pasta `extension/`.
5. Fixe a extensão para acesso fácil.

## Como usar com a IA

1. **Inicie o servidor MCP local** (bridge está ativo por padrão):
   ```powershell
   bun run src/index.ts
   ```
   Ou desabilite o bridge com `--no-bridge` se não quiser usar a extensão.

2. **Clique no ícone da extensão**, então clique em **Conectar Bridge**.

3. O popup mostra a **URL MCP** para configurar na sua IA:
   ```
   http://127.0.0.1:8000/mcp
   ```

4. Configure essa URL no seu cliente MCP (Claude Desktop, Cursor, OpenCode, etc.)
   como transporte **streamable-http**.

5. A IA agora acessa o LinkedIn através do servidor local + extensão (que lê dados
   da página autenticada via content scripts).

## Como funciona

- O **servidor Bun** (`src/index.ts`) expõe o protocolo MCP em `http://127.0.0.1:8000/mcp`
  (streamable-http por padrão).
- O **bridge WebSocket** roda em `ws://127.0.0.1:8765` (ativo por padrão).
- A **extensão** se conecta ao bridge e encaminha chamadas de ferramenta para os
  content scripts nas abas do LinkedIn, que extraem dados do DOM autenticado.
- Não é necessário iniciar servidores separados além do `bun run src/index.ts`.

## Desenvolvimento

- Source lives in `src/`. Build with `bun run build`.
- No `eval` is used in extension pages; all scripts are bundled by Bun.
- Service worker persists state in `chrome.storage`; no in-memory global state.
- Permissions: `tabs`, `storage`, `alarms`.
