import { browserManager } from "../browser/manager.ts";
import { raiseToolError } from "../errors/handler.ts";
import {
	checkLoginState,
	extractPersonProfile,
	extractSection,
	getCurrentUrl,
} from "../scraping/extractor.ts";
import { PERSON_SECTIONS } from "../scraping/fields.ts";
import type { ToolDef } from "./types.ts";

export function loadPersonTools(): ToolDef[] {
	return [
		{
			name: "get_person_profile",
			description:
				"Get a specific person's LinkedIn profile. " +
				"The main profile page is always included. " +
				"Available sections: experience, education, interests, honors, languages, certifications, skills, projects, contact_info, posts",
			inputSchema: {
				type: "object",
				properties: {
					linkedin_username: {
						type: "string",
						description:
							'LinkedIn username (e.g., "stickerdaniel", "williamhgates")',
					},
					sections: {
						type: "string",
						description:
							"Comma-separated list of extra sections to scrape. " +
							'Examples: "experience,education", "contact_info", "skills,projects", "posts"',
					},
					max_scrolls: {
						type: "number",
						description:
							"Maximum pagination attempts per section (1-50). " +
							"Default (None) uses 5 for detail sections and 10 for posts.",
					},
				},
				required: ["linkedin_username"],
			},
			handler: async (args) => {
				const username = args.linkedin_username as string;
				if (!username)
					return raiseToolError(new Error("linkedin_username is required"));

				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				const sections: Record<string, string> = {};
				const sectionErrors: Record<string, string> = {};

				const mainText = await extractPersonProfile(username);
				sections.profile = mainText;

				const sectionsParam = args.sections as string | undefined;
				if (sectionsParam) {
					const names = sectionsParam
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
					for (const name of names) {
						const def = PERSON_SECTIONS[name];
						if (!def) {
							sectionErrors[name] = `Unknown section: ${name}`;
							continue;
						}
						const { text, error } = await extractSection(name, def, username);
						if (text) sections[name] = text;
						if (error && !text) sectionErrors[name] = error;
					}
				}

				const currentUrl = await getCurrentUrl();
				const result: Record<string, unknown> = { url: currentUrl, sections };
				if (Object.keys(sectionErrors).length > 0) {
					result.section_errors = sectionErrors;
				}
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			},
		},
		{
			name: "search_people",
			description: "Search for people on LinkedIn",
			inputSchema: {
				type: "object",
				properties: {
					keywords: {
						type: "string",
						description:
							'Search keywords (e.g., "software engineer", "recruiter at Google")',
					},
					location: {
						type: "string",
						description:
							'Optional location filter (e.g., "New York", "Remote")',
					},
					network: {
						type: "array",
						items: { type: "string", enum: ["F", "S", "O"] },
						description:
							'Optional connection-degree filter. Each element is one of "F" (1st-degree), "S" (2nd-degree), "O" (3rd-degree and beyond). Example: ["F"] to only return 1st-degree connections.',
					},
					current_company: {
						type: "string",
						description:
							"Optional current-employer filter. Use the numeric company URN id (e.g. '1115' for SAP).",
					},
				},
				required: ["keywords"],
			},
			handler: async (args) => {
				const keywords = encodeURIComponent(args.keywords as string);
				let url = `https://www.linkedin.com/search/results/people/?keywords=${keywords}`;

				if (args.location) {
					url += `&origin=GLOBAL_SEARCH_HEADER&location=${encodeURIComponent(args.location as string)}`;
				}
				if (args.network) {
					const network = args.network as string[];
					url += `&network=%5B%22${network.join("%22%2C%22")}%22%5D`;
				}
				if (args.current_company) {
					url += `&currentCompany=${encodeURIComponent(args.current_company as string)}`;
				}

				await browserManager.navigate(url);

				const text = await browserManager.evaluate<string>(
					"(() => document.querySelector('main')?.innerText?.trim() ?? '')()",
				);

				return { content: [{ type: "text", text }] };
			},
		},
		{
			name: "connect_with_person",
			description:
				"Send a LinkedIn connection request or accept an incoming one. " +
				"The tool is annotated with destructiveHint so MCP clients will prompt for user confirmation before execution.",
			inputSchema: {
				type: "object",
				properties: {
					linkedin_username: {
						type: "string",
						description:
							'LinkedIn username (e.g., "stickerdaniel", "williamhgates")',
					},
					note: {
						type: "string",
						description: "Optional note to include with the invitation",
					},
				},
				required: ["linkedin_username"],
			},
			handler: async (args) => {
				const username = args.linkedin_username as string;
				if (!username)
					return raiseToolError(new Error("linkedin_username is required"));

				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				const profileUrl = `https://www.linkedin.com/in/${username}/`;
				await browserManager.navigate(profileUrl);

				const hasConnectButton = await browserManager.evaluate<boolean>(
					`!!document.querySelector('a[href*="/preload/custom-invite/?vanityName=${username}"]')`,
				);

				if (!hasConnectButton) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										status: "unavailable",
										message: "Connect button not found",
									},
									null,
									2,
								),
							},
						],
					};
				}

				await browserManager.click(
					`a[href*="/preload/custom-invite/?vanityName=${username}"]`,
				);

				await Bun.sleep(1000);

				const note = args.note as string | undefined;
				if (note) {
					await browserManager.evaluate(
						`(() => {
              const ta = document.querySelector('[role="dialog"] textarea, dialog textarea');
              if (ta) (ta as HTMLTextAreaElement).value = ${JSON.stringify(note)};
            })()`,
					);
					await Bun.sleep(500);
				}

				const sendBtn = await browserManager.evaluate<boolean>(
					'!!document.querySelector(\'[role="dialog"] button[type="submit"]:not([disabled]), dialog button[type="submit"]:not([disabled])\')',
				);

				if (sendBtn) {
					await browserManager.click(
						'[role="dialog"] button[type="submit"]:not([disabled])',
					);
					await Bun.sleep(1000);
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ status: "sent", note_sent: !!note },
								null,
								2,
							),
						},
					],
				};
			},
		},
		{
			name: "get_sidebar_profiles",
			description:
				"Get profile links from sidebar recommendation sections on a LinkedIn profile page.",
			inputSchema: {
				type: "object",
				properties: {
					linkedin_username: {
						type: "string",
						description:
							'LinkedIn username of the profile page to scrape (e.g., "stickerdaniel", "williamhgates")',
					},
				},
				required: ["linkedin_username"],
			},
			handler: async (args) => {
				const username = args.linkedin_username as string;
				if (!username)
					return raiseToolError(new Error("linkedin_username is required"));

				const profileUrl = `https://www.linkedin.com/in/${username}/`;
				await browserManager.navigate(profileUrl);

				const sidebarLinks = await browserManager.evaluate<string[]>(
					`(() => {
            const links: string[] = [];
            document.querySelectorAll('a[href*="/in/"]').forEach(a => {
              const href = (a as HTMLAnchorElement).href;
              if (href && !links.includes(href)) links.push(href);
            });
            return links.slice(0, 20);
          })()`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ profiles: sidebarLinks }, null, 2),
						},
					],
				};
			},
		},
		{
			name: "get_my_profile",
			description:
				"Get the authenticated user's own LinkedIn profile. " +
				"Navigates to /in/me/ and resolves the redirect to obtain the real username before scraping.",
			inputSchema: {
				type: "object",
				properties: {
					sections: {
						type: "string",
						description:
							"Comma-separated list of extra sections to scrape. " +
							'Examples: "experience,education", "contact_info", "skills,projects"',
					},
					max_scrolls: {
						type: "number",
						description: "Maximum pagination attempts per section (1-50).",
					},
				},
			},
			handler: async () => {
				if (!(await checkLoginState())) {
					return raiseToolError(
						new Error("Not authenticated. Run `bun run login` first."),
					);
				}

				await browserManager.navigate("https://www.linkedin.com/in/me/");
				await Bun.sleep(1000);
				const currentUrl = await browserManager.getCurrentUrl();

				const text = await browserManager.evaluate<string>(
					"(() => (document.querySelector('main') || document.body)?.innerText?.trim() ?? '')()",
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ url: currentUrl, sections: { profile: text } },
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
