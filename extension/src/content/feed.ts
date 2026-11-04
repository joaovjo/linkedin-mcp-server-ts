/* global chrome */
declare const chrome: any;

import { allTextOf, cleanText } from "../shared/extractors.ts";

interface FeedData {
	postCount: number;
	postSnippets: string[];
	extractedAt: number;
}

function extractFeed(): FeedData {
	const snippets = allTextOf(".feed-shared-update-v2 .feed-shared-text, .update-components-text")
		.map((t) => (t.length > 280 ? `${t.slice(0, 277)}...` : t));
	return {
		postCount: snippets.length,
		postSnippets: snippets,
		extractedAt: Date.now(),
	};
}

chrome.runtime.onMessage.addListener((message: unknown, _sender: any, sendResponse: (r: unknown) => void) => {
	const msg = message as { type?: string; target?: string } | null;
	if (!msg || msg.type !== "extract" || msg.target !== "feed") return false;
	const data = extractFeed();
	sendResponse({ type: "extract_result", target: "feed", ok: true, data, url: window.location.href });
	return true;
});

(globalThis as { __linkedinMcpExtractFeed?: () => FeedData }).__linkedinMcpExtractFeed = extractFeed;

