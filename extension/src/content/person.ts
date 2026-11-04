/* global chrome */
declare const chrome: any;

import { allTextOf, attrOf, cleanText, textOf } from "../shared/extractors.ts";
import type { ExtractResponseMessage } from "../shared/protocol.ts";

interface PersonData {
	name: string;
	headline: string;
	location: string;
	about: string;
	experience: string[];
	profileUrl: string;
	extractedAt: number;
}

function extractPerson(): PersonData {
	const name = textOf("h1");
	const headline = textOf(".text-body-medium.break-words");
	const location = textOf(".text-body-small.inline.t-black--light.break-words");
	const about = textOf("#about ~ .display-flex .visually-hidden, section#about .inline-show-more-text");
	const experience = allTextOf("section#experience li .t-bold span[aria-hidden='true']");
	return {
		name,
		headline,
		location,
		about,
		experience,
		profileUrl: window.location.href,
		extractedAt: Date.now(),
	};
}

chrome.runtime.onMessage.addListener((message: unknown, _sender: any, sendResponse: (r: unknown) => void) => {
	const msg = message as { type?: string; target?: string } | null;
	if (!msg || msg.type !== "extract" || msg.target !== "person") return false;

	// Read-only extraction; batch any future DOM writes with requestAnimationFrame.
	const data = extractPerson();
	const response: ExtractResponseMessage = {
		type: "extract_result",
		target: "person",
		ok: true,
		data,
		url: window.location.href,
	};
	sendResponse(response);
	return true;
});

// Expose for debugging in the page console without eval.
(globalThis as { __linkedinMcpExtractPerson?: () => PersonData }).__linkedinMcpExtractPerson = extractPerson;

