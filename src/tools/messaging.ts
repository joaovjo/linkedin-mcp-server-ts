import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { browserManager } from "../browser/manager.ts";
import type { AppConfig } from "../config.ts";
import { LinkedInScraperException } from "../errors/types.ts";
import {
	extractConversationThreadRefs,
	readProfileDisplayName,
	resolveConversationThreadUrls,
} from "../scraping/conversation-refs.ts";
import { extractRootContent } from "../scraping/dom-extract.ts";
import { getCurrentUrl, scrollMainScrollable, stripLinkedinNoise } from "../scraping/extractor.ts";
import { LINKEDIN_BASE } from "../scraping/fields.ts";
import { buildReferences, classifyLink } from "../scraping/references.ts";
import { applySectionText, isRateLimitedText, type SectionErrorInfo } from "../scraping/section-result.ts";
import { toolJson, wrapTool } from "./helpers.ts";

function messageResult(url: string, status: string, message: string, extra: Record<string, unknown> = {}) {
	return {
		url,
		status,
		message,
		recipient_selected: extra.recipient_selected ?? false,
		sent: extra.sent ?? false,
		...extra,
	};
}

export function registerMessagingTools(server: McpServer, config: AppConfig): void {
	server.registerTool(
		"get_inbox",
		{
			title: "Get Inbox",
			description: "List recent conversations from the LinkedIn messaging inbox",
			inputSchema: z.object({
				limit: z.number().int().min(1).max(50).optional().default(20),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				await browserManager.navigate(`${LINKEDIN_BASE}/messaging/`);
				await Bun.sleep(1500);
				await scrollMainScrollable("bottom", 2, 500);

				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(sections, sectionErrors, "inbox", stripLinkedinNoise(raw.text));

				const limit = args.limit ?? 20;
				const conversationRefs = !isRateLimitedText(raw.text) ? await extractConversationThreadRefs(limit, "inbox") : [];

				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections,
					limit,
				};
				if (conversationRefs.length) {
					result.references = { inbox: conversationRefs };
				}
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);

	server.registerTool(
		"get_conversation",
		{
			title: "Get Conversation",
			description: "Read a specific messaging conversation by username or thread ID",
			inputSchema: z.object({
				linkedin_username: z.string().optional(),
				thread_id: z.string().optional(),
				index: z.number().int().min(0).optional().default(0),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				if (!args.linkedin_username && !args.thread_id) {
					throw new LinkedInScraperException("Provide at least one of linkedin_username or thread_id");
				}

				const index = args.index ?? 0;

				if (args.thread_id) {
					await browserManager.navigate(`${LINKEDIN_BASE}/messaging/thread/${args.thread_id}/`);
				} else {
					const username = args.linkedin_username!;
					await browserManager.navigate(`${LINKEDIN_BASE}/in/${username}/`);
					await Bun.sleep(1200);
					const displayName = await readProfileDisplayName();
					if (!displayName) {
						throw new LinkedInScraperException(`Could not resolve a display name for ${username}.`);
					}
					const threadUrls = await resolveConversationThreadUrls(displayName);
					if (!threadUrls.length) {
						throw new LinkedInScraperException(`Could not find a conversation for ${username}.`);
					}
					if (index >= threadUrls.length) {
						throw new LinkedInScraperException(
							`index ${index} out of range: only ${threadUrls.length} thread(s) exist for ${username}.`,
						);
					}
					await browserManager.navigate(threadUrls[index]!);
				}

				await Bun.sleep(1200);
				await scrollMainScrollable("top", 3, 400);

				const currentUrl = await getCurrentUrl();
				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(sections, sectionErrors, "conversation", stripLinkedinNoise(raw.text));

				const refs = buildReferences(raw.references, "conversation");
				const threadClassified = classifyLink(currentUrl);
				if (threadClassified?.[0] === "conversation") {
					refs.unshift({
						kind: "conversation",
						url: threadClassified[1],
						context: "conversation",
					});
				}

				const result: Record<string, unknown> = {
					url: currentUrl,
					sections,
				};
				if (refs.length) result.references = { conversation: refs };
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);

	server.registerTool(
		"search_conversations",
		{
			title: "Search Conversations",
			description: "Search messages by keyword",
			inputSchema: z.object({
				keywords: z.string(),
				limit: z.number().int().min(1).max(50).optional().default(20),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const url = `${LINKEDIN_BASE}/messaging/?searchTerm=${encodeURIComponent(args.keywords)}`;
				await browserManager.navigate(url);
				await Bun.sleep(1500);

				const raw = await extractRootContent(browserManager);
				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				applySectionText(sections, sectionErrors, "search_results", stripLinkedinNoise(raw.text));

				const limit = args.limit ?? 20;
				const conversationRefs = !isRateLimitedText(raw.text) ? await extractConversationThreadRefs(limit, "search") : [];

				const result: Record<string, unknown> = {
					url: await getCurrentUrl(),
					sections,
					limit,
				};
				if (conversationRefs.length) {
					result.references = { search_results: conversationRefs };
				}
				if (Object.keys(sectionErrors).length) {
					result.section_errors = sectionErrors;
				}
				return toolJson(result);
			}),
	);

	server.registerTool(
		"send_message",
		{
			title: "Send Message",
			description:
				"Send a message to a LinkedIn user. Set confirm_send=true to actually send; false returns confirmation_required without typing.",
			inputSchema: z.object({
				linkedin_username: z.string(),
				message: z.string(),
				confirm_send: z.boolean(),
				profile_urn: z.string().optional(),
			}),
			annotations: {
				readOnlyHint: false,
				openWorldHint: true,
				destructiveHint: true,
			},
		},
		async (args) =>
			wrapTool(config, async () => {
				const profileUrl = `${LINKEDIN_BASE}/in/${args.linkedin_username}/`;
				await browserManager.navigate(profileUrl);
				await Bun.sleep(1200);

				let composeUrl: string | null = null;
				if (args.profile_urn) {
					const encoded = encodeURIComponent(`urn:li:fsd_profile:${args.profile_urn}`);
					composeUrl =
						`${LINKEDIN_BASE}/messaging/compose/` +
						`?profileUrn=${encoded}` +
						`&recipient=${encodeURIComponent(args.profile_urn)}` +
						`&screenContext=NON_SELF_PROFILE_VIEW` +
						`&interop=msgOverlay`;
				} else {
					composeUrl = await browserManager.evaluate<string | null>(() => {
						const a = document.querySelector('main a[href*="/messaging/compose/"]') as HTMLAnchorElement | null;
						return a?.href ?? null;
					});
				}

				if (!composeUrl) {
					return toolJson(
						messageResult(profileUrl, "message_unavailable", "LinkedIn did not expose a usable Message action for this profile."),
					);
				}

				await browserManager.navigate(composeUrl);
				await Bun.sleep(2000);

				const picker = await browserManager.waitForSelector(
					'input[placeholder*="Type a name"], input[aria-label*="Type a name"]',
					1500,
				);
				if (picker) {
					return toolJson(
						messageResult(
							await getCurrentUrl(),
							"recipient_resolution_failed",
							"LinkedIn opened a compose page, but the visible recipient did not match the requested profile.",
						),
					);
				}

				const composerReady = await browserManager.waitForSelector(
					'div[role="textbox"][contenteditable="true"], .msg-form__contenteditable',
					8000,
				);

				if (!composerReady) {
					return toolJson(
						messageResult(await getCurrentUrl(), "composer_unavailable", "LinkedIn did not expose a usable message composer."),
					);
				}

				if (!args.confirm_send) {
					return toolJson(
						messageResult(await getCurrentUrl(), "confirmation_required", "Set confirm_send=true to send the message.", {
							recipient_selected: true,
							sent: false,
						}),
					);
				}

				const focused = await browserManager.evaluate<boolean>(() => {
					const el = document.querySelector(
						'div[role="textbox"][contenteditable="true"][aria-label*="Write a message"], div[role="textbox"][contenteditable="true"]',
					) as HTMLElement | null;
					if (!el) return false;
					el.focus();
					return true;
				});
				if (!focused) {
					return toolJson(
						messageResult(await getCurrentUrl(), "compose_interact_failed", "Could not focus the message composer.", {
							recipient_selected: true,
							sent: false,
						}),
					);
				}

				await browserManager.type(args.message);
				await Bun.sleep(300);

				const clicked = await browserManager.evaluate<boolean>(() => {
					const btn = document.querySelector(
						'button[type="submit"]:not([disabled]), button.msg-form__send-button:not([disabled])',
					) as HTMLButtonElement | null;
					if (!btn) return false;
					btn.click();
					return true;
				});
				if (!clicked) {
					return toolJson(
						messageResult(await getCurrentUrl(), "send_unavailable", "Send button not available", {
							recipient_selected: true,
							sent: false,
						}),
					);
				}
				await Bun.sleep(1000);
				return toolJson(
					messageResult(await getCurrentUrl(), "sent", "Message sent", {
						recipient_selected: true,
						sent: true,
					}),
				);
			}),
	);
}
