// Service worker: fetches a store's Trustpilot reviews on demand.
//
// Trustpilot 403s programmatic fetch(), but serves genuine browser
// navigations. So we open the profile in a background tab (which doesn't
// disturb the popup), read the server-rendered review JSON via scripting, then
// close the tab. Doing this in the worker (not the popup) means the work
// survives even if the popup closes, and results are cached per domain.

import { extractReviews, trustpilotUrl } from "./src/reviews.js";

const RAW_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const rawKey = (domain) => `rpp:reviews:${domain}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Injected into the Trustpilot tab. Trustpilot renders reviews via Next.js App
// Router (data lives in __next_f flight chunks, not __NEXT_DATA__), so the most
// robust source is the RENDERED DOM — the tab actually runs their JS. We read
// each review card's rating + text directly, and keep __NEXT_DATA__ / ld+json
// as a fallback for older layouts.
function grabReviewSources() {
  const parseRating = (s) => {
    if (!s) return null;
    // "Rated 4 out of 5", "Valorado con 4 de 5", "Noté 4 sur 5", or a bare "4".
    const m = s.match(/(?:rated|valorad[oa](?:\s+con)?|not[ée])\s*([0-5](?:[.,]\d)?)/i) ||
              s.match(/\b([0-5](?:[.,]\d)?)\s*(?:out of|\/|de|sur)\s*5\b/i);
    if (m) return Number(m[1].replace(",", "."));
    return null;
  };

  const findRating = (card) => {
    const el = card.querySelector(
      'img[alt*="Rated" i], img[alt*="Valorad" i], img[alt*="Not" i], [aria-label*="Rated" i], [data-service-review-rating]'
    );
    if (!el) return null;
    return (
      parseRating(el.getAttribute("alt")) ??
      parseRating(el.getAttribute("aria-label")) ??
      parseRating(el.getAttribute("data-service-review-rating"))
    );
  };

  const findText = (card) => {
    const el = card.querySelector('[data-service-review-text-typography], [data-review-text]');
    if (el && el.textContent.trim()) return el.textContent.trim();
    let best = "";
    for (const p of card.querySelectorAll("p")) {
      const t = (p.textContent || "").trim();
      if (t.length > best.length) best = t;
    }
    return best;
  };

  const reviews = [];
  const seen = new Set();
  const cards = document.querySelectorAll(
    'article, [class*="reviewCard" i], [data-service-review-card-paper]'
  );
  for (const card of cards) {
    const text = findText(card);
    if (!text || text.length < 15) continue;
    const key = text.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    const title = (card.querySelector('[data-service-review-title-typography], h2, h3')?.textContent || "").trim();
    reviews.push({ title, text, rating: findRating(card) });
  }

  return {
    ready: document.readyState,
    title: document.title || "",
    domReviews: reviews,
    nextData: document.getElementById("__NEXT_DATA__")?.textContent || null,
    ldJson: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent),
  };
}

async function scrapeSources(url) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
  } catch (e) {
    return null;
  }
  try {
    for (let i = 0; i < 18; i++) {
      await sleep(450);
      let res = null;
      try {
        const out = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: grabReviewSources,
        });
        res = out?.[0]?.result || null;
      } catch (e) {
        res = null; // tab still navigating / not injectable yet
      }
      if (res) {
        const hasReviews =
          (res.domReviews && res.domReviews.length > 0) ||
          res.nextData ||
          (res.ldJson || []).some((x) => x && x.includes('"Review"'));
        if (hasReviews) return res;
        if (res.ready === "complete" && i >= 4) return res; // loaded but nothing found
      }
    }
    return null;
  } finally {
    if (tab?.id != null) {
      try { await chrome.tabs.remove(tab.id); } catch (e) { /* already gone */ }
    }
  }
}

async function getReviews(domain) {
  // Cache raw reviews so retries don't re-open a tab.
  try {
    const bag = await chrome.storage.session.get(rawKey(domain));
    const hit = bag[rawKey(domain)];
    if (hit && Date.now() - hit.ts < RAW_TTL_MS) {
      return { url: trustpilotUrl(domain), reviews: hit.reviews };
    }
  } catch (e) { /* ignore */ }

  const url = trustpilotUrl(domain);
  const sources = await scrapeSources(url);
  if (!sources) return { url, reviews: [], blocked: true };

  // Prefer reviews scraped from the rendered DOM; fall back to embedded JSON.
  let reviews = Array.isArray(sources.domReviews) ? sources.domReviews : [];
  if (!reviews.length) reviews = extractReviews(sources);
  try {
    await chrome.storage.session.set({ [rawKey(domain)]: { reviews, ts: Date.now() } });
  } catch (e) { /* ignore */ }
  return { url, reviews };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "getReviews" && msg.domain) {
    getReviews(msg.domain)
      .then(sendResponse)
      .catch(() => sendResponse({ url: trustpilotUrl(msg.domain), reviews: [], blocked: true }));
    return true; // async response
  }
  return false;
});
