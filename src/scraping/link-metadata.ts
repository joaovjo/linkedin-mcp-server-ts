/** Port of linkedin_mcp_server/scraping/link_metadata.py */

export type ReferenceKind =
	| "person"
	| "company"
	| "company_urn"
	| "job"
	| "feed_post"
	| "article"
	| "newsletter"
	| "school"
	| "conversation"
	| "external";

export interface Reference {
	kind: ReferenceKind;
	url: string;
	text?: string;
	context?: string;
	value?: string;
}

export interface RawReference {
	href?: string;
	text?: string;
	aria_label?: string;
	title?: string;
	heading?: string;
	in_article?: boolean;
	in_nav?: boolean;
	in_footer?: boolean;
}

const GENERIC_LABELS = new Set([
	"show all",
	"follow",
	"following",
	"connect",
	"send",
	"like",
	"comment",
	"repost",
	"post",
	"play",
	"pause",
	"fullscreen",
	"close",
	"manage notifications",
	"view my newsletter",
	"my newsletter",
]);

const CONTEXT_LABELS = new Set([
	"about",
	"experience",
	"education",
	"interests",
	"honors",
	"languages",
	"featured",
	"contact info",
]);

const SECTION_CONTEXTS: Record<string, string> = {
	experience: "experience",
	education: "education",
	interests: "interests",
	honors: "honors",
	languages: "languages",
	contact_info: "contact info",
	job_posting: "job posting",
	inbox: "inbox",
	conversation: "conversation",
};

const DEFAULT_REFERENCE_CAP = 12;
export const REFERENCE_CAPS: Record<string, number> = {
	main_profile: 12,
	about: 12,
	experience: 12,
	education: 12,
	interests: 12,
	honors: 12,
	languages: 12,
	posts: 12,
	jobs: 8,
	search_results: 15,
	job_posting: 8,
	contact_info: 8,
	inbox: 30,
	conversation: 12,
	feed: 50,
	employees: 30,
};

const FIRST_URN_RE = /\[\s*"?(\d+)"?/;
const PERSON_PATH_RE = /^\/in\/([^/?#]+)/;
const COMPANY_PATH_RE = /^\/company\/([^/?#]+)/;
const SCHOOL_PATH_RE = /^\/school\/([^/?#]+)/;
const JOB_PATH_RE = /^\/jobs\/view\/(\d+)/;
const NEWSLETTER_PATH_RE = /^\/newsletters\/([^/?#]+)/;
const PULSE_PATH_RE = /^\/pulse\/([^/?#]+)/;
const FEED_PATH_RE = /^\/feed\/update\/([^/?#]+)/;
const MESSAGING_THREAD_PATH_RE = /^\/messaging\/thread\/([^/?#]+)/;
const POSTS_PATH_RE = /^\/posts\/([^/?#]+)/;
const MAX_REDIRECT_UNWRAP_DEPTH = 5;
const WHITESPACE_RE = /\s+/g;
const URL_LIKE_RE = /^(?:https?:\/\/|\/)\S+$/i;
const DUPLICATE_HALVES_RE = /^(?<value>.+?)\s+\k<value>$/;
const CONNECTIONS_FOLLOW_RE = /\bconnections follow this page\b/i;
const LABEL_CONTENT_RE = /[^\W_\u115f\u1160\u3164\uffa0]/u;

function isLinkedInHost(host: string): boolean {
	return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

function isLinkedInChrome(path: string): boolean {
	let p = path.split("?", 1)[0]!.split("#", 1)[0]!;
	if (!p.startsWith("/")) p = `/${p}`;
	const segments = p.split("/").filter(Boolean);
	if (!segments.length) return false;
	const first = segments[0]!;
	const second = segments[1] ?? "";
	if (
		[
			"help",
			"legal",
			"about",
			"accessibility",
			"mypreferences",
			"preferences",
		].includes(first)
	) {
		return true;
	}
	if (first === "search" && second === "results") return true;
	if (
		first === "overlay" &&
		["background-photo", "browsemap-recommendations"].includes(second)
	) {
		return true;
	}
	return first === "preload" && second === "custom-invite";
}

export function firstCompanyUrnFromQuery(query: string): string | null {
	const params = new URLSearchParams(
		query.startsWith("?") ? query.slice(1) : query,
	);
	const values = params.getAll("currentCompany");
	if (!values.length) return null;
	const match = FIRST_URN_RE.exec(values[0]!);
	return match?.[1] ?? null;
}

export function normalizeUrl(href: string, depth = 0): string | null {
	if (depth > MAX_REDIRECT_UNWRAP_DEPTH) return null;
	href = href.trim();
	if (!href || href.startsWith("#")) return null;

	let parsed: URL;
	try {
		parsed = new URL(href, "https://www.linkedin.com");
	} catch {
		return null;
	}

	const scheme = parsed.protocol.replace(":", "").toLowerCase();
	if (["blob", "javascript", "mailto", "tel"].includes(scheme)) return null;
	if (scheme && !["http", "https"].includes(scheme)) return null;

	const host = parsed.hostname.toLowerCase();
	if (isLinkedInHost(host) && parsed.pathname === "/redir/redirect/") {
		const target = decodeURIComponent(
			parsed.searchParams.get("url") ?? "",
		).trim();
		if (!target) return null;
		return normalizeUrl(target, depth + 1);
	}

	if (!parsed.protocol.startsWith("http")) return null;

	parsed.hash = "";
	const path = parsed.pathname || "/";
	const search = parsed.search || "";
	return `${parsed.origin}${path}${search}`;
}

export function classifyLink(href: string): [ReferenceKind, string] | null {
	const normalized = normalizeUrl(href);
	if (!normalized) return null;

	let parsed: URL;
	try {
		parsed = new URL(normalized);
	} catch {
		return null;
	}

	const host = parsed.hostname.toLowerCase();
	const path = parsed.pathname || "/";

	if (!isLinkedInHost(host)) {
		return [
			"external",
			`${parsed.protocol}//${parsed.host}${parsed.pathname || "/"}`,
		];
	}

	if (path.replace(/\/$/, "") === "/search/results/people") {
		const urnId = firstCompanyUrnFromQuery(parsed.search);
		if (urnId) {
			return [
				"company_urn",
				`/search/results/people/?currentCompany=%5B%22${urnId}%22%5D`,
			];
		}
	}

	if (isLinkedInChrome(path)) return null;

	let match = PERSON_PATH_RE.exec(path);
	if (match) {
		const personSuffix = path.slice(match[0].length).replace(/^\//, "");
		const firstSuffix = personSuffix.split("/", 1)[0] ?? "";
		if (["overlay", "details", "recent-activity"].includes(firstSuffix)) {
			return null;
		}
		return ["person", `/in/${match[1]}/`];
	}

	match = COMPANY_PATH_RE.exec(path);
	if (match) return ["company", `/company/${match[1]}/`];

	match = SCHOOL_PATH_RE.exec(path);
	if (match) return ["school", `/school/${match[1]}/`];

	match = JOB_PATH_RE.exec(path);
	if (match) return ["job", `/jobs/view/${match[1]}/`];

	match = NEWSLETTER_PATH_RE.exec(path);
	if (match) return ["newsletter", `/newsletters/${match[1]}/`];

	match = PULSE_PATH_RE.exec(path);
	if (match) return ["article", `/pulse/${match[1]}/`];

	match = FEED_PATH_RE.exec(path);
	if (match) return ["feed_post", `/feed/update/${match[1]}/`];

	match = POSTS_PATH_RE.exec(path);
	if (match) return ["feed_post", `/posts/${match[1]}`];

	match = MESSAGING_THREAD_PATH_RE.exec(path);
	if (match) return ["conversation", `/messaging/thread/${match[1]}/`];

	return null;
}

export function cleanLabel(value: string, kind: ReferenceKind): string | null {
	value = value.replace(WHITESPACE_RE, " ").trim();
	if (!value) return null;

	value = value.replace(/^(?:View:\s*|View\b\s+|Open article:\s*)/i, "");
	value = value.replace(/[’']s\s+graphic link$/i, "");
	value = value.replace(/\s+graphic link$/i, "");
	value = value.replace(/^[\s:-]+|[\s:-]+$/g, "");

	if (value.includes(" by ") && (kind === "article" || kind === "external")) {
		value = value.split(" by ", 1)[0]!.trim();
	}

	for (const separator of [" • ", " · ", " | "]) {
		if (value.includes(separator)) {
			value = value.split(separator, 1)[0]!.trim();
		}
	}

	const duplicateMatch = DUPLICATE_HALVES_RE.exec(value);
	if (duplicateMatch?.groups?.value) {
		value = duplicateMatch.groups.value.trim();
	}

	if (URL_LIKE_RE.test(value)) return null;
	if (CONNECTIONS_FOLLOW_RE.test(value)) return null;
	if (GENERIC_LABELS.has(value.toLowerCase())) return null;
	if (value.length < 2 || value.length > 80) return null;
	if (!LABEL_CONTENT_RE.test(value)) return null;
	return value;
}

function chooseReferenceText(
	raw: RawReference,
	kind: ReferenceKind,
): string | null {
	const candidates: Array<[number, string]> = [];
	for (const [priority, candidate] of [
		[0, raw.text ?? ""],
		[1, raw.aria_label ?? ""],
		[2, raw.title ?? ""],
	] as Array<[number, string]>) {
		const cleaned = cleanLabel(candidate, kind);
		if (cleaned) candidates.push([priority, cleaned]);
	}
	if (!candidates.length) return null;
	candidates.sort((a, b) => {
		const keyA = [a[1].length < 3 ? 1 : 0, a[1].length, a[0]] as const;
		const keyB = [b[1].length < 3 ? 1 : 0, b[1].length, b[0]] as const;
		return keyA[0] - keyB[0] || keyA[1] - keyB[1] || keyA[2] - keyB[2];
	});
	return candidates[0]![1];
}

function cleanHeading(value: string): string | null {
	value = value.replace(WHITESPACE_RE, " ").trim().toLowerCase();
	if (!value) return null;
	return CONTEXT_LABELS.has(value) ? value : null;
}

function deriveContext(
	sectionName: string,
	raw: RawReference,
	kind: ReferenceKind,
): string | null {
	if (sectionName in SECTION_CONTEXTS) return SECTION_CONTEXTS[sectionName]!;
	const heading = cleanHeading(raw.heading ?? "");

	if (sectionName === "search_results") {
		return kind === "job" ? "job result" : "search result";
	}
	if (sectionName === "posts") {
		if (kind === "person") return "post author";
		if (kind === "feed_post") return "company post";
		return "post attachment";
	}
	if (sectionName === "main_profile" || sectionName === "about") {
		if (heading) return heading;
		if (raw.in_article) return "featured";
		return "top card";
	}
	return heading;
}

export function normalizeReference(
	raw: RawReference,
	sectionName: string,
): Reference | null {
	if (raw.in_nav || raw.in_footer) return null;
	const href = normalizeUrl(raw.href ?? "");
	if (!href) return null;
	const kindUrl = classifyLink(href);
	if (!kindUrl) return null;
	const [kind, normalizedUrl] = kindUrl;

	let text: string | null = null;
	if (kind !== "company_urn") {
		text = chooseReferenceText(raw, kind);
	}
	if (
		text === null &&
		!["feed_post", "external", "conversation", "company_urn"].includes(kind)
	) {
		return null;
	}

	const reference: Reference = { kind, url: normalizedUrl };
	if (kind === "company_urn") {
		const urnId = firstCompanyUrnFromQuery(
			normalizedUrl.includes("?")
				? normalizedUrl.slice(normalizedUrl.indexOf("?") + 1)
				: "",
		);
		if (urnId) reference.value = urnId;
	}
	if (text) reference.text = text;
	const context = deriveContext(sectionName, raw, kind);
	if (context) reference.context = context;
	return reference;
}

function referenceScore(ref: Reference): [number, number, number] {
	return [
		ref.text ? 1 : 0,
		ref.context ? 1 : 0,
		ref.text?.length ?? Number.NEGATIVE_INFINITY,
	];
}

export function dedupeReferences(
	references: Reference[],
	cap?: number,
): Reference[] {
	const deduped = new Map<string, Reference>();
	const orderedUrls: string[] = [];
	for (const reference of references) {
		const existing = deduped.get(reference.url);
		if (!existing) {
			deduped.set(reference.url, reference);
			orderedUrls.push(reference.url);
			continue;
		}
		const a = referenceScore(existing);
		const b = referenceScore(reference);
		const better =
			b[0] > a[0] ||
			(b[0] === a[0] && b[1] > a[1]) ||
			(b[0] === a[0] && b[1] === a[1] && b[2] > a[2]);
		if (better) deduped.set(reference.url, reference);
	}
	const ordered = orderedUrls.map((u) => deduped.get(u)!);
	return cap !== undefined ? ordered.slice(0, cap) : ordered;
}

export function buildReferences(
	rawReferences: RawReference[],
	sectionName: string,
): Reference[] {
	const cap = REFERENCE_CAPS[sectionName] ?? DEFAULT_REFERENCE_CAP;
	const normalized: Reference[] = [];
	for (const raw of rawReferences) {
		const n = normalizeReference(raw, sectionName);
		if (n) normalized.push(n);
	}
	return dedupeReferences(normalized, cap);
}

export function buildFeedReferences(
	rawReferences: RawReference[],
	extraRelativeUrls: string[] = [],
): Reference[] {
	const fromDom = buildReferences(rawReferences, "feed").filter(
		(r) => r.kind === "feed_post",
	);
	const extras: Reference[] = [];
	for (const url of extraRelativeUrls) {
		const classified = classifyLink(
			url.startsWith("http") || url.startsWith("/")
				? url.startsWith("http")
					? url
					: `https://www.linkedin.com${url}`
				: `https://www.linkedin.com/${url}`,
		);
		if (classified?.[0] === "feed_post") {
			extras.push({ kind: "feed_post", url: classified[1], context: "feed" });
		}
	}
	return dedupeReferences([...fromDom, ...extras], 50);
}

export function jobIdFromUrl(url: string): string | null {
	const c = classifyLink(url);
	if (c?.[0] !== "job") return null;
	const m = /\/jobs\/view\/(\d+)/.exec(c[1]);
	return m?.[1] ?? null;
}
