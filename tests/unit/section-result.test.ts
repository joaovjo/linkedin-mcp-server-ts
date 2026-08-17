import { describe, expect, test } from "bun:test";
import { applySectionText, normalizeCsv, parseSectionNames, RATE_LIMITED_MSG } from "../../src/scraping/section-result.ts";

describe("Unit: section-result", () => {
	test("separates known and unknown section names", () => {
		const parsed = parseSectionNames("experience,skills,custom_unknown");
		expect(parsed.names).toEqual(["experience", "skills", "custom_unknown"]);
		expect(Array.from(parsed.known)).toEqual(["experience", "skills"]);
		expect(parsed.unknown).toEqual(["custom_unknown"]);
	});

	test("normalizes empty or whitespace section names correctly", () => {
		const parsed = parseSectionNames("  about ,  , experience  ");
		expect(parsed.names).toEqual(["about", "experience"]);
		expect(parsed.unknown).toHaveLength(0);
	});

	test("routes rate-limited message into section_errors envelope", () => {
		const sections: Record<string, string> = {};
		const errors: Record<string, { error_type: string; error_message: string }> = {};
		applySectionText(sections, errors, "about", RATE_LIMITED_MSG);
		expect(sections.about).toBeUndefined();
		expect(errors.about?.error_type).toBe("rate_limited");
		expect(errors.about?.error_message).toContain("Rate limited");
	});

	test("routes standard section content into sections map", () => {
		const sections: Record<string, string> = {};
		const errors: Record<string, { error_type: string; error_message: string }> = {};
		applySectionText(sections, errors, "about", "Software engineer summary text");
		expect(sections.about).toBe("Software engineer summary text");
		expect(errors.about).toBeUndefined();
	});

	test("normalizeCsv maps job and search filters correctly", () => {
		const mapping = { full_time: "F", part_time: "P", remote: "2" };
		expect(normalizeCsv("full_time,remote", mapping)).toBe("F,2");
		expect(normalizeCsv("custom_token,part_time", mapping)).toBe("custom_token,P");
	});
});
