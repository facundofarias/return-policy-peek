// Parse & score a store's public Trustpilot reviews.
// Pure (no DOM / network): the service worker loads Trustpilot in a real tab
// — Trustpilot 403s programmatic fetch() but serves genuine navigations — and
// hands the server-rendered JSON strings (__NEXT_DATA__ / schema.org ld+json)
// here for extraction. Shared by both the service worker and the popup.

const RETURN_WORDS = [
  "return", "returns", "returned", "returning", "refund", "refunds", "refunded",
  "exchange", "exchanges", "exchanged", "rma", "send it back", "sent it back",
  "devolucion", "devoluciones", "devolver", "reembolso", "reembolsos", "reembolsar", "cambio", "cambios",
  "retour", "retours", "retourner", "remboursement", "remboursements", "rembourser", "echange", "echanges",
];

function stripAccents(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function norm(s) {
  return stripAccents((s || "").toLowerCase());
}

export function storeDomain(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h || null;
  } catch (e) {
    return null;
  }
}

// Recursively collect review-like objects (have both text and a rating).
function collectReviews(node, out, depth = 0) {
  if (!node || depth > 9 || out.length > 400) return;
  if (Array.isArray(node)) {
    for (const item of node) collectReviews(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;

  const text = node.text ?? node.reviewBody ?? node.body ?? node.content;
  let rating = node.rating ?? node.stars ?? node.score;
  if (rating && typeof rating === "object") rating = rating.value ?? rating.ratingValue;
  if (node.reviewRating && node.reviewRating.ratingValue != null) rating = node.reviewRating.ratingValue;

  if (typeof text === "string" && text.trim().length > 0 && rating != null) {
    const num = Number(rating);
    out.push({
      title: typeof node.title === "string" ? node.title : "",
      text: text.trim(),
      rating: Number.isFinite(num) ? num : null,
      language: node.language || node.locale || null,
    });
  }

  for (const key in node) collectReviews(node[key], out, depth + 1);
}

export function trustpilotUrl(domain) {
  return `https://www.trustpilot.com/review/${domain}`;
}

// Extract reviews from the raw JSON strings the service worker scraped off a
// real Trustpilot tab: __NEXT_DATA__ and any schema.org ld+json blocks.
export function extractReviews({ nextData = null, ldJson = [] } = {}) {
  const reviews = [];
  if (nextData) {
    try { collectReviews(JSON.parse(nextData), reviews); } catch (e) { /* ignore */ }
  }
  for (const block of ldJson) {
    if (!block) continue;
    try { collectReviews(JSON.parse(block), reviews); } catch (e) { /* ignore */ }
  }

  // De-duplicate by leading text.
  const seen = new Set();
  return reviews.filter((r) => {
    const k = r.text.slice(0, 140);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function filterReturnReviews(reviews) {
  return reviews.filter((r) => {
    const t = norm(`${r.title} ${r.text}`);
    return RETURN_WORDS.some((w) => t.includes(w));
  });
}

export function reviewsToText(reviews, limit = 25) {
  return reviews
    .slice(0, limit)
    .map((r) => {
      const stars = r.rating != null ? `[${r.rating}/5] ` : "";
      const title = r.title ? `${r.title}: ` : "";
      return `${stars}${title}${r.text}`.slice(0, 600);
    })
    .join("\n\n");
}

export function avgRating(reviews) {
  const rated = reviews.filter((r) => typeof r.rating === "number" && r.rating > 0);
  if (!rated.length) return null;
  return Math.round((rated.reduce((a, r) => a + r.rating, 0) / rated.length) * 10) / 10;
}
