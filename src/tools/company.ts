import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { browserManager } from "../browser/manager.ts";
import type { AppConfig } from "../config.ts";
import { extractRootContent } from "../scraping/dom-extract.ts";
import {
	extractCompanyProfile,
	extractSection,
	getCurrentUrl,
	scrollToBottom,
	stripLinkedinNoise,
} from "../scraping/extractor.ts";
import { COMPANY_SECTIONS, LINKEDIN_BASE } from "../scraping/fields.ts";
import {
	buildReferences,
	extractProfileReferences,
	type Reference,
} from "../scraping/references.ts";
import {
	applySectionText,
	type SectionErrorInfo,
} from "../scraping/section-result.ts";
import { toolJson, wrapTool } from "./helpers.ts";

const COMPANY_SECTION_NAMES = new Set(Object.keys(COMPANY_SECTIONS));

export function registerCompanyTools(
	server: McpServer,
	config: AppConfig,
): void {
	server.registerTool(
		"get_company_profile",
		{
			title: "Get Company Profile",
			description:
				"Get a specific company's LinkedIn profile. The about page is always included. Available sections: posts, jobs",
			inputSchema: z.object({
				company_name: z
					.string()
					.describe('LinkedIn company slug (e.g., "docker", "anthropic")'),
				sections: z.string().optional(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const about = await extractCompanyProfile(args.company_name);
				const sections: Record<string, string> = {};
				const references: Record<string, Reference[]> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				const unknownSections: string[] = [];

				applySectionText(
					sections,
					sectionErrors,
					"about",
					about.text,
					about.error,
				);
				if (about.references.length && sections.about) {
					references.about = about.references;
				}

				if (args.sections) {
					for (const raw of args.sections.split(",")) {
						const name = raw.trim().toLowerCase();
						if (!name || name === "about") continue;
						if (!COMPANY_SECTION_NAMES.has(name)) {
							unknownSections.push(name);
							continue;
						}
						const def = COMPANY_SECTIONS[name]!;
						const result = await extractSection(
							name,
							def,
							args.company_name,
							name === "posts" ? 10 : 5,
						);
						applySectionText(
							sections,
							sectionErrors,
							name,
							result.text,
							result.error,
						);
						if (result.references.length && sections[name]) {
							references[name] = result.references;
						}
					}
				}

				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections,
				};
				if (about.company_urn) result.company_urn = about.company_urn;
				if (Object.keys(references).length) result.references = references;
				if (Object.keys(sectionErrors).length)
					result.section_errors = sectionErrors;
				if (unknownSections.length) result.unknown_sections = unknownSections;
				return toolJson(result);
			}),
	);

	server.registerTool(
		"get_company_posts",
		{
			title: "Get Company Posts",
			description: "Get recent posts from a company's LinkedIn feed",
			inputSchema: z.object({
				company_name: z.string(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const url = `${LINKEDIN_BASE}/company/${args.company_name}/posts/`;
				await browserManager.navigate(url);
				await Bun.sleep(1500);
				await scrollToBottom(3, 800);
				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(
					sections,
					sectionErrors,
					"posts",
					stripLinkedinNoise(raw.text),
				);
				const refs = buildReferences(raw.references, "posts");
				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections,
				};
				if (refs.length && sections.posts) result.references = { posts: refs };
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);

	server.registerTool(
		"search_companies",
		{
			title: "Search Companies",
			description: "Search for companies on LinkedIn by keywords",
			inputSchema: z.object({
				keywords: z.string(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const url = `${LINKEDIN_BASE}/search/results/companies/?keywords=${encodeURIComponent(args.keywords)}`;
				await browserManager.navigate(url);
				await Bun.sleep(1500);
				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(
					sections,
					sectionErrors,
					"search_results",
					stripLinkedinNoise(raw.text),
				);
				const refs = buildReferences(raw.references, "search_results");
				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections,
				};
				if (refs.length && sections.search_results) {
					result.references = { search_results: refs };
				}
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);

	server.registerTool(
		"get_company_employees",
		{
			title: "Get Company Employees",
			description:
				"List employees at a company from the /people/ page, with optional keyword filter",
			inputSchema: z.object({
				company_name: z.string().describe("Company slug"),
				keywords: z.string().optional(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				let url = `${LINKEDIN_BASE}/company/${args.company_name}/people/`;
				if (args.keywords) {
					url += `?keywords=${encodeURIComponent(args.keywords)}`;
				}
				await browserManager.navigate(url);
				await Bun.sleep(1500);
				await scrollToBottom(4, 700);
				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(
					sections,
					sectionErrors,
					"employees",
					stripLinkedinNoise(raw.text),
				);
				const profiles = await extractProfileReferences(40);
				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections,
				};
				if (profiles.length && sections.employees) {
					result.references = { employees: profiles };
				}
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);
}
