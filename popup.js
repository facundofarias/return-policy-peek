import { detectPage } from "./src/detect.js";
import { extractReadableText } from "./src/extract.js";
import { summarizePolicy, summarizeReturnComplaints } from "./src/ai.js";
import { getCached, setCached } from "./src/cache.js";
import {
  storeDomain,
  trustpilotUrl,
  filterReturnReviews,
  reviewsToText,
  avgRating,
} from "./src/reviews.js";

// Shared context for the on-demand "check reviews" action.
const ctx = { detection: null };

const t = (key, sub) => chrome.i18n.getMessage(key, sub) || key;
const el = (id) => document.getElementById(id);

const statusBox = () => el("status");
const statusText = () => el("status-text");
const resultBox = () => el("result");

function localizeStatic() {
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const msg = t(node.dataset.i18n);
    if (msg) node.textContent = msg;
  }
}

function setupAbout() {
  const mainView = el("view-main");
  const about = el("about");
  const toggle = el("about-toggle");
  const back = el("about-back");
  const showAbout = (show) => {
    about.hidden = !show;
    mainView.hidden = show;
  };
  toggle.addEventListener("click", () => showAbout(about.hidden));
  back.addEventListener("click", () => showAbout(false));
  try {
    el("version").textContent = chrome.runtime.getManifest().version;
  } catch (e) { /* ignore */ }
}

function setStatus(text, { done = false } = {}) {
  statusBox().hidden = false;
  statusBox().classList.toggle("done", done);
  statusText().textContent = text;
}

function hideStatus() {
  statusBox().hidden = true;
}

function uiLang() {
  const l = (chrome.i18n.getUILanguage() || "en").slice(0, 2).toLowerCase();
  return ["en", "es", "fr"].includes(l) ? l : "en";
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Escape first, then re-introduce a minimal safe subset of inline markdown
// (**bold**). Operating on the escaped string keeps this injection-safe.
function inlineMd(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>");
}

// Render a lightweight markdown-ish summary (bullets + paragraphs) safely.
function renderSummaryHtml(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let html = "";
  let inList = false;
  for (const line of lines) {
    const bullet = line.match(/^([-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inlineMd(bullet[2])}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${inlineMd(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function badge(detection) {
  if (detection.isEcommerce) {
    return `<div class="badge store">🛍️ ${escapeHtml(t("storeDetected"))}</div>`;
  }
  return `<div class="badge plain">🌐 ${escapeHtml(t("noStoreDetected"))}</div>`;
}

function policyLinkButton(url) {
  return `<a class="btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(t("viewFullPolicy"))}</a>`;
}

function sourceLine(url) {
  let host = url;
  try { host = new URL(url).host; } catch (e) { /* keep raw */ }
  return `<div class="source-line">${escapeHtml(t("sourceLabel"))} ${escapeHtml(host)}</div>`;
}

// Opt-in "check reviews" button (sits beside "View full policy") and a separate
// full-width container the result renders into. Only when we can derive a domain.
function reviewsButton() {
  if (!storeDomain(ctx.detection?.currentUrl)) return "";
  return `<button id="check-reviews" class="btn reviews-btn" type="button">🔎 ${escapeHtml(t("checkReviews"))}</button>`;
}

function reviewsContainer() {
  if (!storeDomain(ctx.detection?.currentUrl)) return "";
  return `<div id="complaints" class="complaints"></div>`;
}

function ratingPill(rating) {
  if (!["good", "medium", "bad"].includes(rating)) return "";
  const icon = { good: "🟢", medium: "🟡", bad: "🔴" }[rating];
  return `<span class="rating-pill rating-${rating}" title="${escapeHtml(t("ratingWhat"))}">${icon} ${escapeHtml(t("rating_" + rating))}</span>`;
}

function showSummary(detection, summary, url, engine, fromCache = false, rating = null) {
  hideStatus();
  const box = resultBox();
  box.hidden = false;
  const cachedTag = fromCache
    ? `<span class="cached-tag">⚡ ${escapeHtml(t("cachedNote"))}</span>`
    : "";
  box.innerHTML =
    badge(detection) +
    `<div class="summary">
       <div class="summary-head">
         <h2>${escapeHtml(t("returnPolicyHeading"))}${cachedTag}</h2>
         ${ratingPill(rating)}
       </div>
       <div class="summary-body">${renderSummaryHtml(summary)}</div>
     </div>
     <div class="actions">${policyLinkButton(url)}${reviewsButton()}</div>${reviewsContainer()}` +
    sourceLine(url);
}

function showRaw(detection, rawText, url, noticeKey) {
  hideStatus();
  const box = resultBox();
  box.hidden = false;
  const notice = noticeKey
    ? `<div class="notice">⚠️ <span>${escapeHtml(t(noticeKey))}</span></div>`
    : "";
  const snippet = rawText ? rawText.slice(0, 4000) : "";
  const body = snippet
    ? `<div class="raw-text">${escapeHtml(snippet)}${rawText.length > snippet.length ? "…" : ""}</div>`
    : `<div class="empty">${escapeHtml(t("couldNotRead"))}</div>`;
  box.innerHTML =
    badge(detection) +
    notice +
    body +
    `<div class="actions">${policyLinkButton(url)}${reviewsButton()}</div>${reviewsContainer()}` +
    sourceLine(url);
}

function showNoPolicy(detection) {
  hideStatus();
  const box = resultBox();
  box.hidden = false;
  box.innerHTML =
    badge(detection) +
    `<div class="empty">${escapeHtml(t("noPolicyFound"))}</div>`;
}

function showError(msgKey) {
  hideStatus();
  const box = resultBox();
  box.hidden = false;
  box.innerHTML = `<div class="empty">${escapeHtml(t(msgKey))}</div>`;
}

function complaintsMessage(msgKey, profileUrl) {
  const link = profileUrl
    ? `<a class="btn" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(t("reviewsViewSource"))}</a>`
    : "";
  return `<div class="complaints-msg">${escapeHtml(t(msgKey))}</div>${link ? `<div class="actions">${link}</div>` : ""}`;
}

function renderComplaints(box, data) {
  const stars = data.avg != null ? ` · ★${data.avg}` : "";
  const stat = `${t("reviewsCount", String(data.count))}${stars}`;
  let body;
  if (data.summary) {
    body = `<div class="summary-body">${renderSummaryHtml(data.summary)}</div>`;
  } else {
    // AI unavailable → show a few representative reviews verbatim.
    const items = (data.samples || [])
      .map((r) => {
        const s = r.rating != null ? `★${r.rating} ` : "";
        const title = r.title ? `<strong>${escapeHtml(r.title)}</strong> — ` : "";
        return `<li>${s}${title}${escapeHtml(r.text.slice(0, 260))}${r.text.length > 260 ? "…" : ""}</li>`;
      })
      .join("");
    body = `<div class="complaints-msg">${escapeHtml(t("reviewsAiRaw"))}</div><ul class="review-samples">${items}</ul>`;
  }
  box.innerHTML =
    `<div class="complaints-card">
       <h3 class="complaints-title">${escapeHtml(t("reviewsHeading"))}</h3>
       <div class="complaints-stat">${escapeHtml(stat)}</div>
       ${body}
       <div class="actions">
         <a class="btn" href="${escapeHtml(data.profileUrl)}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(t("reviewsViewSource"))}</a>
       </div>
       <div class="complaints-note">${escapeHtml(t("reviewsPrivacyNote"))}</div>
     </div>`;
}

async function checkComplaints(btn) {
  const box = el("complaints");
  if (!box) return;
  const domain = storeDomain(ctx.detection?.currentUrl);
  if (!domain) { box.innerHTML = complaintsMessage("reviewsError"); return; }

  btn.disabled = true;
  box.innerHTML =
    `<div class="status"><span class="spinner"></span><span>${escapeHtml(t("checkingReviews"))}</span></div>`;

  const cacheKey = `reviews:${domain}`;
  const profileUrl = trustpilotUrl(domain);
  const cached = await getCached(cacheKey);
  if (cached && "count" in cached) { renderComplaints(box, cached); btn.disabled = false; return; }

  try {
    // The service worker opens Trustpilot in a background tab and scrapes it —
    // fetch() is 403'd, but a real navigation isn't.
    const resp = await chrome.runtime.sendMessage({ type: "getReviews", domain });
    const reviews = resp?.reviews || [];

    if (!reviews.length) {
      box.innerHTML = complaintsMessage(resp?.blocked ? "reviewsError" : "reviewsNoProfile", profileUrl);
      return;
    }

    const relevant = filterReturnReviews(reviews);
    if (!relevant.length) { box.innerHTML = complaintsMessage("reviewsNoReturns", profileUrl); return; }

    const lang = ctx.detection.pageLang || uiLang();
    const res = await summarizeReturnComplaints(reviewsToText(relevant), lang, () => {});
    const data = {
      profileUrl,
      count: relevant.length,
      avg: avgRating(relevant),
      summary: res.summary || null,
      samples: relevant.slice(0, 3),
    };
    setCached(cacheKey, data);
    renderComplaints(box, data);
  } catch (err) {
    box.innerHTML = complaintsMessage("reviewsError", profileUrl);
  } finally {
    btn.disabled = false;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Fetch the return-policy page from INSIDE the active tab (via activeTab +
// scripting) rather than from the extension origin. Return policies are almost
// always same-origin to the store page, so this needs no host permission and
// avoids requesting broad host access. Cross-origin policy pages (rare — e.g. a
// help subdomain) hit CORS and yield "", and we degrade to the "view policy"
// link.
async function fetchPolicyHtml(tabId, url) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [url],
    func: (u) =>
      fetch(u, { credentials: "omit", redirect: "follow" })
        .then((r) => {
          const ct = (r.headers.get("content-type") || "").toLowerCase();
          if (!r.ok) return "";
          if (!ct.includes("html") && ct !== "") return "";
          return r.text();
        })
        .catch(() => ""),
  });
  return result || "";
}

async function run() {
  localizeStatic();
  setupAbout();
  // Delegated handler for the opt-in "check reviews" button (survives re-render).
  resultBox().addEventListener("click", (e) => {
    const btn = e.target.closest("#check-reviews");
    if (btn) checkComplaints(btn);
  });
  setStatus(t("statusChecking"));

  const tab = await getActiveTab();
  if (!tab || !/^https?:/i.test(tab.url || "")) {
    showError("cannotRunHere");
    return;
  }

  // 1. Detect ecommerce + find the return-policy link on the current page.
  let detection;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectPage,
    });
    detection = result;
  } catch (e) {
    showError("cannotRunHere");
    return;
  }
  if (!detection) { showError("cannotRunHere"); return; }
  ctx.detection = detection;

  // 1b. Serve from cache on repeat clicks of the same page (or same store policy).
  const cacheKey = detection.policyUrl || detection.currentUrl;
  const cached = await getCached(cacheKey);
  if (cached?.summary) {
    showSummary(detection, cached.summary, cached.policyUrl || cacheKey, cached.engine, true, cached.rating);
    return;
  }

  // 2. Resolve where the policy text lives.
  let policyUrl = detection.policyUrl;
  let policyText = "";

  if (policyUrl && policyUrl !== detection.currentUrl) {
    setStatus(t("fetchingPolicy"));
    try {
      const html = await fetchPolicyHtml(tab.id, policyUrl);
      policyText = extractReadableText(html);
    } catch (e) {
      policyText = "";
    }
  }

  // Fallback: the current page itself is the policy page.
  if ((!policyText || policyText.length < 200) && detection.selfIsPolicy) {
    try {
      const [{ result: pageText }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => (document.querySelector("main") || document.body).innerText,
      });
      if (pageText && pageText.length > (policyText?.length || 0)) {
        policyText = pageText;
        policyUrl = detection.currentUrl;
      }
    } catch (e) { /* ignore */ }
  }

  // Nothing usable found.
  if (!policyText || policyText.length < 80) {
    if (policyUrl) { showRaw(detection, null, policyUrl, null); }
    else { showNoPolicy(detection); }
    return;
  }

  // 3. Summarize on-device (with fallback to raw text).
  const lang = detection.pageLang || uiLang();
  setStatus(t("summarizing"));
  const result = await summarizePolicy(policyText, lang, (s) => {
    if (s.phase === "downloading") setStatus(t("downloadingModel", String(s.progress)));
    else setStatus(t("summarizing"));
  });

  if (result.source === "ai" && result.summary) {
    showSummary(detection, result.summary, policyUrl, result.engine, false, result.rating);
    setCached(cacheKey, { summary: result.summary, engine: result.engine, policyUrl, rating: result.rating || null });
  } else {
    showRaw(detection, policyText, policyUrl, "aiUnavailable");
  }
}

run().catch(() => showError("errorGeneric"));
