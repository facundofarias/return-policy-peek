# Privacy Policy — Return Policy Peek

_Last updated: 8 July 2026_

Return Policy Peek is built to be private by default. This policy explains,
plainly, what the extension does and does not do with your data.

## The short version

- **We do not collect, store, or transmit any personal data.**
- **There is no backend server** operated by us and **no analytics or tracking.**
- **Summarization happens entirely on your device** using Chrome's built-in AI
  (Gemini Nano). The text of a policy is never sent to us or any third party for
  summarization.

## What the extension accesses

When you click the extension's icon on a store page, it:

1. Reads the content of the **current tab** (via the `activeTab` permission) to
   detect that it's a store and to find the store's return/refund policy link.
2. Fetches that store's **own return-policy page** so it can be read and
   summarized on your device.

These actions happen only when you open the extension, and the data is used only
to produce the summary shown to you. Nothing is retained beyond an in-memory
cache (see below).

## The optional "Check reviews on returns" action

This feature is **strictly opt-in** — it runs only if you click the
"Check reviews on returns" button. When you do, the extension opens the store's
**public Trustpilot page** in a background tab, reads the publicly displayed
reviews, and summarizes the ones about returns/refunds **on your device**. This
is the only request the extension can make to a third party, and it never
happens automatically. No information about you is sent to Trustpilot beyond a
normal, anonymous page request.

## Caching

To avoid repeating work, summaries and fetched reviews are cached **in memory**
using `chrome.storage.session`. This cache lives only in your browser, is never
transmitted anywhere, and is cleared automatically when you close the browser.

## Data sharing and sale

We do not sell, rent, or share any data, because we do not collect any.

## Permissions, briefly

- `activeTab`, `scripting` — read the page you're on to find and read its return
  policy (and, on request, read the public Trustpilot page).
- `storage` — the in-memory session cache described above.
- Host access (`http`/`https`) — fetch the store's return-policy page and, on
  request, its public Trustpilot page.

## Contact

Questions? Visit [Rumbo Labs](https://rumbolabs.net/) or open an issue on the
project's GitHub repository.
