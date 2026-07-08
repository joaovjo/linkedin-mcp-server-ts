import { browserManager } from "../browser/manager.ts";
import { raiseToolError } from "../errors/handler.ts";
import { checkLoginState } from "../scraping/extractor.ts";
import type { ToolDef } from "./types.ts";

export function loadMessagingTools(): ToolDef[] {
	return [
		{
			name: "get_inbox",
			description:
				"List recent conversations from the LinkedIn messaging inbox",
			inputSchema: {
				type: "object",
				properties: {
					limit: {
						type: "number",
						description:
							"Maximum number of conversations to load (1-50, default 20)",
						default: 20,
					},
				},
			},
			handler: async () => {
				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				await browserManager.navigate("https://www.linkedin.com/messaging/");
				await Bun.sleep(2000);

				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);

				return { content: [{ type: "text", text }] };
			},
		},
		{
			name: "get_conversation",
			description:
				"Read a specific messaging conversation. " +
				"Provide either linkedin_username or thread_id to identify the conversation.",
			inputSchema: {
				type: "object",
				properties: {
					linkedin_username: {
						type: "string",
						description: "LinkedIn username of the conversation participant",
					},
					thread_id: {
						type: "string",
						description: "LinkedIn messaging thread ID",
					},
					index: {
						type: "number",
						description:
							"0-based selector for which thread to open when the participant has multiple threads. Ignored when thread_id is provided.",
						default: 0,
					},
				},
			},
			handler: async (args) => {
				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				const threadId = args.thread_id as string | undefined;
				const username = args.linkedin_username as string | undefined;

				if (!threadId && !username) {
					return raiseToolError(
						new Error("Provide either linkedin_username or thread_id"),
					);
				}

				let url: string;
				if (threadId) {
					url = `https://www.linkedin.com/messaging/thread/${threadId}/`;
				} else {
					await browserManager.navigate("https://www.linkedin.com/messaging/");
					await Bun.sleep(2000);

					url = await browserManager.getCurrentUrl();
				}

				await browserManager.navigate(url);
				await Bun.sleep(2000);

				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);

				return { content: [{ type: "text", text }] };
			},
		},
		{
			name: "search_conversations",
			description: "Search messages by keyword",
			inputSchema: {
				type: "object",
				properties: {
					keywords: {
						type: "string",
						description: "Search keywords to filter conversations",
					},
					limit: {
						type: "number",
						description:
							"Maximum number of search-result rows to enumerate (1-50, default 20)",
						default: 20,
					},
				},
				required: ["keywords"],
			},
			handler: async (args) => {
				const keywords = encodeURIComponent(args.keywords as string);

				await browserManager.navigate(
					`https://www.linkedin.com/messaging/?keywords=${keywords}`,
				);
				await Bun.sleep(2000);

				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);

				return { content: [{ type: "text", text }] };
			},
		},
		{
			name: "send_message",
			description:
				"Send a message to a LinkedIn user. " +
				"The recipient must be directly messageable from the profile page. " +
				"This is a write operation when confirm_send is True.",
			inputSchema: {
				type: "object",
				properties: {
					linkedin_username: {
						type: "string",
						description: "LinkedIn username of the recipient",
					},
					message: {
						type: "string",
						description: "The message text to send",
					},
					confirm_send: {
						type: "boolean",
						description: "Must be True to send the message",
					},
					profile_urn: {
						type: "string",
						description:
							"Optional profile URN (e.g. ACoAAB...) to construct the compose URL directly. " +
							"Obtain via get_person_profile.",
					},
				},
				required: ["linkedin_username", "message", "confirm_send"],
			},
			handler: async (args) => {
				const username = args.linkedin_username as string;
				const messageText = args.message as string;
				const confirmSend = args.confirm_send as boolean;
				const profileUrn = args.profile_urn as string | undefined;

				if (!username)
					return raiseToolError(new Error("linkedin_username is required"));
				if (!messageText)
					return raiseToolError(new Error("message is required"));
				if (!confirmSend) {
					return raiseToolError(
						new Error("Set confirm_send=true to send the message"),
					);
				}

				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				if (profileUrn) {
					await browserManager.navigate(
						`https://www.linkedin.com/messaging/compose/?recipient=${profileUrn}`,
					);
				} else {
					await browserManager.navigate(
						`https://www.linkedin.com/in/${username}/`,
					);
					await Bun.sleep(1000);

					const hasMessageBtn = await browserManager.evaluate<boolean>(
						`!!document.querySelector('a[href*="/messaging/compose/"]')`,
					);

					if (!hasMessageBtn) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{ status: "error", message: "Message button not found" },
										null,
										2,
									),
								},
							],
						};
					}

					await browserManager.click('a[href*="/messaging/compose/"]');
					await Bun.sleep(2000);
				}

				const textareaVisible = await browserManager.evaluate<boolean>(
					`!!document.querySelector('[role="textbox"][contenteditable="true"]')`,
				);

				if (textareaVisible) {
					await browserManager.click(
						'[role="textbox"][contenteditable="true"]',
					);
					await Bun.sleep(500);
					await browserManager.type(messageText);
					await Bun.sleep(1000);

					const hasSendBtn = await browserManager.evaluate<boolean>(
						"!!document.querySelector('button[type=\"submit\"]:not([disabled])')",
					);

					if (hasSendBtn) {
						await browserManager.click('button[type="submit"]:not([disabled])');
						await Bun.sleep(1000);
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{ status: "sent", message: "Message sent successfully" },
										null,
										2,
									),
								},
							],
						};
					}
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ status: "error", message: "Could not send message" },
								null,
								2,
							),
						},
					],
				};
			},
		},
	];
}
