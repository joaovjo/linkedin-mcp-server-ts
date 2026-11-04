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

// src/content/person.ts
function extractPerson() {
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
    extractedAt: Date.now()
  };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message;
  if (!msg || msg.type !== "extract" || msg.target !== "person")
    return false;
  const data = extractPerson();
  const response = {
    type: "extract_result",
    target: "person",
    ok: true,
    data,
    url: window.location.href
  };
  sendResponse(response);
  return true;
});
globalThis.__linkedinMcpExtractPerson = extractPerson;
