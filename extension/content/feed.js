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

// src/content/feed.ts
function extractFeed() {
  const snippets = allTextOf(".feed-shared-update-v2 .feed-shared-text, .update-components-text").map((t) => t.length > 280 ? `${t.slice(0, 277)}...` : t);
  return {
    postCount: snippets.length,
    postSnippets: snippets,
    extractedAt: Date.now()
  };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message;
  if (!msg || msg.type !== "extract" || msg.target !== "feed")
    return false;
  const data = extractFeed();
  sendResponse({ type: "extract_result", target: "feed", ok: true, data, url: window.location.href });
  return true;
});
globalThis.__linkedinMcpExtractFeed = extractFeed;
