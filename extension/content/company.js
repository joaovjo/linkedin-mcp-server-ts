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

// src/content/company.ts
function extractCompany() {
  return {
    name: textOf("h1"),
    tagline: textOf(".org-top-card-summary__tagline"),
    about: textOf("section.org-about-module, #about"),
    industry: textOf(".org-top-card-summary-info-list__info-item"),
    website: cleanText(document.querySelector('a[data-tracking-control-name="about_website"]')?.getAttribute("href") ?? ""),
    profileUrl: window.location.href,
    extractedAt: Date.now()
  };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message;
  if (!msg || msg.type !== "extract" || msg.target !== "company")
    return false;
  const data = extractCompany();
  sendResponse({ type: "extract_result", target: "company", ok: true, data, url: window.location.href });
  return true;
});
globalThis.__linkedinMcpExtractCompany = extractCompany;
