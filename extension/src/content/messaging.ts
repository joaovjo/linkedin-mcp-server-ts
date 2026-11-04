/* global chrome */
declare const chrome: any;

import { allTextOf, cleanText } from "../shared/extractors.ts";

interface MessagingData {
	conversationCount: number;
	conversationTitles: string[];
	extractedAt: number;
}

function extractMessaging(): MessagingData {
	const titles = allTextOf(".msg-conversation-listitem__participant-names, .msg-conversations-container__convo-title");
	return {
		conversationCount: titles.length,
		conversationTitles: titles,
		extractedAt: Date.now(),
	};
}

chrome.runtime.onMessage.addListener((message: unknown, _sender: any, sendResponse: (r: unknown) => void) => {
	const msg = message as { type?: string; target?: string } | null;
	if (!msg || msg.type !== "extract" || msg.target !== "messaging") return false;
	const data = extractMessaging();
	sendResponse({ type: "extract_result", target: "messaging", ok: true, data, url: window.location.href });
	return true;
});

(globalThis as { __linkedinMcpExtractMessaging?: () => MessagingData }).__linkedinMcpExtractMessaging = extractMessaging;

