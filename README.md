# Return Policy Peek

A thin Chrome extension that shows any store's **return policy in one click** — summarized
by Chrome's **built-in, on-device AI** (Gemini Nano). No login, no backend, nothing leaves
your browser. Works in **English, Spanish, and French**.

## How it works

1. You click the toolbar icon on a store page.
2. An injected detector (`src/detect.js`) scores ecommerce signals (schema.org `Product`,
   `og:type`, cart buttons/links, prices) and finds the best **return/refund policy link**
   in EN/ES/FR (matching link text, `aria-label`, and URL, accent-insensitive).
3. The policy page is fetched **from within the active tab** (injected via `activeTab` +
   `scripting`), so it works same-origin without any broad host permission, then the readable
   text is extracted (`src/extract.js`).
4. `src/ai.js` summarizes it on-device: **Prompt API → Summarizer API → raw text**.
   The prompt asks for the shopper essentials — return window, condition, refund method &
   timing, who pays return shipping, exchanges, exclusions — answered in the page's language.
5. If on-device AI isn't available, it shows the **raw policy text** plus a link, so you
   always get something useful.

Summaries are cached in memory (`chrome.storage.session`, `src/cache.js`) keyed by policy
URL, so re-clicking the same page — or another page of the same store — returns instantly
without re-fetching or re-summarizing. The cache clears when the browser closes.

### Reviews on returns (opt-in)

The summary has a **"Check reviews on returns"** button. It is strictly opt-in: only when you
click it does the extension reach a third party. Trustpilot **403s programmatic `fetch()`** (bot
protection) but serves genuine browser navigations — so the **service worker** (`background.js`)
opens the store's Trustpilot profile in a **background tab** and, because that tab actually
renders (Trustpilot uses Next.js App Router, so review data lives in `__next_f` flight chunks,
not `__NEXT_DATA__`), reads the **rendered review cards straight from the DOM** via
`chrome.scripting` — rating + text per card — then closes the tab. Embedded `__NEXT_DATA__` /
schema.org `ld+json` are kept as a fallback for older layouts.
Running it in the worker (not the popup) means opening the tab can't dismiss the popup, and raw
reviews are cached per domain (`chrome.storage.session`) so retries don't re-open a tab.

The popup then keeps reviews mentioning returns/refunds (EN/ES/FR), summarizes the recurring
complaints and praise on-device, shows a count + average rating, and links to Trustpilot. If a
store has no Trustpilot profile or no return-related reviews, it says so; if on-device AI is
unavailable, it shows a few representative reviews verbatim.

This is the *only* third-party request the extension can make, it never happens automatically,
and it's disclosed at the point of use.

## Project layout

```
manifest.json          MV3 manifest (activeTab + scripting + storage; host: *.trustpilot.com)
popup.html/.css/.js     UI + orchestration (runs in the extension page context)
src/detect.js           Injected page detector: ecommerce + policy-link discovery
src/extract.js          HTML → readable text (DOMParser, main-content aware)
src/ai.js               On-device AI wrapper with graceful fallback chain
_locales/{en,es,fr}/    UI strings
icons/                  Generated icons (see tools/gen_icons.py)
```

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension and click it on any store page.

## Enabling Chrome's built-in AI

Requires **Chrome 138+** (desktop) with the on-device model available. If summaries don't
appear (you'll see the raw-text fallback), enable the model:

- Visit `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
- Visit `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
- Relaunch Chrome. The model (~1–4 GB) downloads in the background on first use; the popup
  shows a download-progress status.
- Requires ~22 GB free disk, >4 GB VRAM, and an unmetered connection (Chrome's constraints).

Language support in Gemini Nano is strongest for English; Spanish/French output is requested
explicitly and falls back gracefully when unsupported.

## Testing it

Good pages to try:
- **EN:** a Shopify store product page → footer "Refund policy" / "Returns".
- **ES:** a Spanish store → "Devoluciones" / "Política de devoluciones".
- **FR:** a French store → "Retours" / "Politique de retour".

The AI fallback chain is unit-tested (mocked built-in AI globals) — see the commands in the
project history. To re-run detection against a live page during development, you can paste the
body of `detectPage()` into the page's DevTools console.

## Privacy

The only network request the extension makes is fetching the store's own return-policy page
to read it. Summarization happens entirely on your device via Chrome's built-in model.

## Regenerating icons

```
python3 tools/gen_icons.py
```
