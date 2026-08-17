import { browserManager } from "../browser/manager.ts";
import {
	extractCompanyUrnFromDom,
	extractProfileUrn,
	extractRootContent,
} from "./dom-extract.ts";
import { LINKEDIN_BASE, type SectionDef } from "./fields.ts";
import { buildReferences, type Reference } from "./link-metadata.ts";

const NAV_DELAY = 2_000;
const RATE_LIMITED_MSG =
	"[Rate limited] LinkedIn blocked this section. Try again later or request fewer sections.";

export interface SectionExtractResult {
	text: string;
	references: Reference[];
	error?: string;
}

export async function navigateAndExtract(url: string): Promise<string> {
	await browserManager.navigate(url);
	await delay(NAV_DELAY);
	const { text } = await extractRootContent(browserManager);
	if (isRateLimited(text)) return RATE_LIMITED_MSG;
	return stripLinkedinNoise(text);
}

export async function extractSection(
	sectionName: string,
	sectionDef: SectionDef,
	username: string,
	maxScrolls?: number,
): Promise<SectionExtractResult> {
	try {
		const url =
			typeof sectionDef.url === "function"
				? sectionDef.url(username)
				: sectionDef.url;

		await browserManager.navigate(url);
		await delay(NAV_DELAY);

		const isDetails = url.includes("/details/");
		const isActivity = url.includes("/recent-activity/");
		const isContactOverlay = url.includes("/overlay/contact-info/");

		if (isDetails) {
			await clickShowMore(maxScrolls ?? 5);
		}

		const scrolls = maxScrolls ?? (isActivity ? 10 : 5);
		if (isActivity) {
			await scrollToBottom(scrolls, 1000);
		} else if (!isDetails) {
			await scrollMainScrollable("bottom", Math.min(scrolls, 5), 500);
		} else {
			await scrollToBottom(Math.min(scrolls, 3), 400);
		}

		const preferDialog = isContactOverlay || sectionName === "contact_info";
		const raw = await extractRootContent(browserManager, {
			preferDialog,
		});

		if (isRateLimited(raw.text)) {
			return {
				text: RATE_LIMITED_MSG,
				references: [],
				error: "rate_limited",
			};
		}

		const cleaned = stripLinkedinNoise(raw.text);
		return {
			text: cleaned,
			references: buildReferences(raw.references, sectionName),
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { text: "", references: [], error: message };
	}
}

export async function extractPersonProfile(
	username: string,
): Promise<SectionExtractResult> {
	const url = `${LINKEDIN_BASE}/in/${username}/`;
	await browserManager.navigate(url);
	await delay(1000);
	await scrollMainScrollable("bottom", 2, 400);

	const raw = await extractRootContent(browserManager);
	if (isRateLimited(raw.text)) {
		return { text: RATE_LIMITED_MSG, references: [], error: "rate_limited" };
	}
	return {
		text: stripLinkedinNoise(raw.text),
		references: buildReferences(raw.references, "main_profile"),
	};
}

export async function extractCompanyProfile(
	companyName: string,
): Promise<SectionExtractResult & { company_urn?: string }> {
	const url = `${LINKEDIN_BASE}/company/${companyName}/about/`;
	await browserManager.navigate(url);
	await delay(1000);
	await scrollMainScrollable("bottom", 2, 400);

	const raw = await extractRootContent(browserManager);
	if (isRateLimited(raw.text)) {
		return { text: RATE_LIMITED_MSG, references: [], error: "rate_limited" };
	}

	const companyUrn = await extractCompanyUrnFromDom(browserManager);
	const refs = buildReferences(raw.references, "about");
	if (companyUrn) {
		refs.unshift({
			kind: "company_urn",
			url: `/search/results/people/?currentCompany=%5B%22${companyUrn}%22%5D`,
			value: companyUrn,
			context: "about",
		});
	}

	return {
		text: stripLinkedinNoise(raw.text),
		references: refs,
		company_urn: companyUrn ?? undefined,
	};
}

export async function getPersonProfileUrn(): Promise<string | null> {
	return extractProfileUrn(browserManager);
}

export async function getMainInnerText(): Promise<string> {
	const raw = await extractRootContent(browserManager);
	return raw.text;
}

export async function checkLoginState(): Promise<boolean> {
	const isLoggedIn = await browserManager.evaluate<boolean>(
		"!!document.querySelector('.global-nav__primary-link, .global-nav__me, .search-global-typeahead')",
	);

	if (isLoggedIn) return true;

	const currentUrl = await browserManager.getCurrentUrl();
	const blockerPatterns = [
		"/login",
		"/authwall",
		"/checkpoint",
		"/challenge",
		"/signup",
	];
	return !blockerPatterns.some((p) => currentUrl.includes(p));
}

export function scrollFeed(): Promise<void> {
	return browserManager.scroll(0, 2000);
}

export async function getCurrentUrl(): Promise<string> {
	return await browserManager.getCurrentUrl();
}

/** Click ^Show (more|all) buttons inside main (details pages). */
export async function clickShowMore(maxClicks: number): Promise<number> {
	let clicked = 0;
	for (let i = 0; i < maxClicks; i++) {
		const didClick = await browserManager.evaluate<boolean>(() => {
			const buttons = [
				...document.querySelectorAll("main button"),
			] as HTMLButtonElement[];
			const target = buttons.find((btn) => {
				const t = (btn.innerText || btn.textContent || "").trim();
				return /^Show (more|all)\b/i.test(t);
			});
			if (!target) return false;
			const style = window.getComputedStyle(target);
			if (style.display === "none" || style.visibility === "hidden")
				return false;
			target.scrollIntoView({ block: "center" });
			target.click();
			return true;
		});
		if (!didClick) break;
		clicked++;
		await delay(1000);
	}
	return clicked;
}

/** Scroll the largest scrollable region inside main. */
export async function scrollMainScrollable(
	position: "top" | "bottom",
	attempts: number,
	pauseMs = 500,
): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		await browserManager.evaluate((pos: string) => {
			const main = document.querySelector("main");
			if (!main) return false;

			const isScrollable = (element: Element) => {
				const style = window.getComputedStyle(element);
				return (
					(style.overflowY === "auto" || style.overflowY === "scroll") &&
					(element as HTMLElement).scrollHeight >
						(element as HTMLElement).clientHeight + 20
				);
			};

			const candidates = [main, ...main.querySelectorAll("*")].filter(
				isScrollable,
			) as HTMLElement[];
			const target =
				candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ||
				(main as HTMLElement);
			target.scrollTop = pos === "top" ? 0 : target.scrollHeight;
			return true;
		}, position);
		await delay(pauseMs);
	}
}

export async function scrollToBottom(
	maxScrolls: number,
	pauseMs = 500,
): Promise<void> {
	for (let i = 0; i < maxScrolls; i++) {
		await scrollMainScrollable("bottom", 1, 0);
		await browserManager.scroll(0, 1400);
		await delay(pauseMs);
	}
}

export async function scrollJobSidebar(
	maxScrolls = 5,
	pauseMs = 500,
): Promise<void> {
	for (let i = 0; i < maxScrolls; i++) {
		await browserManager.evaluate(() => {
			const selectors = [
				".jobs-search-results-list",
				".scaffold-layout__list",
				"div.jobs-search-results-list",
				'[data-results-list-container="true"]',
				"main ul",
			];
			let target: HTMLElement | null = null;
			for (const sel of selectors) {
				const el = document.querySelector(sel) as HTMLElement | null;
				if (el && el.scrollHeight > el.clientHeight + 20) {
					target = el;
					break;
				}
			}
			if (!target) {
				const main = document.querySelector("main");
				if (!main) return false;
				const candidates = [main, ...main.querySelectorAll("*")].filter(
					(el) => {
						const style = window.getComputedStyle(el);
						return (
							(style.overflowY === "auto" || style.overflowY === "scroll") &&
							(el as HTMLElement).scrollHeight >
								(el as HTMLElement).clientHeight + 20
						);
					},
				) as HTMLElement[];
				target =
					candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null;
			}
			if (!target) {
				window.scrollBy(0, 1200);
				return false;
			}
			target.scrollTop = target.scrollHeight;
			return true;
		});
		await delay(pauseMs);
	}
}

export async function extractJobIds(): Promise<string[]> {
	return (
		(await browserManager.evaluate<string[]>(() => {
			const links = document.querySelectorAll('a[href*="/jobs/view/"]');
			const seen = new Set<string>();
			const ids: string[] = [];
			for (const a of links) {
				const match = (a as HTMLAnchorElement).href.match(
					/\/jobs\/view\/(\d+)/,
				);
				if (match?.[1] && !seen.has(match[1])) {
					seen.add(match[1]);
					ids.push(match[1]);
				}
			}
			return ids;
		})) ?? []
	);
}

function delay(ms: number): Promise<void> {
	return Bun.sleep(ms);
}

function isRateLimited(text: string): boolean {
	const lower = text.toLowerCase();
	return (
		lower.includes("rate limited") ||
		lower.includes("too many requests") ||
		lower.includes("try again later")
	);
}

const NOISE_PATTERNS: RegExp[] = [
	/^About\n+(?:Accessibility|Talent Solutions)/m,
	/^More profiles for you$/m,
	/^Explore premium profiles$/m,
	/^Get up to .+ replies when you message with InMail$/m,
	/^(?:Careers|Privacy & Terms|Questions\?|Select language)\n+(?:Privacy & Terms|Questions\?|Select language|Advertising|Ad Choices|[A-Za-z]+ \([A-Za-z]+\))/m,
];

const NOISE_LINES: RegExp[] = [
	/^(?:Play|Pause|Playback speed|Turn fullscreen on|Fullscreen)$/,
	/^(?:Show captions|Close modal window|Media player modal window)$/,
	/^(?:Loaded:.*|Remaining time.*|Stream Type.*)$/,
];

export function stripLinkedinNoise(text: string): string {
	let cleaned = text;

	for (const pattern of NOISE_PATTERNS) {
		const match = pattern.exec(cleaned);
		if (match) {
			cleaned = cleaned.slice(0, match.index);
		}
	}

	const lines = cleaned.split("\n").filter((line) => {
		const trimmed = line.trim();
		return !NOISE_LINES.some((nl) => nl.test(trimmed));
	});

	return lines.join("\n").trim();
}
