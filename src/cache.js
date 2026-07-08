// Lightweight in-memory cache for policy summaries, keyed by URL.
// Uses chrome.storage.session so it clears when the browser closes and never
// touches disk. Skips the fetch + on-device summarization on repeat clicks of
// the same page (or another page of the same store sharing one policy URL).

const NS = "rpp:cache:v1";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_ENTRIES = 50;

async function readAll() {
  try {
    const bag = await chrome.storage.session.get(NS);
    return bag[NS] || {};
  } catch (e) {
    return {};
  }
}

export async function getCached(key) {
  if (!key) return null;
  const all = await readAll();
  const entry = all[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) return null;
  return entry;
}

export async function setCached(key, value) {
  if (!key) return;
  try {
    const all = await readAll();
    all[key] = { ...value, ts: Date.now() };

    const keys = Object.keys(all);
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => all[a].ts - all[b].ts); // oldest first
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete all[k];
    }
    await chrome.storage.session.set({ [NS]: all });
  } catch (e) {
    /* cache is best-effort */
  }
}
