# LinkedIn MCP Bridge (Chrome Extension)

Extracts LinkedIn data directly from your authenticated browser session and forwards it
to the local LinkedIn MCP server bridge.

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

## Bridge connection

1. Start the MCP server with the bridge enabled:
   ```bash
   BRIDGE_ENABLED=true bun run src/index.ts
   ```
   (or pass `--bridge`).
2. Click the extension icon, then **Connect**. Status should show "Connected".
3. The bridge listens on `ws://127.0.0.1:8765` by default (override with `BRIDGE_PORT`).

## Development

- Source lives in `src/`. Build with `bun run build`.
- No `eval` is used in extension pages; all scripts are bundled by Bun.
- Service worker persists state in `chrome.storage`; no in-memory global state.