import { browserManager } from "../browser/manager.ts";
import { raiseToolError } from "../errors/handler.ts";
import { checkLoginState } from "../scraping/extractor.ts";
import type { ToolDef } from "./types.ts";

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

export function loadJobTools(): ToolDef[] {
	return [
		{
			name: "get_job_details",
			description: "Get job details for a specific job posting on LinkedIn",
			inputSchema: {
				type: "object",
				properties: {
					job_id: {
						type: "string",
						description: 'LinkedIn job ID (e.g., "4252026496", "3856789012")',
					},
				},
				required: ["job_id"],
			},
			handler: async (args) => {
				const jobId = args.job_id as string;
				if (!jobId) return raiseToolError(new Error("job_id is required"));

				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				const url = `https://www.linkedin.com/jobs/view/${jobId}/`;
				await browserManager.navigate(url);

				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);

				return {
					content: [{ type: "text", text }],
				};
			},
		},
		{
			name: "search_jobs",
			description:
				"Search for jobs on LinkedIn. " +
				"Returns job_ids that can be passed to get_job_details for full info.",
			inputSchema: {
				type: "object",
				properties: {
					keywords: {
						type: "string",
						description:
							'Search keywords (e.g., "software engineer", "data scientist")',
					},
					location: {
						type: "string",
						description:
							'Optional location filter (e.g., "San Francisco", "Remote")',
					},
					max_pages: {
						type: "number",
						description:
							"Maximum number of result pages to load (1-10, default 3)",
						default: 3,
					},
					date_posted: {
						type: "string",
						description:
							"Filter by posting date (past_hour, past_24_hours, past_week, past_month)",
					},
					job_type: {
						type: "string",
						description:
							"Filter by job type, comma-separated (full_time, part_time, contract, temporary, volunteer, internship, other)",
					},
					experience_level: {
						type: "string",
						description:
							"Filter by experience level, comma-separated (internship, entry, associate, mid_senior, director, executive)",
					},
					work_type: {
						type: "string",
						description:
							"Filter by work type, comma-separated (on_site, remote, hybrid)",
					},
					easy_apply: {
						type: "boolean",
						description: "Only show Easy Apply jobs (default false)",
						default: false,
					},
					sort_by: {
						type: "string",
						description: "Sort results (date, relevance)",
					},
				},
				required: ["keywords"],
			},
			handler: async (args) => {
				const keywords = encodeURIComponent(args.keywords as string);
				let url = `https://www.linkedin.com/jobs/search/?keywords=${keywords}`;

				if (args.location)
					url += `&location=${encodeURIComponent(args.location as string)}`;
				if (args.date_posted)
					url += `&f_TPR=${DATE_POSTED_MAP[args.date_posted as string] ?? args.date_posted}`;
				if (args.job_type) url += `&f_JT=${args.job_type}`;
				if (args.experience_level) url += `&f_E=${args.experience_level}`;
				if (args.work_type) url += `&f_WT=${args.work_type}`;
				if (args.easy_apply) url += `&f_AL=true`;
				if (args.sort_by)
					url += `&sortBy=${SORT_BY_MAP[args.sort_by as string] ?? args.sort_by}`;

				await browserManager.navigate(url);

				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);

				const jobIds = await browserManager.evaluate<string[]>(
					`(() => [...document.querySelectorAll('a[href*="/jobs/view/"]')].map(a => a.getAttribute('href')?.match(/\\/jobs\\/view\\/(\\d+)/)?.[1]).filter(Boolean))()`,
				);

				const result: Record<string, unknown> = { text, job_ids: jobIds };
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			},
		},
	];
}
