import type { CookieRecord } from "../../src/session/store.ts";

export interface MockCdpState {
	url: string;
	html: string;
	cookies: CookieRecord[];
	evaluations: Array<{ script: string; result: unknown }>;
	calls: Array<{ method: string; params?: Record<string, unknown> }>;
}

export function createMockCdpView(initialState: Partial<MockCdpState> = {}) {
	const state: MockCdpState = {
		url: initialState.url ?? "https://www.linkedin.com/feed/",
		html: initialState.html ?? "<html><body><main>Mock Page</main></body></html>",
		cookies: initialState.cookies ?? [
			{
				name: "li_at",
				value: "mock_session_token_12345",
				domain: ".linkedin.com",
				path: "/",
				httpOnly: true,
				secure: true,
			},
		],
		evaluations: initialState.evaluations ?? [],
		calls: [],
	};

	const eventListeners: Record<string, Array<(event: unknown) => void>> = {};

	const view = {
		url: state.url,
		state,
		async cdp(method: string, params?: Record<string, unknown>): Promise<unknown> {
			state.calls.push({ method, params });
			if (method === "Network.getAllCookies") {
				return { cookies: state.cookies };
			}
			if (method === "Network.setCookie") {
				if (params) {
					state.cookies.push({
						name: String(params.name ?? ""),
						value: String(params.value ?? ""),
						domain: String(params.domain ?? ".linkedin.com"),
						path: String(params.path ?? "/"),
					});
				}
				return { success: true };
			}
			if (method === "Network.enable") {
				return {};
			}
			if (method === "Emulation.setUserAgentOverride") {
				return {};
			}
			return {};
		},
		async navigate(newUrl: string): Promise<void> {
			state.url = newUrl;
			view.url = newUrl;
			state.calls.push({ method: "navigate", params: { url: newUrl } });
		},
		async evaluate<T = unknown>(script: string | ((...args: unknown[]) => T)): Promise<T> {
			if (typeof script === "function") {
				return script() as T;
			}
			state.calls.push({ method: "evaluate", params: { script } });
			if (script.includes("document.body.innerText") || script.includes("document.body.textContent")) {
				return state.html as unknown as T;
			}
			if (script.includes("window.location.href")) {
				return state.url as unknown as T;
			}
			return null as unknown as T;
		},
		async click(selector: string): Promise<void> {
			state.calls.push({ method: "click", params: { selector } });
		},
		async type(text: string): Promise<void> {
			state.calls.push({ method: "type", params: { text } });
		},
		async press(key: string): Promise<void> {
			state.calls.push({ method: "press", params: { key } });
		},
		async scroll(dx: number, dy: number): Promise<void> {
			state.calls.push({ method: "scroll", params: { dx, dy } });
		},
		async scrollTo(selector: string): Promise<void> {
			state.calls.push({ method: "scrollTo", params: { selector } });
		},
		addEventListener(event: string, listener: (event: unknown) => void) {
			eventListeners[event] = eventListeners[event] || [];
			eventListeners[event].push(listener);
		},
		removeEventListener(event: string, listener: (event: unknown) => void) {
			if (eventListeners[event]) {
				eventListeners[event] = eventListeners[event].filter((l) => l !== listener);
			}
		},
		close() {
			state.calls.push({ method: "close" });
		},
	};

	return view;
}
