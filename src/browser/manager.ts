import type { AppConfig } from "../config.ts";
import { BrowserSetupFailedError } from "../errors/types.ts";
import type { CookieRecord } from "../session/store.ts";
import { ensureSessionDirs, webViewProfilePath } from "../session/store.ts";
import { type CdpView, enableNetwork, getAllCookies, setCookies, setUserAgent } from "./cdp.ts";
import type { BrowserState } from "./types.ts";

type Modifier = "Shift" | "Control" | "Alt" | "Meta";

function escapeSelector(sel: string): string {
	return sel.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export interface BrowserInitOptions {
	attachWsUrl?: string;
	injectCookies?: CookieRecord[];
}

class BrowserManager {
	private view: Bun.WebView | null = null;
	private state: BrowserState = "uninitialized";
	private initPromise: Promise<void> | null = null;
	private networkEnabled = false;

	getState(): BrowserState {
		return this.state;
	}

	isReady(): boolean {
		return this.state === "ready" && this.view !== null;
	}

	async initialize(config: AppConfig, options: BrowserInitOptions = {}): Promise<void> {
		if (this.initPromise && !options.attachWsUrl) return this.initPromise;

		this.state = "booting";
		this.initPromise = (async () => {
			try {
				await ensureSessionDirs(config.userDataDir);
				const profilePath = webViewProfilePath(config.userDataDir);

				const backend: Record<string, unknown> = options.attachWsUrl
					? { type: "chrome", url: options.attachWsUrl }
					: {
							type: "chrome",
							url: false,
							...(config.chromePath ? { path: config.chromePath } : {}),
						};

				const viewOptions: Record<string, unknown> = {
					width: config.viewport.width,
					height: config.viewport.height,
					backend,
				};

				// dataStore maps to --user-data-dir for spawned Chrome; skip when attaching
				if (!options.attachWsUrl) {
					viewOptions.dataStore = { directory: profilePath };
				}

				this.view = new Bun.WebView(viewOptions as ConstructorParameters<typeof Bun.WebView>[0]);
				await this.view.navigate("about:blank");
				this.networkEnabled = false;

				if (config.userAgent) {
					await setUserAgent(this.view, config.userAgent);
				}
				if (options.injectCookies?.length) {
					await setCookies(this.view, options.injectCookies);
				}

				this.state = "ready";
			} catch (err) {
				this.state = "failed";
				this.initPromise = null;
				this.view = null;
				throw new BrowserSetupFailedError(err instanceof Error ? err.message : String(err));
			}
		})();

		return this.initPromise;
	}

	getView(): CdpView {
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

		const { resolveExistingChromeWsUrl } = await import("./chrome-launch.ts");
		const wsUrl = await resolveExistingChromeWsUrl(config.debugPort);
		if (wsUrl) {
			await this.initialize(config, { attachWsUrl: wsUrl });
			return;
		}

		await this.initialize(config);
	}

	async ensureNetwork(): Promise<void> {
		if (this.networkEnabled) return;
		await enableNetwork(this.getView());
		this.networkEnabled = true;
	}

	async exportCookies(): Promise<CookieRecord[]> {
		await this.ensureNetwork();
		return getAllCookies(this.getView());
	}

	async importCookies(cookies: CookieRecord[]): Promise<void> {
		await setCookies(this.getView(), cookies);
	}

	async close(): Promise<void> {
		if (this.view) {
			try {
				this.view.close();
			} catch {
				// already closed
			}
			this.view = null;
		}
		try {
			Bun.WebView.closeAll();
		} catch {
			// ignore
		}
		this.state = "uninitialized";
		this.initPromise = null;
		this.networkEnabled = false;
	}

	async navigate(url: string): Promise<void> {
		await this.getView().navigate(url);
	}

	async evaluate<T = unknown>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T> {
		const view = this.getView();
		if (typeof script === "function") {
			return (await (view.evaluate as (...a: unknown[]) => Promise<T>)(script, ...args)) as T;
		}
		return (await view.evaluate(script)) as T;
	}

	async click(selector: string, options?: { timeout?: number }): Promise<void> {
		await this.getView().click(selector, options as never);
	}

	async type(text: string): Promise<void> {
		await this.getView().type(text);
	}

	async press(key: string, options?: { modifiers?: Modifier[] }): Promise<void> {
		await this.getView().press(key, options as never);
	}

	async scroll(dx: number, dy: number): Promise<void> {
		await this.getView().scroll(dx, dy);
	}

	async scrollTo(
		selector: string,
		options?: {
			block?: "start" | "center" | "end" | "nearest";
			timeout?: number;
		},
	): Promise<void> {
		await this.getView().scrollTo(selector, options as never);
	}

	async waitForSelector(selector: string, timeout = 30000): Promise<boolean> {
		const escaped = escapeSelector(selector);
		const deadline = Date.now() + timeout;
		while (Date.now() < deadline) {
			const found = await this.evaluate<boolean>(`!!document.querySelector('${escaped}')`);
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
		return this.getView().url || (await this.evaluate<string>("window.location.href"));
	}

	async getAllTexts(selector: string): Promise<string[]> {
		const escaped = escapeSelector(selector);
		return await this.evaluate<string[]>(
			`(() => [...document.querySelectorAll('${escaped}')].map(e => e.textContent?.trim()).filter(Boolean))()`,
		);
	}

	async scrollToEnd(currentCount: number): Promise<number> {
		const before = await this.evaluate<number>("document.body.scrollHeight || 0");
		await this.scroll(0, before);
		await Bun.sleep(1000);
		const after = await this.evaluate<number>("document.body.scrollHeight || 0");
		return after > before ? after : currentCount;
	}
}

export const browserManager = new BrowserManager();
