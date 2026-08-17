import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { browserManager } from "../browser/manager.ts";
import type { AppConfig } from "../config.ts";
import { extractRootContent } from "../scraping/dom-extract.ts";
import { getCurrentUrl, scrollToBottom, stripLinkedinNoise } from "../scraping/extractor.ts";
import { LINKEDIN_BASE } from "../scraping/fields.ts";
import { buildReferences } from "../scraping/references.ts";
import { applySectionText, filterValidationError, type SectionErrorInfo } from "../scraping/section-result.ts";
import { toolJson, wrapTool } from "./helpers.ts";

const DATE_MAP: Record<string, string> = {
	"past-24h": "past-24h",
	past_24_hours: "past-24h",
	"past-week": "past-week",
	past_week: "past-week",
	"past-month": "past-month",
	past_month: "past-month",
};

export function registerPostTools(server: McpServer, config: AppConfig): void {
	server.registerTool(
		"search_posts",
		{
			title: "Search Posts",
			description:
				'Search LinkedIn posts/content globally by keyword (the "Posts" tab). Useful for informal hiring posts before a formal job listing exists.',
			inputSchema: z.object({
				keywords: z.string(),
				date_posted: z.string().optional(),
				max_pages: z.number().int().min(1).max(10).optional().default(3),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				if (args.date_posted && !(args.date_posted in DATE_MAP)) {
					throw filterValidationError(
						`Invalid date_posted '${args.date_posted}'. Expected one of: ${Object.keys(DATE_MAP).join(", ")}.`,
					);
				}

				const params = new URLSearchParams({
					keywords: args.keywords,
					origin: "FACETED_SEARCH",
				});
				if (args.date_posted) {
					const mappedDate = DATE_MAP[args.date_posted];
					if (mappedDate) {
						params.set("datePosted", JSON.stringify([mappedDate]));
					}
				}
				const url = `${LINKEDIN_BASE}/search/results/content/?${params}`;
				await browserManager.navigate(url);
				await Bun.sleep(1500);

				const maxPages = args.max_pages ?? 3;
				await scrollToBottom(maxPages * 5, 400);

				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(sections, sectionErrors, "search_results", stripLinkedinNoise(raw.text));
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
}
