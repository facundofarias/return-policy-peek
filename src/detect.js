// Runs INSIDE the target page via chrome.scripting.executeScript.
// Must be fully self-contained — it may not reference any module-scope
// variables, because only its source is injected.
export function detectPage() {
  const lc = (s) => (s || "").toLowerCase();
  const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const norm = (s) => stripAccents(lc(s)).replace(/\s+/g, " ").trim();

  // ---- Ecommerce detection (score-based) ----
  let score = 0;
  const signals = [];

  try {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      const t = norm(s.textContent);
      if (
        t.includes('"@type":"product"') ||
        t.includes('"@type": "product"') ||
        t.includes("aggregateoffer") ||
        t.includes('"@type":"offer"') ||
        t.includes('"@type": "offer"')
      ) {
        score += 3;
        signals.push("schema-product");
        break;
      }
    }
  } catch (e) { /* ignore malformed JSON-LD */ }

  const ogType = norm(document.querySelector('meta[property="og:type"]')?.content);
  if (ogType.includes("product")) { score += 2; signals.push("og-product"); }

  if (document.querySelector('[itemtype*="schema.org/Product" i]')) {
    score += 2; signals.push("microdata-product");
  }

  const cartWords = [
    "add to cart", "add to bag", "add to basket", "buy now",
    "anadir al carrito", "agregar al carrito", "anadir a la cesta", "comprar ahora", "anadir al cesto",
    "ajouter au panier", "acheter maintenant", "ajouter au sac",
  ];
  let cartHit = false;
  const clickable = document.querySelectorAll(
    'button, a[role="button"], input[type="submit"], [class*="cart" i], [id*="cart" i]'
  );
  for (const el of clickable) {
    const txt = norm(el.textContent || el.value || el.getAttribute?.("aria-label"));
    if (txt && cartWords.some((w) => txt.includes(w))) { cartHit = true; break; }
  }
  if (cartHit) { score += 2; signals.push("cart-button"); }

  if (document.querySelector(
    'a[href*="/cart" i], a[href*="/basket" i], a[href*="/panier" i], a[href*="/carrito" i], a[href*="/checkout" i]'
  )) { score += 1; signals.push("cart-link"); }

  const bodySample = (document.body?.innerText || "").slice(0, 5000);
  if (/[$€£]\s?\d|\d[.,]\d{2}\s?(usd|eur|gbp)/i.test(bodySample)) {
    score += 1; signals.push("price");
  }

  const isEcommerce = score >= 3;

  // ---- Return-policy link discovery (EN / ES / FR) ----
  const policyKeywords = [
    // English
    { w: "return policy", s: 6 }, { w: "returns policy", s: 6 },
    { w: "returns & refunds", s: 6 }, { w: "returns and refunds", s: 6 },
    { w: "refund policy", s: 6 }, { w: "returns & exchanges", s: 6 },
    { w: "returns", s: 4 }, { w: "return", s: 3 },
    { w: "refunds", s: 4 }, { w: "refund", s: 3 }, { w: "exchanges", s: 2 },
    // Spanish
    { w: "politica de devoluciones", s: 6 }, { w: "politica de devolucion", s: 6 },
    { w: "devoluciones y reembolsos", s: 6 }, { w: "cambios y devoluciones", s: 6 },
    { w: "devoluciones", s: 4 }, { w: "devolucion", s: 3 },
    { w: "reembolsos", s: 4 }, { w: "reembolso", s: 3 },
    // French
    { w: "politique de retour", s: 6 }, { w: "politique de retours", s: 6 },
    { w: "retours et remboursements", s: 6 }, { w: "echanges et retours", s: 5 },
    { w: "retours", s: 4 }, { w: "retour", s: 3 },
    { w: "remboursements", s: 4 }, { w: "remboursement", s: 3 },
  ];
  const hrefKeywords = [
    "return", "refund", "devolucion", "reembolso",
    "retour", "remboursement", "exchange", "cambios",
  ];

  let best = null;
  for (const a of document.querySelectorAll("a[href]")) {
    const raw = a.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
      continue;
    }
    let abs;
    try { abs = new URL(raw, location.href).href; } catch (e) { continue; }

    const text = norm(a.textContent);
    const aria = norm(a.getAttribute("aria-label") || a.getAttribute("title"));
    const hrefN = norm(abs);

    let sc = 0;
    let matched = "";
    for (const { w, s } of policyKeywords) {
      if (text === w) { if (s + 3 > sc) { sc = s + 3; matched = w; } }
      else if (text.includes(w)) { if (s + 1 > sc) { sc = s + 1; matched = w; } }
      else if (aria && aria.includes(w)) { if (s > sc) { sc = s; matched = w; } }
    }
    for (const hk of hrefKeywords) {
      if (hrefN.includes(hk)) { sc += 1; break; }
    }
    if (text.length > 45) sc -= 2; // long text = probably body copy, not a nav link

    if (sc > 0 && (!best || sc > best.score)) {
      best = { url: abs, text: (a.textContent || "").trim().slice(0, 80), score: sc, matched };
    }
  }

  // Is the current page itself a return-policy page?
  const pageTitle = norm(document.title);
  const h1 = norm(document.querySelector("h1")?.textContent);
  const selfKeys = ["return", "refund", "devolucion", "reembolso", "retour", "remboursement"];
  const selfIsPolicy = selfKeys.some((k) => pageTitle.includes(k) || h1.includes(k));

  return {
    isEcommerce,
    score,
    signals,
    policyUrl: best?.url || null,
    policyLinkText: best?.text || null,
    policyScore: best?.score || 0,
    selfIsPolicy,
    currentUrl: location.href,
    pageLang: (document.documentElement.getAttribute("lang") || "").slice(0, 2).toLowerCase() || null,
    title: document.title,
  };
}
