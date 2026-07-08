import { browserManager } from "../browser/manager.ts";
import { raiseToolError } from "../errors/handler.ts";
import {
	checkLoginState,
	extractCompanyProfile,
} from "../scraping/extractor.ts";
import type { ToolDef } from "./types.ts";

export function loadCompanyTools(): ToolDef[] {
	return [
		{
			name: "get_company_profile",
			description:
				"Get a specific company's LinkedIn profile. " +
				"The about page is always included. " +
				'Available sections: posts, jobs. Examples: "posts", "posts,jobs"',
			inputSchema: {
				type: "object",
				properties: {
					company_name: {
						type: "string",
						description:
							'LinkedIn company name (e.g., "docker", "anthropic", "microsoft")',
					},
					sections: {
						type: "string",
						description:
							"Comma-separated list of extra sections to scrape. " +
							"The about page is always included. " +
							'Available sections: posts, jobs. Examples: "posts", "posts,jobs"',
					},
				},
				required: ["company_name"],
			},
			handler: async (args) => {
				const companyName = args.company_name as string;
				if (!companyName)
					return raiseToolError(new Error("company_name is required"));

				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				const sections: Record<string, string> = {};
				sections.about = await extractCompanyProfile(companyName);

				const sectionsParam = args.sections as string | undefined;
				if (sectionsParam) {
					const names = sectionsParam
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
					for (const name of names) {
						if (name === "posts") {
							await browserManager.navigate(
								`https://www.linkedin.com/company/${companyName}/`,
							);
							sections.posts = await browserManager.evaluate<string>(
								"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
							);
						} else if (name === "jobs") {
							await browserManager.navigate(
								`https://www.linkedin.com/company/${companyName}/jobs/`,
							);
							sections.jobs = await browserManager.evaluate<string>(
								"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
							);
						}
					}
				}

				const currentUrl = await browserManager.getCurrentUrl();
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ url: currentUrl, sections }, null, 2),
						},
					],
				};
			},
		},
		{
			name: "get_company_posts",
			description: "Get recent posts from a company's LinkedIn feed",
			inputSchema: {
				type: "object",
				properties: {
					company_name: {
						type: "string",
						description:
							'LinkedIn company name (e.g., "docker", "anthropic", "microsoft")',
					},
				},
				required: ["company_name"],
			},
			handler: async (args) => {
				const companyName = args.company_name as string;
				if (!companyName)
					return raiseToolError(new Error("company_name is required"));

				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				await browserManager.navigate(
					`https://www.linkedin.com/company/${companyName}/`,
				);
				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);
				return { content: [{ type: "text", text }] };
			},
		},
		{
			name: "search_companies",
			description: "Search for companies on LinkedIn",
			inputSchema: {
				type: "object",
				properties: {
					keywords: {
						type: "string",
						description:
							'Search keywords (e.g., "fintech", "anthropic", "electric vehicles")',
					},
				},
				required: ["keywords"],
			},
			handler: async (args) => {
				const keywords = encodeURIComponent(args.keywords as string);
				const url = `https://www.linkedin.com/search/results/companies/?keywords=${keywords}`;
				await browserManager.navigate(url);
				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);
				return { content: [{ type: "text", text }] };
			},
		},
		{
			name: "get_company_employees",
			description:
				"List employees at a company including demographics. " +
				"company_name must be the exact LinkedIn URL slug, not the display name.",
			inputSchema: {
				type: "object",
				properties: {
					company_name: {
						type: "string",
						description:
							'LinkedIn company URL slug (e.g., "docker", "anthropicresearch", "microsoft")',
					},
					keywords: {
						type: "string",
						description:
							'Optional filter by name, job title, or skill (e.g., "engineer", "sales")',
					},
				},
				required: ["company_name"],
			},
			handler: async (args) => {
				const companyName = args.company_name as string;
				if (!companyName)
					return raiseToolError(new Error("company_name is required"));

				let url = `https://www.linkedin.com/company/${companyName}/people/`;
				if (args.keywords) {
					url += `?keywords=${encodeURIComponent(args.keywords as string)}`;
				}

				await browserManager.navigate(url);
				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);
				return { content: [{ type: "text", text }] };
			},
		},
	];
}
