export const LINKEDIN_BASE = "https://www.linkedin.com";

export function buildProfileUrl(username: string, section?: string): string {
	const clean = normalizeUsername(username);
	let url = `${LINKEDIN_BASE}/in/${clean}/`;
	if (section) {
		url += `details/${section}/`;
	}
	return url;
}

export function buildCompanyUrl(slug: string, section?: string): string {
	const clean = normalizeCompanySlug(slug);
	let url = `${LINKEDIN_BASE}/company/${clean}/`;
	if (section) {
		url += `${section}/`;
	}
	return url;
}

export function buildJobUrl(jobId: string): string {
	return `${LINKEDIN_BASE}/jobs/view/${jobId}/`;
}

export function buildSearchUrl(
	type: "people" | "companies" | "jobs" | "content",
	params: Record<string, string | number | boolean | undefined>,
): string {
	const base = `${LINKEDIN_BASE}/search/results/${type}/`;
	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== "") {
			searchParams.append(key, String(value));
		}
	}

	return `${base}?${searchParams.toString()}`;
}

export function buildPeopleSearchUrl(params: {
	keywords: string;
	location?: string;
	network?: string[];
	currentCompany?: string;
}): string {
	const searchParams = new URLSearchParams();
	searchParams.append("keywords", params.keywords);
	if (params.location) searchParams.append("location", params.location);
	if (params.network) {
		searchParams.append("network", JSON.stringify(params.network));
	}
	if (params.currentCompany) searchParams.append("currentCompany", params.currentCompany);
	return `${LINKEDIN_BASE}/search/results/people/?${searchParams.toString()}`;
}

export function buildJobsSearchUrl(params: {
	keywords: string;
	location?: string;
	datePosted?: string;
	jobType?: string;
	experienceLevel?: string;
	workType?: string;
	easyApply?: boolean;
	sortBy?: string;
}): string {
	const searchParams = new URLSearchParams();
	searchParams.append("keywords", params.keywords);
	if (params.location) searchParams.append("location", params.location);

	const DATE_POSTED_MAP: Record<string, string> = {
		past_hour: "r3600",
		past_24_hours: "r86400",
		past_week: "r604800",
		past_month: "r2592000",
	};

	const SORT_BY_MAP: Record<string, string> = {
		date: "DD",
		relevance: "R",
	};

	if (params.datePosted) {
		searchParams.append("f_TPR", DATE_POSTED_MAP[params.datePosted] ?? params.datePosted);
	}
	if (params.jobType) searchParams.append("f_JT", params.jobType);
	if (params.experienceLevel) searchParams.append("f_E", params.experienceLevel);
	if (params.workType) searchParams.append("f_WT", params.workType);
	if (params.easyApply) searchParams.append("f_AL", "true");
	if (params.sortBy) {
		searchParams.append("sortBy", SORT_BY_MAP[params.sortBy] ?? params.sortBy);
	}

	return `${LINKEDIN_BASE}/jobs/search/?${searchParams.toString()}`;
}

export function buildMessagingUrl(threadId?: string, recipientUrn?: string): string {
	if (threadId) {
		return `${LINKEDIN_BASE}/messaging/thread/${threadId}/`;
	}
	if (recipientUrn) {
		return `${LINKEDIN_BASE}/messaging/compose/?recipient=${encodeURIComponent(recipientUrn)}`;
	}
	return `${LINKEDIN_BASE}/messaging/`;
}

export function normalizeUsername(input: string): string {
	let username = input.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "");
	username = username.replace(/\/$/, "");
	username = username.split("?")[0] ?? username;
	username = username.split("#")[0] ?? username;
	return username.toLowerCase();
}

export function normalizeCompanySlug(input: string): string {
	let slug = input.replace(/^https?:\/\/(www\.)?linkedin\.com\/company\//, "");
	slug = slug.replace(/\/$/, "");
	slug = slug.split("?")[0] ?? slug;
	slug = slug.split("#")[0] ?? slug;
	return slug.toLowerCase();
}

export function extractUsernameFromUrl(url: string): string | null {
	const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
	return match?.[1] ?? null;
}

export function extractCompanySlugFromUrl(url: string): string | null {
	const match = url.match(/linkedin\.com\/company\/([^/?#]+)/);
	return match?.[1] ?? null;
}

export function extractJobIdFromUrl(url: string): string | null {
	const match = url.match(/jobs\/view\/(\d+)/);
	return match?.[1] ?? null;
}

export function extractThreadIdFromUrl(url: string): string | null {
	const match = url.match(/messaging\/thread\/([^/?#]+)/);
	return match?.[1] ?? null;
}

export function isProfileUrl(url: string): boolean {
	return /linkedin\.com\/in\/[^/?#]+/.test(url);
}

export function isCompanyUrl(url: string): boolean {
	return /linkedin\.com\/company\/[^/?#]+/.test(url);
}

export function isJobUrl(url: string): boolean {
	return /linkedin\.com\/jobs\/view\/\d+/.test(url);
}

export function isMessagingUrl(url: string): boolean {
	return /linkedin\.com\/messaging\//.test(url);
}

export function joinUrl(base: string, path: string): string {
	const cleanBase = base.replace(/\/+$/, "");
	const cleanPath = path.replace(/^\/+/, "");
	return `${cleanBase}/${cleanPath}`;
}
