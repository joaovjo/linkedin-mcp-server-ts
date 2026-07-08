import type { AppConfig } from "../config.ts";
import { BrowserSetupFailedError } from "../errors/types.ts";
import type { BrowserState } from "./types.ts";

type Modifier = "Shift" | "Control" | "Alt" | "Meta";

function escapeSelector(sel: string): string {
	return sel.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

class BrowserManager {
	private view: Bun.WebView | null = null;
	private state: BrowserState = "uninitialized";
	private initPromise: Promise<void> | null = null;

	getState(): BrowserState {
		return this.state;
	}

	isReady(): boolean {
		return this.state === "ready" && this.view !== null;
	}

	async initialize(config: AppConfig): Promise<void> {
		if (this.initPromise) return this.initPromise;

		this.state = "booting";

		this.initPromise = (async () => {
			try {
				const profilePath = `${config.profileDir}/bun-webview`;

				const backendPref =
					"BUN_WEBVIEW_BACKEND" in Bun.env
						? Bun.env.BUN_WEBVIEW_BACKEND
						: undefined;

				const viewOptions: Record<string, unknown> = {
					width: 1280,
					height: 720,
					dataStore: { directory: profilePath },
				};

				if (backendPref === "webkit" || backendPref === "chrome") {
					viewOptions.backend = backendPref;
				}

				this.view = new Bun.WebView(viewOptions as any);
				this.state = "ready";
			} catch (err) {
				this.state = "failed";
				this.initPromise = null;
				throw new BrowserSetupFailedError(
					err instanceof Error ? err.message : String(err),
				);
			}
		})();

		return this.initPromise;
	}

	getView(): Bun.WebView {
		if (!this.view || this.state !== "ready") {
			throw new BrowserSetupFailedError("Browser not initialized");
		}
		return this.view;
	}

	async ensureReady(config: AppConfig): Promise<void> {
		if (this.state === "ready") return;
		if (this.state === "failed") {
			this.state = "uninitialized";
			this.initPromise = null;
		}
		await this.initialize(config);
	}

	async close(): Promise<void> {
		if (this.view) {
			try {
				this.view.close();
			} catch {
				// Already closed
			}
			this.view = null;
		}
		this.state = "uninitialized";
		this.initPromise = null;
	}

	async navigate(url: string): Promise<void> {
		const view = this.getView();
		await view.navigate(url);
	}

	async evaluate<T = unknown>(script: string): Promise<T> {
		const view = this.getView();
		return (await view.evaluate(script)) as T;
	}

	async click(selector: string, options?: { timeout?: number }): Promise<void> {
		const view = this.getView();
		await view.click(selector, options as any);
	}

	async type(text: string): Promise<void> {
		const view = this.getView();
		await view.type(text);
	}

	async press(
		key: string,
		options?: { modifiers?: Modifier[] },
	): Promise<void> {
		const view = this.getView();
		await view.press(key, options as any);
	}

	async scroll(dx: number, dy: number): Promise<void> {
		const view = this.getView();
		await view.scroll(dx, dy);
	}

	async waitForSelector(selector: string, timeout = 30000): Promise<boolean> {
		const escaped = escapeSelector(selector);
		const deadline = Date.now() + timeout;
		while (Date.now() < deadline) {
			const found = await this.evaluate<boolean>(
				`!!document.querySelector('${escaped}')`,
			);
			if (found) return true;
			await Bun.sleep(200);
		}
		return false;
	}

	async waitForTimeout(ms: number): Promise<void> {
		await Bun.sleep(ms);
	}

	async getTextContent(selector: string): Promise<string | null> {
		const escaped = escapeSelector(selector);
		return await this.evaluate<string | null>(
			`(() => { const e = document.querySelector('${escaped}'); return e?.textContent?.trim() ?? null })()`,
		);
	}

	async getInnerText(selector: string): Promise<string | null> {
		const escaped = escapeSelector(selector);
		return await this.evaluate<string | null>(
			`(() => { const e = document.querySelector('${escaped}'); return e?.innerText?.trim() ?? null })()`,
		);
	}

	async getAttribute(selector: string, attr: string): Promise<string | null> {
		const escaped = escapeSelector(selector);
		return await this.evaluate<string | null>(
			`(() => { const e = document.querySelector('${escaped}'); return e?.getAttribute('${attr}') ?? null })()`,
		);
	}

	async getCurrentUrl(): Promise<string> {
		return await this.evaluate<string>("window.location.href");
	}

	async getAllTexts(selector: string): Promise<string[]> {
		const escaped = escapeSelector(selector);
		return await this.evaluate<string[]>(
			`(() => [...document.querySelectorAll('${escaped}')].map(e => e.textContent?.trim()).filter(Boolean))()`,
		);
	}

	async scrollToEnd(currentCount: number): Promise<number> {
		const view = this.getView();
		const before = await this.evaluate<number>(
			"document.body.scrollHeight || 0",
		);
		await view.scroll(0, before);
		await Bun.sleep(1000);
		const after = await this.evaluate<number>(
			"document.body.scrollHeight || 0",
		);
		return after > before ? after : currentCount;
	}
}

export const browserManager = new BrowserManager();
