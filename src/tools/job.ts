import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.ts";
import { browserManager } from "../browser/manager.ts";
import {
	extractJobIds,
	getCurrentUrl,
	scrollJobSidebar,
	stripLinkedinNoise,
} from "../scraping/extractor.ts";
import { LINKEDIN_BASE } from "../scraping/fields.ts";
import {
	buildReferences,
	dedupeReferences,
	type Reference,
} from "../scraping/references.ts";
import { extractRootContent } from "../scraping/dom-extract.ts";
import {
	applySectionText,
	isRateLimitedText,
	normalizeCsv,
	type SectionErrorInfo,
} from "../scraping/section-result.ts";
import { toolJson, wrapTool } from "./helpers.ts";

const DATE_POSTED_MAP: Record<string, string> = {
	past_hour: "r3600",
	past_24_hours: "r86400",
	past_week: "r604800",
	past_month: "r2592000",
};

const JOB_TYPE_MAP: Record<string, string> = {
	full_time: "F",
	part_time: "P",
	contract: "C",
	temporary: "T",
	volunteer: "V",
	internship: "I",
	other: "O",
};

const EXPERIENCE_LEVEL_MAP: Record<string, string> = {
	internship: "1",
	entry: "2",
	associate: "3",
	mid_senior: "4",
	director: "5",
	executive: "6",
};

const WORK_TYPE_MAP: Record<string, string> = {
	on_site: "1",
	remote: "2",
	hybrid: "3",
};

const SORT_BY_MAP: Record<string, string> = {
	date: "DD",
	relevance: "R",
};

const PAGE_SIZE = 25;
const SAVED_JOBS_URL = `${LINKEDIN_BASE}/my-items/saved-jobs/`;
const SAVED_JOBS_PAGE_SIZE = 10;

export function registerJobTools(server: McpServer, config: AppConfig): void {
	server.registerTool(
		"get_job_details",
		{
			title: "Get Job Details",
			description: "Get detailed information about a specific job posting",
			inputSchema: z.object({
				job_id: z.string().describe("LinkedIn job ID"),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const url = `${LINKEDIN_BASE}/jobs/view/${args.job_id}/`;
				await browserManager.navigate(url);
				await Bun.sleep(1500);
				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(
					sections,
					sectionErrors,
					"job_posting",
					stripLinkedinNoise(raw.text),
				);
				const refs = buildReferences(raw.references, "job_posting");
				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections,
				};
				if (refs.length) result.references = { job_posting: refs };
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);

	server.registerTool(
		"search_jobs",
		{
			title: "Search Jobs",
			description:
				"Search for jobs on LinkedIn. Returns job_ids that can be passed to get_job_details.",
			inputSchema: z.object({
				keywords: z.string(),
				location: z.string().optional(),
				max_pages: z.number().int().min(1).max(10).optional().default(3),
				date_posted: z.string().optional(),
				job_type: z.string().optional(),
				experience_level: z.string().optional(),
				work_type: z.string().optional(),
				easy_apply: z.boolean().optional(),
				sort_by: z.enum(["date", "relevance"]).optional(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const params = new URLSearchParams({ keywords: args.keywords });
				if (args.location) params.set("location", args.location);
				if (args.date_posted && DATE_POSTED_MAP[args.date_posted]) {
					params.set("f_TPR", DATE_POSTED_MAP[args.date_posted]!);
				}
				if (args.sort_by && SORT_BY_MAP[args.sort_by]) {
					params.set("sortBy", SORT_BY_MAP[args.sort_by]!);
				}
				if (args.easy_apply) params.set("f_EA", "true");
				if (args.job_type) {
					params.set("f_JT", normalizeCsv(args.job_type, JOB_TYPE_MAP));
				}
				if (args.experience_level) {
					params.set(
						"f_E",
						normalizeCsv(args.experience_level, EXPERIENCE_LEVEL_MAP),
					);
				}
				if (args.work_type) {
					params.set("f_WT", normalizeCsv(args.work_type, WORK_TYPE_MAP));
				}

				const baseUrl = `${LINKEDIN_BASE}/jobs/search/?${params}`;
				const maxPages = args.max_pages ?? 3;
				const allIds: string[] = [];
				const seen = new Set<string>();
				const pageTexts: string[] = [];
				const allRefs: Reference[] = [];
				const sectionErrors: Record<string, SectionErrorInfo> = {};

				for (let pageNum = 0; pageNum < maxPages; pageNum++) {
					const pageUrl =
						pageNum === 0
							? baseUrl
							: `${baseUrl}&start=${pageNum * PAGE_SIZE}`;
					await browserManager.navigate(pageUrl);
					await Bun.sleep(1200);
					await scrollJobSidebar(5, 500);

					const raw = await extractRootContent(browserManager);
					const cleaned = stripLinkedinNoise(raw.text);
					if (isRateLimitedText(cleaned)) {
						sectionErrors.search_results = {
							error_type: "rate_limited",
							error_message: cleaned,
						};
						break;
					}

					const pageIds = await extractJobIds();
					let newCount = 0;
					for (const id of pageIds) {
						if (seen.has(id)) continue;
						seen.add(id);
						allIds.push(id);
						allRefs.push({
							kind: "job",
							url: `/jobs/view/${id}/`,
							value: id,
							context: "job result",
						});
						newCount++;
					}

					pageTexts.push(cleaned);
					if (newCount === 0 && pageNum > 0) break;
					if (pageIds.length === 0) break;
				}

				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections: pageTexts.length
						? { search_results: pageTexts.join("\n\n") }
						: {},
					job_ids: allIds,
				};
				if (allRefs.length) {
					result.references = {
						search_results: allRefs.slice(0, 50),
					};
				}
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);

	server.registerTool(
		"get_saved_jobs",
		{
			title: "Get Saved Jobs",
			description:
				"List the authenticated user's saved LinkedIn job postings. Returns job_ids usable with get_job_details.",
			inputSchema: z.object({
				max_pages: z.number().int().min(1).max(10).optional().default(3),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const maxPages = args.max_pages ?? 3;
				const allIds: string[] = [];
				const seen = new Set<string>();
				const pageTexts: string[] = [];
				const pageReferences: Reference[] = [];
				const sectionErrors: Record<string, SectionErrorInfo> = {};

				for (let pageNum = 0; pageNum < maxPages; pageNum++) {
					const url =
						pageNum === 0
							? SAVED_JOBS_URL
							: `${SAVED_JOBS_URL}?start=${pageNum * SAVED_JOBS_PAGE_SIZE}`;
					await browserManager.navigate(url);
					await Bun.sleep(1200);

					const raw = await extractRootContent(browserManager);
					const cleaned = stripLinkedinNoise(raw.text);
					if (!cleaned || isRateLimitedText(cleaned)) {
						if (isRateLimitedText(cleaned)) {
							sectionErrors.saved_jobs = {
								error_type: "rate_limited",
								error_message: cleaned,
							};
						}
						break;
					}

					const currentUrl = await getCurrentUrl();
					const refs = buildReferences(raw.references, "jobs");
					if (!currentUrl.includes("/my-items/saved-jobs")) {
						pageTexts.push(cleaned);
						pageReferences.push(...refs);
						break;
					}

					const pageIds = await extractJobIds();
					const newIds = pageIds.filter((id) => !seen.has(id));
					if (!newIds.length) {
						pageTexts.push(cleaned);
						pageReferences.push(...refs);
						break;
					}
					for (const id of newIds) {
						seen.add(id);
						allIds.push(id);
					}
					pageTexts.push(cleaned);
					pageReferences.push(...refs);
				}

				const result: Record<string, unknown> = {
					url: SAVED_JOBS_URL,
					sections: pageTexts.length
						? { saved_jobs: pageTexts.join("\n---\n") }
						: {},
					job_ids: allIds,
				};
				if (pageReferences.length) {
					result.references = {
						saved_jobs: dedupeReferences(pageReferences, 15),
					};
				}
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);
}
