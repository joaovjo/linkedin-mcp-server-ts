import { describe, expect, test } from "bun:test";
import {
	buildFeedReferences,
	buildReferences,
	classifyLink,
	firstCompanyUrnFromQuery,
	normalizeUrl,
} from "../../src/scraping/link-metadata.ts";

describe("Unit: link-metadata", () => {
	test("normalizeUrl strips hash and resolves relative URLs", () => {
		expect(normalizeUrl("/in/alice/#about")).toBe("https://www.linkedin.com/in/alice/");
		expect(normalizeUrl("https://www.linkedin.com/in/bob/?trk=x#y")).toBe("https://www.linkedin.com/in/bob/?trk=x");
	});

	test("classifyLink classifies person, company, job, feed_post, and conversation links", () => {
		expect(classifyLink("https://www.linkedin.com/in/alice/")).toEqual(["person", "/in/alice/"]);
		expect(classifyLink("/company/docker/")).toEqual(["company", "/company/docker/"]);
		expect(classifyLink("/jobs/view/12345/")).toEqual(["job", "/jobs/view/12345/"]);
		expect(classifyLink("/feed/update/urn:li:activity:99/")).toEqual(["feed_post", "/feed/update/urn:li:activity:99/"]);
		expect(classifyLink("/posts/alice_activity-1/")).toEqual(["feed_post", "/posts/alice_activity-1"]);
		expect(classifyLink("/messaging/thread/abc123/")).toEqual(["conversation", "/messaging/thread/abc123/"]);
	});

	test("firstCompanyUrnFromQuery extracts company URN from currentCompany query", () => {
		const urn = firstCompanyUrnFromQuery('currentCompany=["1441"]');
		expect(urn).toBe("1441");
		const classified = classifyLink("/search/results/people/?currentCompany=%5B%221441%22%5D");
		expect(classified?.[0]).toBe("company_urn");
		expect(classified?.[1]).toContain("1441");
	});

	test("buildReferences produces structured reference objects with kinds", () => {
		const refs = buildReferences(
			[
				{ href: "https://www.linkedin.com/in/alice/", text: "Alice Smith" },
				{ href: "https://www.linkedin.com/company/docker/", text: "Docker" },
			],
			"main_profile",
		);
		expect(refs.some((r) => r.kind === "person" && r.url === "/in/alice/")).toBe(true);
		expect(refs.some((r) => r.kind === "company" && r.url === "/company/docker/")).toBe(true);
	});

	test("buildFeedReferences preserves relative feed_post urls", () => {
		const refs = buildFeedReferences([{ href: "https://www.linkedin.com/feed/update/urn:li:activity:1/" }], ["/posts/foo_bar-2"]);
		expect(refs).toHaveLength(2);
		expect(refs.every((r) => r.kind === "feed_post")).toBe(true);
		expect(refs.every((r) => r.url.startsWith("/"))).toBe(true);
	});
});
