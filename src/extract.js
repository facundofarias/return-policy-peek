// Runs in the popup (extension page) context, which has DOMParser.
// Turns a fetched HTML string into readable, whitespace-normalized text,
// preferring the main content region and preserving block-level line breaks.

const NOISE = "script,style,noscript,template,svg,iframe,form,button,input,select,nav,aside";

const BLOCK_TAGS = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "LI", "UL", "OL", "TR", "TABLE",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "FOOTER", "BLOCKQUOTE", "DD", "DT",
]);

function nodeToText(root) {
  let out = "";
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue.replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === "BR") { out += "\n"; return; }
    for (const child of node.childNodes) walk(child);
    if (BLOCK_TAGS.has(tag)) out += "\n";
  };
  walk(root);
  return out;
}

export function extractReadableText(html) {
  // Neutralize resource-loading tags BEFORE parsing. Chrome's preload scanner
  // fires <link rel=preload>/stylesheet (and script/style) fetches even for a
  // DOMParser document, which then warn "preloaded but not used" against the
  // popup. We only need text, so strip them from the string up front.
  const cleaned = (html || "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  let doc;
  try {
    doc = new DOMParser().parseFromString(cleaned, "text/html");
  } catch (e) {
    return "";
  }
  doc.querySelectorAll(NOISE).forEach((el) => el.remove());

  const container =
    doc.querySelector("main") ||
    doc.querySelector("article") ||
    doc.querySelector('[role="main"]') ||
    doc.querySelector("#content, .content, #main, .main") ||
    doc.body ||
    doc.documentElement;

  if (!container) return "";

  const text = nodeToText(container)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
