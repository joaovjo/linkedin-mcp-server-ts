import type { CookieRecord } from "../session/store.ts";

export type CdpView = Bun.WebView;

export async function cdp<T = unknown>(
	view: CdpView,
	method: string,
	params?: Record<string, unknown>,
): Promise<T> {
	return (await view.cdp(method, params)) as T;
}

export async function enableNetwork(view: CdpView): Promise<void> {
	await cdp(view, "Network.enable");
}

export async function setUserAgent(
	view: CdpView,
	userAgent: string,
): Promise<void> {
	await cdp(view, "Emulation.setUserAgentOverride", { userAgent });
}

export async function getAllCookies(view: CdpView): Promise<CookieRecord[]> {
	await enableNetwork(view);
	const result = await cdp<{ cookies: Array<Record<string, unknown>> }>(
		view,
		"Network.getAllCookies",
	);
	return (result.cookies ?? []).map((c) => ({
		name: String(c.name ?? ""),
		value: String(c.value ?? ""),
		domain: String(c.domain ?? ""),
		path: String(c.path ?? "/"),
		expires: typeof c.expires === "number" ? c.expires : undefined,
		httpOnly: Boolean(c.httpOnly),
		secure: Boolean(c.secure),
		sameSite: mapSameSite(c.sameSite),
	}));
}

export async function setCookies(
	view: CdpView,
	cookies: CookieRecord[],
): Promise<void> {
	await enableNetwork(view);
	for (const cookie of cookies) {
		await cdp(view, "Network.setCookie", {
			name: cookie.name,
			value: cookie.value,
			domain: cookie.domain.startsWith(".")
				? cookie.domain
				: cookie.domain || ".linkedin.com",
			path: cookie.path || "/",
			secure: cookie.secure ?? true,
			httpOnly: cookie.httpOnly ?? false,
			sameSite: cookie.sameSite ?? "None",
			expires: cookie.expires,
		});
	}
}

function mapSameSite(value: unknown): CookieRecord["sameSite"] | undefined {
	const s = String(value ?? "");
	if (s === "Strict" || s === "Lax" || s === "None") return s;
	if (s === "strict") return "Strict";
	if (s === "lax") return "Lax";
	if (s === "none") return "None";
	return undefined;
}

export function listenNetworkResponses(
	view: CdpView,
	onResponse: (url: string, status: number) => void,
): () => void {
	const listener = (event: Event) => {
		const data = (
			event as CustomEvent & {
				data?: { response?: { url?: string; status?: number } };
			}
		).data as { response?: { url?: string; status?: number } } | undefined;
		if (!data?.response?.url) return;
		onResponse(data.response.url, data.response.status ?? 0);
	};
	view.addEventListener("Network.responseReceived", listener);
	return () => view.removeEventListener("Network.responseReceived", listener);
}
