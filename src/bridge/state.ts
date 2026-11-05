import type { BridgeHandle } from "./types.ts";

let current: BridgeHandle | null = null;

export function setBridge(handle: BridgeHandle | null): void {
	current = handle;
}

export function getBridge(): BridgeHandle | null {
	return current;
}
