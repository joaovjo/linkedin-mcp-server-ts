/* global chrome */
declare const chrome: any;

import { cleanText, textOf } from "../shared/extractors.ts";

interface CompanyData {
	name: string;
	tagline: string;
	about: string;
	industry: string;
	website: string;
	profileUrl: string;
	extractedAt: number;
}

function extractCompany(): CompanyData {
	return {
		name: textOf("h1"),
		tagline: textOf(".org-top-card-summary__tagline"),
		about: textOf("section.org-about-module, #about"),
		industry: textOf(".org-top-card-summary-info-list__info-item"),
		website: cleanText(document.querySelector('a[data-tracking-control-name="about_website"]')?.getAttribute("href") ?? ""),
		profileUrl: window.location.href,
		extractedAt: Date.now(),
	};
}

chrome.runtime.onMessage.addListener((message: unknown, _sender: any, sendResponse: (r: unknown) => void) => {
	const msg = message as { type?: string; target?: string } | null;
	if (!msg || msg.type !== "extract" || msg.target !== "company") return false;
	const data = extractCompany();
	sendResponse({ type: "extract_result", target: "company", ok: true, data, url: window.location.href });
	return true;
});

(globalThis as { __linkedinMcpExtractCompany?: () => CompanyData }).__linkedinMcpExtractCompany = extractCompany;

