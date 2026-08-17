import { describe, expect, test } from "bun:test";
import type { z } from "zod";
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
	const registered = (
		server as unknown as {
			_registeredTools: Record<string, { inputSchema: z.ZodTypeAny; handler: (args: unknown) => Promise<unknown> }>;
		}
	)._registeredTools;

	test("registers all 19 required tools with MCP server", () => {
		const toolNames = Object.keys(registered);
		for (const name of EXPECTED_TOOLS) {
			expect(toolNames).toContain(name);
		}
		expect(toolNames.length).toBe(19);
	});

	test("person profile input schema validates parameters from registered tool", () => {
		const schema = registered.get_person_profile?.inputSchema;
		expect(schema).toBeDefined();

		expect(schema?.parse({ linkedin_username: "satyanadella" })).toEqual({
			linkedin_username: "satyanadella",
		});
		expect(() => schema?.parse({ linkedin_username: 123 })).toThrow();
		expect(() => schema?.parse({ linkedin_username: "a", max_scrolls: 100 })).toThrow();
	});

	test("send_message requires confirm_send flag from registered tool", () => {
		const schema = registered.send_message?.inputSchema;
		expect(schema).toBeDefined();

		expect(() => schema?.parse({ linkedin_username: "alice", message: "Hi" })).toThrow();
		expect(
			schema?.parse({
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

	test("connect_with_person input schema supports note from registered tool", () => {
		const schema = registered.connect_with_person?.inputSchema;
		expect(schema).toBeDefined();

		const valid = schema?.parse({
			linkedin_username: "bob",
			note: "Hello Bob!",
		});
		expect(valid).toEqual({
			linkedin_username: "bob",
			note: "Hello Bob!",
		});
		expect(() => schema?.parse({})).toThrow();
	});

	test("search_jobs input schema accepts keywords and easy_apply from registered tool", () => {
		const schema = registered.search_jobs?.inputSchema;
		expect(schema).toBeDefined();

		const parsed = schema?.parse({
			keywords: "Software Engineer",
			location: "San Francisco",
			job_type: "full_time",
			easy_apply: true,
			max_pages: 5,
		});
		expect(parsed).toEqual({
			keywords: "Software Engineer",
			location: "San Francisco",
			job_type: "full_time",
			easy_apply: true,
			max_pages: 5,
		});
		expect(() => schema?.parse({ location: "San Francisco" })).toThrow();
	});
});
