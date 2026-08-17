import { COMPANY_SECTIONS, PERSON_SECTIONS } from "./fields.ts";

/** Soft rate-limit sentinel — Python `_RATE_LIMITED_MSG` parity. */

export const RATE_LIMITED_MSG = "[Rate limited] LinkedIn blocked this section. Try again later or request fewer sections.";

export interface SectionErrorInfo {
	error_type: string;
	error_message: string;
}

export function isRateLimitedText(text: string | undefined | null): boolean {
	if (!text) return false;
	return text === RATE_LIMITED_MSG || text.toLowerCase().includes("rate limited");
}

/** Apply Python-style section envelope: RL goes to section_errors, not sections. */
export function applySectionText(
	sections: Record<string, string>,
	sectionErrors: Record<string, SectionErrorInfo>,
	name: string,
	text: string,
	error?: string,
): void {
	if (isRateLimitedText(text) || error === "rate_limited") {
		sectionErrors[name] = {
			error_type: "rate_limited",
			error_message: RATE_LIMITED_MSG,
		};
		return;
	}
	if (error && !text) {
		sectionErrors[name] = {
			error_type: "extraction_error",
			error_message: error,
		};
		return;
	}
	if (text) sections[name] = text;
}

export function filterValidationError(message: string): Error {
	const err = new Error(message);
	err.name = "FilterValidationError";
	return err;
}

export function normalizeCsv(value: string, mapping: Record<string, string>): string {
	return value
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean)
		.map((p) => mapping[p] ?? p)
		.join(",");
}

export function parseSectionNames(raw: string | undefined): {
	names: string[];
	unknown: string[];
	known: Set<string>;
} {
	const known = new Set<string>();
	const unknown: string[] = [];
	const names: string[] = [];
	if (!raw) return { names, unknown, known };

	const validNames = new Set<string>([
		...Object.keys(PERSON_SECTIONS),
		...Object.keys(COMPANY_SECTIONS),
		"main_profile",
		"search_results",
		"employees",
		"inbox",
		"conversation",
		"feed",
		"job_posting",
	]);

	for (const part of raw.split(",")) {
		const name = part.trim().toLowerCase();
		if (!name) continue;
		names.push(name);
		if (validNames.has(name)) {
			known.add(name);
		} else {
			unknown.push(name);
		}
	}
	return { names, unknown, known };
}
