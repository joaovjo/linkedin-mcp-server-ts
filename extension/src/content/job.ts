/* global chrome */
declare const chrome: any;

import { cleanText, textOf } from "../shared/extractors.ts";

interface JobData {
	title: string;
	company: string;
	location: string;
	description: string;
	jobUrl: string;
	extractedAt: number;
}

function extractJob(): JobData {
	return {
		title: textOf("h1, .job-details-jobs-unified-top-card__job-title"),
		company: textOf(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a"),
		location: textOf(".job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet"),
		description: textOf(".jobs-description__content, .jobs-box__html-content"),
		jobUrl: window.location.href,
		extractedAt: Date.now(),
	};
}

chrome.runtime.onMessage.addListener((message: unknown, _sender: any, sendResponse: (r: unknown) => void) => {
	const msg = message as { type?: string; target?: string } | null;
	if (!msg || msg.type !== "extract" || msg.target !== "job") return false;
	const data = extractJob();
	sendResponse({ type: "extract_result", target: "job", ok: true, data, url: window.location.href });
	return true;
});

(globalThis as { __linkedinMcpExtractJob?: () => JobData }).__linkedinMcpExtractJob = extractJob;

