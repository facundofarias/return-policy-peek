# Chrome Web Store — Listing & Submission Notes

Everything you need to fill in the Chrome Web Store (CWS) developer dashboard for
**Return Policy Peek**. Copy/paste the text fields; capture the images per the
specs at the bottom.

---

## Product name

```
Return Policy Peek
```

## Summary / short description (max 132 chars)

```
See any store's return policy in one click — summarized privately on your device by Chrome's built-in AI. EN/ES/FR.
```

## Category

```
Shopping
```

## Language

```
English (also localized to Spanish and French)
```

## Detailed description

```
Return Policy Peek shows you any online store's return and refund policy in a
single click — no login, no account, and nothing leaves your browser.

When you're on a store page, click the icon. The extension finds the store's
return/refund policy, reads it, and gives you a short, scannable summary of what
actually matters: the return window, item condition, how and when refunds are
issued, who pays return shipping, exchanges, and any exclusions.

The summary is generated ON YOUR DEVICE using Chrome's built-in AI (Gemini
Nano). The policy text is never sent to us or any third party — there is no
backend server and no tracking of any kind.

Optional: tap "Check reviews on returns" to see what real customers say about a
store's returns and refunds, summarized from its public Trustpilot page. This is
strictly opt-in — it's the only time the extension contacts a third party, and
only when you ask.

WORKS IN ENGLISH, SPANISH, AND FRENCH — both the interface and the policy
detection.

WHY YOU'LL LIKE IT
• One click — return policy summarized instantly
• Private by design — on-device AI, no backend, no accounts, no tracking
• Optional review check — see returns-related complaints before you buy
• Free and open source — anyone can inspect exactly what it does
• Trilingual — English, Spanish, French

REQUIREMENTS
Chrome 138+ with the built-in AI model available. If on-device AI isn't
available, the extension still shows you the return-policy text and a link, so
you always get something useful.

Made by Rumbo Labs — https://rumbolabs.net/
```

## Single purpose (required)

```
Return Policy Peek has one purpose: to find and summarize an online store's
return/refund policy on the user's device with a single click.
```

## Permission justifications (required)

- **activeTab** — Used only when the user clicks the extension. It lets the
  extension read the current store page to detect it is a store and locate the
  return/refund policy link.
- **scripting** — Injects a small read-only detector into the active tab to find
  the policy link, and (only on the opt-in "Check reviews" action) reads the
  publicly rendered reviews from the store's Trustpilot page.
- **storage** — Caches summaries in `chrome.storage.session` (in-memory only) so
  repeat clicks are instant. Cleared when the browser closes.
- **Host permissions (http/https)** — Needed to fetch the store's own
  return-policy page so it can be summarized, and (only on request) to open the
  store's public Trustpilot page. Broad host access is required because the user
  may shop on any store domain.

## Data usage disclosures (Privacy practices tab)

- Does the extension collect user data? **No.**
- Sold to third parties? **No.**
- Used or transferred for purposes unrelated to the item's core functionality?
  **No.**
- Used or transferred to determine creditworthiness / lending? **No.**
- Check all three certification boxes (no selling, no unrelated use, no
  creditworthiness use).

## Privacy policy URL (required)

Host `PRIVACY.md` somewhere public (e.g., GitHub raw/Pages) and paste the URL,
for example:

```
https://github.com/facundofarias/return-policy-peek/blob/main/PRIVACY.md
```

## Homepage / support URL

```
https://rumbolabs.net/
```

## Test instructions (for reviewers)

- **Credentials:** leave Username and Password **blank** — the extension has no
  login, account, or authentication of any kind.
- **Additional instructions** (498/500 chars):

```
No login or account required. Requires Chrome 138+ with built-in AI (Gemini Nano). If no summary appears, enable chrome://flags/#prompt-api-for-gemini-nano and #optimization-guide-on-device-model (Enabled BypassPerfRequirement), relaunch, and let the model download on first use. To test: open any store page (e.g. https://www.sivasdescalzo.com) and click the toolbar icon -> the return policy is summarized on-device. Optional: "Check reviews on returns" opens the store's Trustpilot page briefly.
```

---

## Image assets (upload in the dashboard)

You must capture these — they need the real rendered popup, which can't be
generated from code. Recommended: open the popup on a store with a good policy
(and run "Check reviews" for one shot), then screenshot.

| Asset | Size | Required | Notes |
|-------|------|----------|-------|
| Store icon | 128×128 PNG | ✅ | Use `icons/icon128.png` (already in repo). |
| Screenshot(s) | 1280×800 or 640×400 PNG/JPG | ✅ (1–5) | Show: (1) the one-click summary, (2) the reviews-on-returns card, (3) the About panel. |
| Small promo tile | 440×280 PNG/JPG | Optional | Logo + tagline on brand blue (#2563eb). |
| Marquee promo | 1400×560 PNG/JPG | Optional | Only if featured. |

Screenshot tip: set the OS to each language (or `chrome.i18n`) to grab EN/ES/FR
variants if you want localized listings.

---

## Pre-submission checklist

- [ ] `manifest.json` version bumped for this release
- [ ] ZIP built with `tools/package.sh` (contains `manifest.json` at root)
- [ ] Privacy policy hosted and URL added
- [ ] 128×128 icon + at least one 1280×800 screenshot uploaded
- [ ] Permission justifications pasted
- [ ] Data-usage certifications checked
- [ ] Single-purpose description pasted
