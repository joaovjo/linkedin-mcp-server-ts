import type { AppConfig } from "../config.ts";
import type { BrowserState } from "./types.ts";
import { BrowserSetupFailedError } from "../errors/types.ts";

class BrowserManager {
  private view: Bun.WebView | null = null;
  private state: BrowserState = "uninitialized";
  private initPromise: Promise<void> | null = null;
  private config: AppConfig | null = null;

  getState(): BrowserState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === "ready" && this.view !== null;
  }

  async initialize(config: AppConfig): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.config = config;
    this.state = "booting";

    this.initPromise = (async () => {
      try {
        const profilePath = `${config.profileDir}/bun-webview`;

        const backendPref = "BUN_WEBVIEW_BACKEND" in Bun.env
          ? Bun.env.BUN_WEBVIEW_BACKEND
          : undefined;

        const viewOptions: Bun.WebViewConstructorOptions = {
          width: 1280,
          height: 720,
          dataStore: { directory: profilePath },
        };

        if (backendPref === "webkit" || backendPref === "chrome") {
          viewOptions.backend = backendPref;
        }

        this.view = new Bun.WebView(viewOptions);
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
      // Retry initialization
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
    return await view.evaluate(script) as T;
  }
}

export const browserManager = new BrowserManager();
