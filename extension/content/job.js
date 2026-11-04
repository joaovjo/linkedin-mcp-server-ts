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

// src/content/job.ts
function extractJob() {
  return {
    title: textOf("h1, .job-details-jobs-unified-top-card__job-title"),
    company: textOf(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a"),
    location: textOf(".job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet"),
    description: textOf(".jobs-description__content, .jobs-box__html-content"),
    jobUrl: window.location.href,
    extractedAt: Date.now()
  };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message;
  if (!msg || msg.type !== "extract" || msg.target !== "job")
    return false;
  const data = extractJob();
  sendResponse({ type: "extract_result", target: "job", ok: true, data, url: window.location.href });
  return true;
});
globalThis.__linkedinMcpExtractJob = extractJob;
