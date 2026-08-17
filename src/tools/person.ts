import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.ts";
import { browserManager } from "../browser/manager.ts";
import {
	extractPersonProfile,
	extractSection,
	getCurrentUrl,
	getPersonProfileUrn,
	stripLinkedinNoise,
} from "../scraping/extractor.ts";
import { PERSON_SECTIONS, LINKEDIN_BASE } from "../scraping/fields.ts";
import {
	buildReferences,
	extractSidebarProfiles,
	type Reference,
} from "../scraping/references.ts";
import { extractRootContent } from "../scraping/dom-extract.ts";
import { connectWithPerson } from "../scraping/connection-actions.ts";
import {
	applySectionText,
	filterValidationError,
	type SectionErrorInfo,
} from "../scraping/section-result.ts";
import { toolJson, wrapTool } from "./helpers.ts";

const PERSON_SECTION_NAMES = new Set(Object.keys(PERSON_SECTIONS));
const NETWORK_TOKENS = new Set(["F", "S", "O"]);

export function registerPersonTools(server: McpServer, config: AppConfig): void {
	server.registerTool(
		"get_person_profile",
		{
			title: "Get Person Profile",
			description:
				"Get a specific person's LinkedIn profile. The main profile page is always included. " +
				"Available sections: experience, education, interests, honors, languages, certifications, skills, projects, contact_info, posts",
			inputSchema: z.object({
				linkedin_username: z
					.string()
					.describe('LinkedIn username (e.g., "stickerdaniel", "williamhgates")'),
				sections: z
					.string()
					.optional()
					.describe(
						'Comma-separated list of extra sections to scrape. Examples: "experience,education", "contact_info", "skills,projects", "posts"',
					),
				max_scrolls: z
					.number()
					.int()
					.min(1)
					.max(50)
					.optional()
					.describe(
						"Maximum pagination attempts per section (1-50). Default uses 5 for detail sections and 10 for posts.",
					),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				const sections: Record<string, string> = {};
				const references: Record<string, Reference[]> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				const unknownSections: string[] = [];

				const main = await extractPersonProfile(args.linkedin_username);
				applySectionText(
					sections,
					sectionErrors,
					"main_profile",
					main.text,
					main.error,
				);
				if (main.references.length && sections.main_profile) {
					references.main_profile = main.references;
				}

				const profileUrn = await getPersonProfileUrn();

				if (args.sections) {
					for (const raw of args.sections.split(",")) {
						const name = raw.trim().toLowerCase();
						if (!name) continue;
						if (!PERSON_SECTION_NAMES.has(name)) {
							unknownSections.push(name);
							continue;
						}
						const def = PERSON_SECTIONS[name]!;
						const result = await extractSection(
							name,
							def,
							args.linkedin_username,
							args.max_scrolls,
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
				if (Object.keys(references).length) result.references = references;
				if (profileUrn) result.profile_urn = profileUrn;
				if (Object.keys(sectionErrors).length)
					result.section_errors = sectionErrors;
				if (unknownSections.length) result.unknown_sections = unknownSections;
				return toolJson(result);
			}),
	);

	server.registerTool(
		"search_people",
		{
			title: "Search People",
			description: "Search for people on LinkedIn",
			inputSchema: z.object({
				keywords: z.string().describe("Search keywords"),
				location: z.string().optional().describe("Location filter"),
				network: z
					.array(z.enum(["F", "S", "O"]))
					.optional()
					.describe("Connection degrees: F=1st, S=2nd, O=3rd+"),
				current_company: z
					.string()
					.optional()
					.describe("Numeric company URN id for currentCompany facet"),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				if (args.network?.length) {
					for (const n of args.network) {
						if (!NETWORK_TOKENS.has(n)) {
							throw filterValidationError(
								`Invalid network token '${n}'. Expected one of: F, S, O.`,
							);
						}
					}
				}
				if (
					args.current_company !== undefined &&
					!/^\d+$/.test(args.current_company)
				) {
					throw filterValidationError(
						`current_company must be a numeric URN id (got '${args.current_company}').`,
					);
				}

				const params = new URLSearchParams({ keywords: args.keywords });
				if (args.location) params.set("location", args.location);
				if (args.network?.length) {
					params.set("network", JSON.stringify(args.network));
				}
				if (args.current_company) {
					params.set(
						"currentCompany",
						JSON.stringify([args.current_company]),
					);
				}
				const url = `${LINKEDIN_BASE}/search/results/people/?${params}`;
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
		"connect_with_person",
		{
			title: "Connect With Person",
			description:
				"Send a connection request or accept an incoming one, with optional note",
			inputSchema: z.object({
				linkedin_username: z.string(),
				note: z.string().optional(),
			}),
			annotations: {
				readOnlyHint: false,
				openWorldHint: true,
				destructiveHint: true,
			},
		},
		async (args) =>
			wrapTool(config, async () => {
				const result = await connectWithPerson(
					args.linkedin_username,
					args.note,
				);
				return toolJson(result);
			}),
	);

	server.registerTool(
		"get_sidebar_profiles",
		{
			title: "Get Sidebar Profiles",
			description:
				"Extract profile URLs from sidebar recommendation sections on a profile page",
			inputSchema: z.object({
				linkedin_username: z.string(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				await browserManager.navigate(
					`${LINKEDIN_BASE}/in/${args.linkedin_username}/`,
				);
				await Bun.sleep(1500);
				const sidebar = await extractSidebarProfiles();
				return toolJson({
					url: await getCurrentUrl(),
					sidebar_profiles: sidebar,
				});
			}),
	);

	server.registerTool(
		"get_my_profile",
		{
			title: "Get My Profile",
			description:
				"Get the authenticated user's own LinkedIn profile (same sections as get_person_profile)",
			inputSchema: z.object({
				sections: z.string().optional(),
				max_scrolls: z.number().int().min(1).max(50).optional(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) =>
			wrapTool(config, async () => {
				await browserManager.navigate(`${LINKEDIN_BASE}/in/me/`);
				await Bun.sleep(1500);
				const url = await getCurrentUrl();
				const match = /\/in\/([^/?#]+)/.exec(url);
				const username = match?.[1] && match[1] !== "me" ? match[1] : null;

				const sections: Record<string, string> = {};
				const references: Record<string, Reference[]> = {};
				const sectionErrors: Record<string, SectionErrorInfo> = {};
				const unknownSections: string[] = [];

				if (username) {
					const main = await extractPersonProfile(username);
					applySectionText(
						sections,
						sectionErrors,
						"main_profile",
						main.text,
						main.error,
					);
					if (main.references.length && sections.main_profile) {
						references.main_profile = main.references;
					}
				} else {
					const raw = await extractRootContent(browserManager);
					applySectionText(
						sections,
						sectionErrors,
						"main_profile",
						stripLinkedinNoise(raw.text),
					);
					const refs = buildReferences(raw.references, "main_profile");
					if (refs.length && sections.main_profile) {
						references.main_profile = refs;
					}
				}

				const profileUrn = await getPersonProfileUrn();

				if (args.sections) {
					for (const rawName of args.sections.split(",")) {
						const name = rawName.trim().toLowerCase();
						if (!name) continue;
						if (!PERSON_SECTION_NAMES.has(name)) {
							unknownSections.push(name);
							continue;
						}
						if (!username) {
							sectionErrors[name] = {
								error_type: "extraction_error",
								error_message:
									"Could not resolve /in/me/ to a vanity username for section scrape.",
							};
							continue;
						}
						const def = PERSON_SECTIONS[name]!;
						const result = await extractSection(
							name,
							def,
							username,
							args.max_scrolls,
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

				const result: Record<string, unknown> = { url, sections };
				if (Object.keys(references).length) result.references = references;
				if (profileUrn) result.profile_urn = profileUrn;
				if (Object.keys(sectionErrors).length)
					result.section_errors = sectionErrors;
				if (unknownSections.length) result.unknown_sections = unknownSections;
				return toolJson(result);
			}),
	);
}
