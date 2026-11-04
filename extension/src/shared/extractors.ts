/**
 * Small DOM extraction helpers used by content scripts.
 *
 * Content scripts must not block the main thread: callers should batch large
 * DOM mutations with requestAnimationFrame (see batchWithRaf).
 */

export function cleanText(value: string | null | undefined): string {
	if (!value) return "";
	return value.replace(/\s+/g, " ").trim();
}

export function textOf(selector: string, root: ParentNode = document): string {
	const el = root.querySelector(selector);
	return cleanText(el?.textContent ?? "");
}

export function allTextOf(selector: string, root: ParentNode = document): string[] {
	return [...root.querySelectorAll(selector)]
		.map((el) => cleanText(el.textContent))
		.filter((t) => t.length > 0);
}

export function attrOf(selector: string, attr: string, root: ParentNode = document): string {
	const el = root.querySelector(selector);
	return cleanText(el?.getAttribute(attr) ?? "");
}

export async function waitForElement(selector: string, timeoutMs = 5000): Promise<Element | null> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const el = document.querySelector(selector);
		if (el) return el;
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	}
	return document.querySelector(selector);
}

export function extractLinks(root: ParentNode = document): Array<{ href: string; text: string }> {
	const out: Array<{ href: string; text: string }> = [];
	const seen = new Set<string>();
	for (const a of root.querySelectorAll("a[href]")) {
		const href = a.getAttribute("href") || "";
		if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
		const text = cleanText(a.textContent);
		const key = `${href}|${text}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ href, text });
	}
	return out;
}

export async function batchWithRaf<T>(items: T[], batchSize: number, work: (batch: T[]) => void): Promise<void> {
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => {
				work(batch);
				resolve();
			});
		});
		if (typeof (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield === "function") {
			await (globalThis as { scheduler: { yield: () => Promise<void> } }).scheduler.yield();
		}
	}
}