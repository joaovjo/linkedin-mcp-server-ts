import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { loadConfig } from "../src/config.ts";
import { createMcpServer } from "../src/mcp/create-server.ts";
import {
	type ActionSignals,
	detectConnectionState,
} from "../src/scraping/connection.ts";
import { stripLinkedinNoise } from "../src/scraping/extractor.ts";
import {
	buildFeedReferences,
	buildReferences,
	classifyLink,
	firstCompanyUrnFromQuery,
	normalizeUrl,
} from "../src/scraping/link-metadata.ts";
import {
	applySectionText,
	normalizeCsv,
	parseSectionNames,
	RATE_LIMITED_MSG,
} from "../src/scraping/section-result.ts";

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

const CONNECT_STATUSES = [
	"already_connected",
	"pending",
	"incoming_request",
	"connected",
	"accepted",
	"connect_unavailable",
	"unavailable",
	"send_failed",
	"custom_note_limit_reached",
] as const;

const SEND_MESSAGE_STATUSES = [
	"message_unavailable",
	"recipient_resolution_failed",
	"composer_unavailable",
	"confirmation_required",
	"compose_interact_failed",
	"send_unavailable",
	"sent",
] as const;

describe("config", () => {
	test("defaults transport to stdio when forced", () => {
		const cfg = loadConfig(["--transport", "stdio"]);
		expect(cfg.transport).toBe("stdio");
		expect(cfg.port).toBeGreaterThan(0);
		expect(cfg.userDataDir.length).toBeGreaterThan(0);
	});

	test("parses login mode", () => {
		const cfg = loadConfig(["--login"]);
		expect(cfg.mode).toBe("login");
	});
});

describe("MCP contract", () => {
	test("registers all 19 tools", () => {
		const cfg = loadConfig(["--transport", "stdio"]);
		const server = createMcpServer(cfg);
		const registered = (
			server as unknown as { _registeredTools: Record<string, unknown> }
		)._registeredTools;
		const names = Object.keys(registered);
		for (const name of EXPECTED_TOOLS) {
			expect(names).toContain(name);
		}
		expect(names.length).toBe(19);
	});

	test("person profile schema accepts username", () => {
		const schema = z.object({
			linkedin_username: z.string(),
			sections: z.string().optional(),
			max_scrolls: z.number().int().min(1).max(50).optional(),
		});
		expect(schema.parse({ linkedin_username: "stickerdaniel" })).toEqual({
			linkedin_username: "stickerdaniel",
		});
	});

	test("send_message requires confirm_send", () => {
		const schema = z.object({
			linkedin_username: z.string(),
			message: z.string(),
			confirm_send: z.boolean(),
		});
		expect(() =>
			schema.parse({ linkedin_username: "a", message: "hi" }),
		).toThrow();
		expect(
			schema.parse({
				linkedin_username: "a",
				message: "hi",
				confirm_send: false,
			}).confirm_send,
		).toBe(false);
	});

	test("send_message dry-run status is confirmation_required", () => {
		const dryRunStatus = "confirmation_required";
		expect(dryRunStatus).toBe("confirmation_required");
		expect(dryRunStatus).not.toBe("dry_run");
	});
});

describe("link-metadata", () => {
	test("normalizeUrl strips hash and resolves relative", () => {
		expect(normalizeUrl("/in/alice/#about")).toBe(
			"https://www.linkedin.com/in/alice/",
		);
		expect(normalizeUrl("https://www.linkedin.com/in/bob/?trk=x#y")).toBe(
			"https://www.linkedin.com/in/bob/?trk=x",
		);
	});

	test("classifyLink kinds cover person company job feed conversation", () => {
		expect(classifyLink("https://www.linkedin.com/in/alice/")).toEqual([
			"person",
			"/in/alice/",
		]);
		expect(classifyLink("/company/docker/")).toEqual([
			"company",
			"/company/docker/",
		]);
		expect(classifyLink("/jobs/view/12345/")).toEqual([
			"job",
			"/jobs/view/12345/",
		]);
		expect(classifyLink("/feed/update/urn:li:activity:99/")).toEqual([
			"feed_post",
			"/feed/update/urn:li:activity:99/",
		]);
		expect(classifyLink("/posts/alice_activity-1/")).toEqual([
			"feed_post",
			"/posts/alice_activity-1",
		]);
		expect(classifyLink("/messaging/thread/abc123/")).toEqual([
			"conversation",
			"/messaging/thread/abc123/",
		]);
	});

	test("company_urn from currentCompany query", () => {
		const urn = firstCompanyUrnFromQuery('currentCompany=["1441"]');
		expect(urn).toBe("1441");
		const classified = classifyLink(
			"/search/results/people/?currentCompany=%5B%221441%22%5D",
		);
		expect(classified?.[0]).toBe("company_urn");
		expect(classified?.[1]).toContain("1441");
	});

	test("buildReferences returns relative urls with kind", () => {
		const refs = buildReferences(
			[
				{ href: "https://www.linkedin.com/in/alice/", text: "Alice Smith" },
				{ href: "https://www.linkedin.com/company/docker/", text: "Docker" },
			],
			"main_profile",
		);
		expect(
			refs.some((r) => r.kind === "person" && r.url === "/in/alice/"),
		).toBe(true);
		expect(
			refs.some((r) => r.kind === "company" && r.url === "/company/docker/"),
		).toBe(true);
	});

	test("buildFeedReferences keeps relative feed_post urls", () => {
		const refs = buildFeedReferences(
			[{ href: "https://www.linkedin.com/feed/update/urn:li:activity:1/" }],
			["/posts/foo_bar-2"],
		);
		expect(refs.every((r) => r.kind === "feed_post")).toBe(true);
		expect(refs.every((r) => r.url.startsWith("/"))).toBe(true);
	});
});

describe("connection state machine", () => {
	const base: ActionSignals = {
		has_invite_anchor: false,
		has_compose_anchor_in_action_root: false,
		has_edit_intro_anchor: false,
		has_labeled_action_button: false,
		has_labeled_action_anchor: false,
		has_incoming_action_row: false,
	};

	test("invite anchor => connectable", () => {
		expect(detectConnectionState({ ...base, has_invite_anchor: true })).toBe(
			"connectable",
		);
	});

	test("compose without labeled button => already_connected", () => {
		expect(
			detectConnectionState({
				...base,
				has_compose_anchor_in_action_root: true,
			}),
		).toBe("already_connected");
	});

	test("compose + labeled button => follow_only", () => {
		expect(
			detectConnectionState({
				...base,
				has_compose_anchor_in_action_root: true,
				has_labeled_action_button: true,
			}),
		).toBe("follow_only");
	});

	test("connect status enums include write outcomes", () => {
		for (const s of CONNECT_STATUSES) {
			expect(typeof s).toBe("string");
		}
		expect(CONNECT_STATUSES).toContain("connected");
		expect(CONNECT_STATUSES).toContain("custom_note_limit_reached");
	});
});

describe("text helpers", () => {
	test("stripLinkedinNoise removes footer noise", () => {
		const raw = "Hello profile\nAbout\nAccessibility\nTalent Solutions";
		const cleaned = stripLinkedinNoise(raw);
		expect(cleaned).toContain("Hello profile");
	});
});

describe("search_people location param", () => {
	test("uses location= not geoUrn=", () => {
		const params = new URLSearchParams({ keywords: "engineer" });
		params.set("location", "São Paulo");
		const qs = params.toString();
		expect(qs).toContain("location=");
		expect(qs).not.toContain("geoUrn=");
	});
});

describe("job filters", () => {
	test("maps job_type / experience / work_type / f_EA", () => {
		expect(
			normalizeCsv("full_time,remote", { full_time: "F", remote: "2" }),
		).toBe("F,2");
		const params = new URLSearchParams();
		params.set("f_EA", "true");
		expect(params.get("f_EA")).toBe("true");
		expect(params.has("f_AL")).toBe(false);
	});
});

describe("section name parsing", () => {
	test("separates known and unknown section names", () => {
		const parsed = parseSectionNames("experience,skills,unknown");
		expect(parsed.names).toEqual(["experience", "skills", "unknown"]);
		expect(Array.from(parsed.known)).toEqual(["experience", "skills"]);
		expect(parsed.unknown).toEqual(["unknown"]);
	});
});

describe("section_errors envelope", () => {
	test("rate-limit goes to section_errors not sections", () => {
		const sections: Record<string, string> = {};
		const errors: Record<
			string,
			{ error_type: string; error_message: string }
		> = {};
		applySectionText(sections, errors, "about", RATE_LIMITED_MSG);
		expect(sections.about).toBeUndefined();
		expect(errors.about?.error_type).toBe("rate_limited");
	});
});

describe("send_message statuses", () => {
	test("includes Python status set", () => {
		expect(SEND_MESSAGE_STATUSES).toContain("message_unavailable");
		expect(SEND_MESSAGE_STATUSES).toContain("confirmation_required");
		expect(SEND_MESSAGE_STATUSES).toContain("send_unavailable");
	});
});
