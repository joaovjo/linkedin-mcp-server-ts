import type { browserManager as BrowserManagerType } from "../browser/manager";
import type { RawReference } from "./link-metadata";

type Browser = typeof BrowserManagerType;

export interface DomExtractResult {
	text: string;
	references: RawReference[];
}

/**
 * Port of extractor._extract_root_content — gather text + link metadata from a root.
 */
export async function extractRootContent(
	browser: Browser,
	options: {
		rootSelector?: string;
		preferDialog?: boolean;
	} = {},
): Promise<DomExtractResult> {
	const rootSelector = options.rootSelector ?? "main";
	const preferDialog = options.preferDialog ?? false;

	const result = await browser.evaluate<{
		text: string;
		references: RawReference[];
	}>(
		(sel: string, prefer: boolean) => {
			const isVisible = (el: Element) => {
				const style = window.getComputedStyle(el);
				if (style.display === "none" || style.visibility === "hidden")
					return false;
				const r = el.getBoundingClientRect();
				return r.width > 0 && r.height > 0;
			};

			let root: Element | null = null;
			if (prefer) {
				root =
					document.querySelector("dialog[open]") ||
					document.querySelector('[role="dialog"]') ||
					document.querySelector(".artdeco-modal");
			}
			if (!root) root = document.querySelector(sel) || document.body;

			const text = ((root as HTMLElement).innerText || "")
				.replace(/\s+/g, " ")
				.trim();
			const refs: RawReference[] = [];
			const seen = new Set<string>();

			const findHeading = (el: Element): string => {
				let cur: Element | null = el;
				for (let i = 0; i < 8 && cur; i++) {
					const h = cur.querySelector?.("h1,h2,h3,h4");
					if (h && isVisible(h)) {
						const t = (h.textContent || "").trim();
						if (t) return t.slice(0, 80);
					}
					cur = cur.parentElement;
				}
				return "";
			};

			for (const a of root.querySelectorAll("a[href]")) {
				if (!isVisible(a)) continue;
				const href = a.getAttribute("href") || "";
				if (!href || href.startsWith("#") || href.startsWith("javascript:"))
					continue;
				const key = href + "|" + (a.textContent || "").slice(0, 40);
				if (seen.has(key)) continue;
				seen.add(key);

				const inNav = !!a.closest("nav, header, [role='navigation']");
				const inFooter = !!a.closest("footer");
				const inArticle = !!a.closest("article");

				refs.push({
					href,
					text: (a.textContent || "").trim().slice(0, 200),
					aria_label: (a.getAttribute("aria-label") || "").trim().slice(0, 200),
					title: (a.getAttribute("title") || "").trim().slice(0, 200),
					heading: findHeading(a),
					in_article: inArticle,
					in_nav: inNav,
					in_footer: inFooter,
				});
			}

			return { text, references: refs };
		},
		rootSelector,
		preferDialog,
	);

	return {
		text: result?.text ?? "",
		references: Array.isArray(result?.references) ? result.references : [],
	};
}

export async function extractProfileUrn(
	browser: Browser,
): Promise<string | null> {
	const urn = await browser.evaluate<string | null>(() => {
		const anchors = document.querySelectorAll(
			'main a[href*="/messaging/compose/"]',
		);
		for (const a of anchors) {
			try {
				const href = a.getAttribute("href") || "";
				const url = new URL(href, location.origin);
				const recipient =
					url.searchParams.get("recipient") ||
					url.searchParams.get("profileUrn");
				if (recipient) {
					const decoded = decodeURIComponent(recipient);
					const m = /urn:li:fsd_profile:(.+)/.exec(decoded);
					return m?.[1] ?? recipient;
				}
			} catch {
				/* continue */
			}
		}
		return null;
	});
	return urn ?? null;
}

export async function extractCompanyUrnFromDom(
	browser: Browser,
): Promise<string | null> {
	const urn = await browser.evaluate<string | null>(() => {
		const anchors = document.querySelectorAll(
			'a[href*="/search/results/people/"][href*="currentCompany"]',
		);
		for (const a of anchors) {
			try {
				const href = a.getAttribute("href") || "";
				const url = new URL(href, location.origin);
				const values = url.searchParams.getAll("currentCompany");
				if (!values.length) continue;
				const match = /\[\s*"?(\d+)"?/.exec(values[0] || "");
				if (match?.[1]) return match[1];
			} catch {
				/* continue */
			}
		}
		return null;
	});
	return urn ?? null;
}
