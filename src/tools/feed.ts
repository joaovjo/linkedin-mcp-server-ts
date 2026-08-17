import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { cdp, enableNetwork, listenNetworkResponses } from "../browser/cdp.ts";
import { browserManager } from "../browser/manager.ts";
import type { AppConfig } from "../config.ts";
import { extractRootContent } from "../scraping/dom-extract.ts";
import { getCurrentUrl, getMainInnerText, scrollFeed, stripLinkedinNoise } from "../scraping/extractor.ts";
import { LINKEDIN_BASE } from "../scraping/fields.ts";
import { buildFeedReferences, classifyLink } from "../scraping/references.ts";
import { applySectionText, isRateLimitedText, type SectionErrorInfo } from "../scraping/section-result.ts";
import { toolJson, wrapTool } from "./helpers.ts";

function toRelativeFeedUrl(url: string): string | null {
	const classified = classifyLink(url.startsWith("http") || url.startsWith("/") ? url : `https://www.linkedin.com/${url}`);
	return classified?.[0] === "feed_post" ? classified[1] : null;
}

function extractFeedUrlsFromBody(body: string): string[] {
	const found = new Set<string>();
	const patterns = [/\/feed\/update\/[^"'\\\s]+/g, /\/posts\/[^"'\\\s]+/g, /urn:li:activity:(\d+)/g, /urn:li:ugcPost:(\d+)/g];
	for (const re of patterns) {
		for (const m of body.matchAll(re)) {
			if (m[0].startsWith("/")) {
				const rel = toRelativeFeedUrl(m[0]);
				if (rel) found.add(rel);
			} else if (m[1]) {
				found.add(`/feed/update/urn:li:activity:${m[1]}/`);
			}
		}
	}
	return [...found];
}

export function registerFeedTools(server: McpServer, config: AppConfig): void {
	server.registerTool(
		"get_feed",
		{
			title: "Get Feed",
			description: "Get posts from the authenticated user's LinkedIn home feed",
			inputSchema: z.object({
				num_posts: z.number().int().min(1).max(50).optional().default(10),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const numPosts = args.num_posts ?? 10;
				const networkExtras = new Set<string>();
				const responseIds: string[] = [];

				await browserManager.ensureNetwork();
				const view = browserManager.getView();
				await enableNetwork(view);

				const stop = listenNetworkResponses(view, (url) => {
					const rel = toRelativeFeedUrl(url);
					if (rel) networkExtras.add(rel);
				});

				const bodyListener = (event: Event) => {
					const data = (
						event as CustomEvent & {
							data?: { requestId?: string; response?: { url?: string } };
						}
					).data;
					if (data?.requestId && data.response?.url) {
						const u = data.response.url;
						if (u.includes("voyagerFeed") || u.includes("/feed/") || u.includes("graphql")) {
							responseIds.push(data.requestId);
						}
					}
				};
				view.addEventListener("Network.responseReceived", bodyListener);

				try {
					await browserManager.navigate(`${LINKEDIN_BASE}/feed/`);
					await Bun.sleep(1500);

					let staleRounds = 0;
					let lastCount = 0;
					const scrollsNeeded = Math.max(3, Math.ceil(numPosts / 4));
					for (let i = 0; i < scrollsNeeded && staleRounds < 3; i++) {
						await scrollFeed();
						await Bun.sleep(1200);
						const raw = await extractRootContent(browserManager);
						const current = buildFeedReferences(raw.references).length;
						if (current <= lastCount) staleRounds++;
						else staleRounds = 0;
						lastCount = current;
						if (current >= numPosts) break;
					}

					for (const requestId of responseIds.slice(-8)) {
						try {
							const body = await cdp<{
								body?: string;
								base64Encoded?: boolean;
							}>(view, "Network.getResponseBody", { requestId });
							const text = body?.base64Encoded ? Buffer.from(body.body ?? "", "base64").toString("utf8") : (body?.body ?? "");
							for (const u of extractFeedUrlsFromBody(text)) {
								networkExtras.add(u);
							}
						} catch {
							/* CDP body may fail for some responses */
						}
					}

					const raw = await extractRootContent(browserManager);
					const cleaned = stripLinkedinNoise(raw.text) || (await getMainInnerText());
					const sections: Record<string, string> = {};
					const sectionErrors: Record<string, SectionErrorInfo> = {};
					applySectionText(sections, sectionErrors, "feed", cleaned);

					const refs = !isRateLimitedText(cleaned)
						? buildFeedReferences(raw.references, [...networkExtras]).slice(0, numPosts)
						: [];

					const result: Record<string, unknown> = {
						url: await getCurrentUrl(),
						sections,
					};
					if (refs.length) result.references = { feed: refs };
					if (Object.keys(sectionErrors).length) {
						result.section_errors = sectionErrors;
					}
					return toolJson(result);
				} finally {
					view.removeEventListener("Network.responseReceived", bodyListener);
					stop();
				}
			}),
	);
}
