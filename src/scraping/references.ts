/** Compatibility wrappers around link-metadata (Python-aligned schema). */

export {
	buildFeedReferences,
	buildReferences,
	classifyLink,
	dedupeReferences,
	firstCompanyUrnFromQuery,
	jobIdFromUrl,
	normalizeUrl,
	type RawReference,
	REFERENCE_CAPS,
	type Reference,
	type ReferenceKind,
} from "./link-metadata";

import { browserManager } from "../browser/manager.ts";
import { buildReferences, classifyLink, type RawReference, type Reference } from "./link-metadata";

/** Legacy helper — prefer buildReferences. */
export function extractPersonReferences(raw: Array<{ href: string; text?: string }>): Reference[] {
	const mapped: RawReference[] = raw.map((r) => ({
		href: r.href,
		text: r.text,
	}));
	return buildReferences(mapped, "search_results").filter((r) => r.kind === "person");
}

export function extractJobReferences(raw: Array<{ href: string; text?: string }>): Reference[] {
	const mapped: RawReference[] = raw.map((r) => ({
		href: r.href,
		text: r.text,
	}));
	return buildReferences(mapped, "jobs").filter((r) => r.kind === "job");
}

export function hrefToPersonUrl(href: string): string | null {
	const c = classifyLink(href);
	return c?.[0] === "person" ? c[1] : null;
}

export function hrefToJobUrl(href: string): string | null {
	const c = classifyLink(href);
	return c?.[0] === "job" ? c[1] : null;
}

export function hrefToCompanyUrl(href: string): string | null {
	const c = classifyLink(href);
	return c?.[0] === "company" ? c[1] : null;
}

export function hrefToFeedPostUrl(href: string): string | null {
	const c = classifyLink(href);
	return c?.[0] === "feed_post" ? c[1] : null;
}

/** Collect person profile links currently in the DOM. */
export async function extractProfileReferences(limit = 40): Promise<Reference[]> {
	const hrefs =
		(await browserManager.evaluate<Array<{ href: string; text: string }>>(() => {
			const out: Array<{ href: string; text: string }> = [];
			for (const a of document.querySelectorAll('a[href*="/in/"]')) {
				const href = (a as HTMLAnchorElement).href;
				if (!/\/in\/[^/?#]+\/?/.test(href)) continue;
				out.push({
					href,
					text: (a.textContent || "").trim().slice(0, 120),
				});
			}
			return out;
		})) ?? [];
	return buildReferences(
		hrefs.map((h) => ({ href: h.href, text: h.text })),
		"employees",
	)
		.filter((r) => r.kind === "person")
		.slice(0, limit);
}

/** Sidebar recommendation sections — fixed headings (Python parity). */
export async function extractSidebarProfiles(): Promise<Record<string, string[]>> {
	const data = await browserManager.evaluate<{
		sections: Record<string, string[]>;
		showAllUrls: Record<string, string>;
	}>(() => {
		const HEADINGS = ["People you may know", "More profiles for you", "Explore premium profiles"];
		const result: Record<string, string[]> = {};
		const showAllUrls: Record<string, string> = {};
		const main = document.querySelector("main") || document.body;
		const headings = [...main.querySelectorAll("h2, h3")];

		for (const wanted of HEADINGS) {
			const h = headings.find((el) => (el.textContent || "").trim().toLowerCase() === wanted.toLowerCase());
			if (!h) continue;
			let section: Element | null = h.closest("section, aside, div");
			if (!section) section = h.parentElement;
			const urls: string[] = [];
			const seen = new Set<string>();
			if (section) {
				for (const a of section.querySelectorAll('a[href*="/in/"]')) {
					try {
						const href = (a as HTMLAnchorElement).href;
						if (href.includes("/premium")) continue;
						const u = new URL(href);
						const m = /^\/in\/([^/?#]+)/.exec(u.pathname);
						if (!m) continue;
						const rel = `/in/${m[1]}/`;
						if (seen.has(rel)) continue;
						seen.add(rel);
						urls.push(rel);
					} catch {
						/* skip */
					}
				}
				const showAll = [...section.querySelectorAll("a")].find((a) => /^Show all\b/i.test((a.textContent || "").trim())) as
					| HTMLAnchorElement
					| undefined;
				if (showAll?.href) {
					const key = wanted
						.toLowerCase()
						.replace(/\s+/g, "_")
						.replace(/[^a-z0-9_]/g, "");
					showAllUrls[key] = showAll.href;
				}
			}
			if (urls.length) {
				const key = wanted
					.toLowerCase()
					.replace(/\s+/g, "_")
					.replace(/[^a-z0-9_]/g, "");
				result[key] = urls;
			}
		}
		return { sections: result, showAllUrls };
	});

	const sidebar = { ...(data?.sections ?? {}) };
	const showAll = data?.showAllUrls ?? {};
	for (const [key, href] of Object.entries(showAll)) {
		try {
			await browserManager.navigate(href);
			await Bun.sleep(1200);
			const extra =
				(await browserManager.evaluate<string[]>(() => {
					const urls: string[] = [];
					const seen = new Set<string>();
					for (const a of document.querySelectorAll('a[href*="/in/"]')) {
						try {
							const href = (a as HTMLAnchorElement).href;
							if (href.includes("/premium")) continue;
							const u = new URL(href);
							const m = /^\/in\/([^/?#]+)/.exec(u.pathname);
							if (!m) continue;
							const rel = `/in/${m[1]}/`;
							if (seen.has(rel)) continue;
							seen.add(rel);
							urls.push(rel);
						} catch {
							/* skip */
						}
					}
					return urls;
				})) ?? [];
			const existing = sidebar[key] ?? [];
			const merged = [...existing];
			const seen = new Set(existing);
			for (const u of extra) {
				if (seen.has(u)) continue;
				seen.add(u);
				merged.push(u);
			}
			sidebar[key] = merged;
		} catch {
			/* skip show-all expansion */
		}
	}
	return sidebar;
}
