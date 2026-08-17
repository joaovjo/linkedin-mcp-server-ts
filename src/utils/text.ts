const NOISE_PATTERNS: RegExp[] = [
	/^About\n+(?:Accessibility|Talent Solutions)/m,
	/^More profiles for you$/m,
	/^Explore premium profiles$/m,
	/^Get up to .+ replies when you message with InMail$/m,
	/^(?:Careers|Privacy & Terms|Questions\?|Select language)\n+(?:Privacy & Terms|Questions\?|Select language|Advertising|Ad Choices|[A-Za-z]+ \([A-Za-z]+\))/m,
];

const NOISE_LINES: RegExp[] = [
	/^(?:Play|Pause|Playback speed|Turn fullscreen on|Fullscreen)$/,
	/^(?:Show captions|Close modal window|Media player modal window)$/,
	/^(?:Loaded:.*|Remaining time.*|Stream Type.*)$/,
];

const UI_ELEMENT_PATTERNS = [
	/^Show more$/m,
	/^Show less$/m,
	/^See all$/m,
	/^View all$/m,
	/^Load more$/m,
	/^\.\.\.$/m,
	/^…$/m,
];

const WHITESPACE_PATTERNS = [/\n{3,}/g, /[ \t]{2,}/g, /\r/g];

export function stripLinkedinNoise(text: string): string {
	let cleaned = text;

	for (const pattern of NOISE_PATTERNS) {
		const match = pattern.exec(cleaned);
		if (match) {
			cleaned = cleaned.slice(0, match.index);
		}
	}

	const lines = cleaned.split("\n").filter((line) => {
		const trimmed = line.trim();
		return !NOISE_LINES.some((nl) => nl.test(trimmed));
	});

	cleaned = lines.join("\n");

	for (const pattern of UI_ELEMENT_PATTERNS) {
		cleaned = cleaned.replace(pattern, "");
	}

	for (const pattern of WHITESPACE_PATTERNS) {
		cleaned = cleaned.replace(pattern, (m) =>
			m.includes("\n") ? "\n\n" : " ",
		);
	}

	return cleaned.trim();
}

export function extractMainContent(text: string): string {
	const mainStart = text.indexOf("main");
	if (mainStart > -1 && mainStart < 100) {
		return text.slice(mainStart);
	}
	return text;
}

export function truncateToLimit(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	const truncated = text.slice(0, maxLength);
	const lastNewline = truncated.lastIndexOf("\n");
	if (lastNewline > maxLength * 0.5) {
		return truncated.slice(0, lastNewline) + "\n[truncated]";
	}
	return truncated + " [truncated]";
}

export function extractUrls(text: string): string[] {
	const urlRegex = /https?:\/\/[^\s<>"]+/g;
	const matches = text.match(urlRegex);
	return matches ? [...new Set(matches)] : [];
}

export function extractEmails(text: string): string[] {
	const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
	const matches = text.match(emailRegex);
	return matches ? [...new Set(matches)] : [];
}

export function extractPhoneNumbers(text: string): string[] {
	const phoneRegex =
		/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
	const matches = text.match(phoneRegex);
	return matches ? [...new Set(matches)] : [];
}

export function cleanTextForJson(text: string): string {
	return text
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
		.replace(/\u2028/g, "\n")
		.replace(/\u2029/g, "\n")
		.trim();
}

export function normalizeWhitespace(text: string): string {
	return text
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.replace(/\t/g, " ")
		.replace(/[ \u00A0]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function splitIntoSentences(text: string): string[] {
	return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

export function highlightKeywords(text: string, keywords: string[]): string {
	if (keywords.length === 0) return text;
	const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const regex = new RegExp(`(${escaped.join("|")})`, "gi");
	return text.replace(regex, "**$1**");
}
