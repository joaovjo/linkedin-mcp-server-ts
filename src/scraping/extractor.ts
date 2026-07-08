import { browserManager } from "../browser/manager.ts";
import { LINKEDIN_BASE, type SectionDef } from "./fields.ts";

const NAV_DELAY = 2_000;
const RATE_LIMITED_MSG =
	"[Rate limited] LinkedIn blocked this section. Try again later or request fewer sections.";

export async function navigateAndExtract(url: string): Promise<string> {
	await browserManager.navigate(url);

	const mainText = await browserManager.evaluate<string>(
		"(() => (document.querySelector('main') || document.body)?.innerText?.trim() ?? '')()",
	);

	if (isRateLimited(mainText)) {
		return RATE_LIMITED_MSG;
	}

	return stripLinkedinNoise(mainText);
}

export async function extractSection(
	_sectionName: string,
	sectionDef: SectionDef,
	username: string,
): Promise<{ text: string; error?: string }> {
	try {
		const url =
			typeof sectionDef.url === "function"
				? sectionDef.url(username)
				: sectionDef.url;

		await browserManager.navigate(url);
		await delay(NAV_DELAY);

		const text = await browserManager.evaluate<string>(
			"(() => (document.querySelector('main') || document.body)?.innerText?.trim() ?? '')()",
		);

		if (isRateLimited(text)) {
			return { text: RATE_LIMITED_MSG, error: "rate_limited" };
		}

		const cleaned = stripLinkedinNoise(text);
		return { text: cleaned };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { text: "", error: message };
	}
}

export async function extractPersonProfile(username: string): Promise<string> {
	const url = `${LINKEDIN_BASE}/in/${username}/`;
	await browserManager.navigate(url);
	await delay(1000);

	const text = await browserManager.evaluate<string>(
		"(() => (document.querySelector('main') || document.body)?.innerText?.trim() ?? '')()",
	);

	if (isRateLimited(text)) {
		return RATE_LIMITED_MSG;
	}

	return stripLinkedinNoise(text);
}

export async function extractCompanyProfile(
	companyName: string,
): Promise<string> {
	const url = `${LINKEDIN_BASE}/company/${companyName}/`;
	await browserManager.navigate(url);
	await delay(1000);

	const text = await browserManager.evaluate<string>(
		"(() => (document.querySelector('main') || document.body)?.innerText?.trim() ?? '')()",
	);

	if (isRateLimited(text)) {
		return RATE_LIMITED_MSG;
	}

	return stripLinkedinNoise(text);
}

export async function getMainInnerText(): Promise<string> {
	const text = await browserManager.evaluate<string>(
		"(() => (document.querySelector('main') || document.body)?.innerText?.trim() ?? '')()",
	);
	return text;
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
