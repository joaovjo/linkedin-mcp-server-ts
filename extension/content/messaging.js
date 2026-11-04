// src/shared/extractors.ts
function cleanText(value) {
  if (!value)
    return "";
  return value.replace(/\s+/g, " ").trim();
}
function textOf(selector, root = document) {
  const el = root.querySelector(selector);
  return cleanText(el?.textContent ?? "");
}
function allTextOf(selector, root = document) {
  return [...root.querySelectorAll(selector)].map((el) => cleanText(el.textContent)).filter((t) => t.length > 0);
}

// src/content/messaging.ts
function extractMessaging() {
  const titles = allTextOf(".msg-conversation-listitem__participant-names, .msg-conversations-container__convo-title");
  return {
    conversationCount: titles.length,
    conversationTitles: titles,
    extractedAt: Date.now()
  };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message;
  if (!msg || msg.type !== "extract" || msg.target !== "messaging")
    return false;
  const data = extractMessaging();
  sendResponse({ type: "extract_result", target: "messaging", ok: true, data, url: window.location.href });
  return true;
});
globalThis.__linkedinMcpExtractMessaging = extractMessaging;
