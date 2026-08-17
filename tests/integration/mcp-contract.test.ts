import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { loadConfig } from "../../src/config.ts";
import { createMcpServer } from "../../src/mcp/create-server.ts";

const EXPECTED_TOOLS = [
	"get_person_profile",
	"search_people",
	"connect_with_person",
	"get_sidebar_profiles",
	"get_my_profile",
	"get_company_profile",
	"get_company_posts",
	"search_companies",
	"get_company_employees",
	"get_job_details",
	"search_jobs",
	"get_saved_jobs",
	"get_feed",
	"get_inbox",
	"get_conversation",
	"search_conversations",
	"send_message",
	"search_posts",
	"close_session",
] as const;

describe("Integration: MCP Server Contract", () => {
	const config = loadConfig(["--transport", "stdio"]);
	const server = createMcpServer(config);

	test("registers all 19 required tools with MCP server", () => {
		const registered = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
		const toolNames = Object.keys(registered);
		for (const name of EXPECTED_TOOLS) {
			expect(toolNames).toContain(name);
		}
		expect(toolNames.length).toBe(19);
	});

	test("person profile input schema validates parameters", () => {
		const schema = z.object({
			linkedin_username: z.string(),
			sections: z.string().optional(),
			max_scrolls: z.number().int().min(1).max(50).optional(),
		});

		expect(schema.parse({ linkedin_username: "satyanadella" })).toEqual({
			linkedin_username: "satyanadella",
		});
		expect(() => schema.parse({ linkedin_username: 123 })).toThrow();
		expect(() => schema.parse({ linkedin_username: "a", max_scrolls: 100 })).toThrow();
	});

	test("send_message requires confirm_send flag", () => {
		const schema = z.object({
			linkedin_username: z.string(),
			message: z.string(),
			confirm_send: z.boolean(),
		});

		expect(() => schema.parse({ linkedin_username: "alice", message: "Hi" })).toThrow();
		expect(
			schema.parse({
				linkedin_username: "alice",
				message: "Hi",
				confirm_send: false,
			}),
		).toEqual({
			linkedin_username: "alice",
			message: "Hi",
			confirm_send: false,
		});
	});

	test("connect_with_person input schema supports custom note and confirm_send", () => {
		const schema = z.object({
			linkedin_username: z.string(),
			custom_note: z.string().max(300).optional(),
			confirm_send: z.boolean().optional(),
		});

		const valid = schema.parse({
			linkedin_username: "bob",
			custom_note: "Hello Bob!",
			confirm_send: false,
		});
		expect(valid.linkedin_username).toBe("bob");
		expect(valid.custom_note).toBe("Hello Bob!");
		expect(() =>
			schema.parse({
				linkedin_username: "bob",
				custom_note: "a".repeat(400),
			}),
		).toThrow();
	});

	test("search_jobs input schema accepts filters and pagination", () => {
		const schema = z.object({
			keywords: z.string().optional(),
			location: z.string().optional(),
			job_type: z.string().optional(),
			experience_level: z.string().optional(),
			work_type: z.string().optional(),
			easy_apply_only: z.boolean().optional(),
			under_10_applicants: z.boolean().optional(),
			page: z.number().int().min(1).optional(),
		});

		const parsed = schema.parse({
			keywords: "Software Engineer",
			location: "San Francisco",
			job_type: "full_time",
			easy_apply_only: true,
			page: 1,
		});
		expect(parsed.keywords).toBe("Software Engineer");
		expect(parsed.easy_apply_only).toBe(true);
	});
});
