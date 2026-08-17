import { describe, expect, test } from "bun:test";
import {
	cleanTextForJson,
	extractEmails,
	extractPhoneNumbers,
	extractUrls,
	highlightKeywords,
	normalizeWhitespace,
	splitIntoSentences,
	stripLinkedinNoise,
	truncateToLimit,
} from "../../src/utils/text.ts";

describe("Unit: text-utils", () => {
	test("stripLinkedinNoise removes footer noise and UI artifacts", () => {
		const raw = "Senior Engineer at Acme\nAbout\nAccessibility\nTalent Solutions";
		const cleaned = stripLinkedinNoise(raw);
		expect(cleaned).toContain("Senior Engineer at Acme");
		expect(cleaned).not.toContain("Talent Solutions");
	});

	test("stripLinkedinNoise filters media player and show more UI text", () => {
		const raw = "Post content here\nPlay\nPause\nShow more\nSee all";
		const cleaned = stripLinkedinNoise(raw);
		expect(cleaned).toBe("Post content here");
	});

	test("truncateToLimit respects limit and appends [truncated]", () => {
		const longText = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7";
		const truncated = truncateToLimit(longText, 25);
		expect(truncated.length).toBeLessThanOrEqual(35);
		expect(truncated).toContain("[truncated]");
	});

	test("extractUrls extracts unique valid URLs", () => {
		const text = "Check out https://linkedin.com and https://example.com and repeat https://linkedin.com";
		const urls = extractUrls(text);
		expect(urls).toHaveLength(2);
		expect(urls).toContain("https://linkedin.com");
		expect(urls).toContain("https://example.com");
	});

	test("extractEmails extracts valid email addresses", () => {
		const text = "Contact dev@example.com or support@sub.domain.org for info";
		const emails = extractEmails(text);
		expect(emails).toEqual(["dev@example.com", "support@sub.domain.org"]);
	});

	test("extractPhoneNumbers matches standard phone patterns", () => {
		const text = "Call +1 (555) 123-4567 or 555-987-6543 today";
		const phones = extractPhoneNumbers(text);
		expect(phones.length).toBeGreaterThan(0);
	});

	test("normalizeWhitespace standardizes spaces and newlines", () => {
		const text = "Hello \t world \r\n\r\n\r\n\r\n new line";
		expect(normalizeWhitespace(text)).toBe("Hello world\n\nnew line");
	});

	test("cleanTextForJson removes control characters and line separators", () => {
		const text = "Clean \u0000 this \u2028 text \u001f";
		expect(cleanTextForJson(text)).toBe("Clean  this \n text");
	});

	test("splitIntoSentences splits text cleanly by punctuation", () => {
		const text = "First sentence. Second sentence! Third sentence?";
		const sentences = splitIntoSentences(text);
		expect(sentences).toEqual(["First sentence.", "Second sentence!", "Third sentence?"]);
	});

	test("highlightKeywords wraps matching keywords in markdown bold", () => {
		const text = "Senior TypeScript and Bun Engineer";
		const highlighted = highlightKeywords(text, ["TypeScript", "Bun"]);
		expect(highlighted).toBe("Senior **TypeScript** and **Bun** Engineer");
	});
});
