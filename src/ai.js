// Thin wrapper over Chrome's built-in, on-device AI.
// Strategy: Prompt API (targeted extraction) → Summarizer API → raw-text fallback.
// Everything runs locally; no text ever leaves the browser.

const LANG_NAMES = { en: "English", es: "Spanish", fr: "French" };
const SUPPORTED = ["en", "es", "fr"];
const MAX_INPUT = 12000; // chars fed to the model

function resolveLang(lang) {
  return SUPPORTED.includes(lang) ? lang : "en";
}

function getLanguageModel() {
  // Global `LanguageModel` (Chrome 138+) or legacy `ai.languageModel`.
  return globalThis.LanguageModel || globalThis.ai?.languageModel || null;
}

function getSummarizer() {
  return globalThis.Summarizer || globalThis.ai?.summarizer || null;
}

// Normalizes availability across API generations to: 'ready' | 'downloadable' | 'no'.
async function availabilityOf(api) {
  try {
    if (typeof api.availability === "function") {
      const v = await api.availability();
      if (v === "available") return "ready";
      if (v === "downloadable" || v === "downloading") return "downloadable";
      return "no";
    }
    if (typeof api.capabilities === "function") {
      const caps = await api.capabilities();
      if (caps?.available === "readily") return "ready";
      if (caps?.available === "after-download") return "downloadable";
      return "no";
    }
  } catch (e) { /* treat as unavailable */ }
  return "no";
}

function downloadMonitor(onStatus) {
  return (m) => {
    m.addEventListener?.("downloadprogress", (e) => {
      const pct = typeof e.loaded === "number" ? Math.round(e.loaded * 100) : 0;
      onStatus?.({ phase: "downloading", progress: pct });
    });
  };
}

// Create a Prompt API session that ALWAYS attests a supported output language
// ([de,en,es,fr,ja]; ours — en/es/fr — are all supported). Chrome warns ("No
// output language was specified…") and degrades quality otherwise, and builds
// disagree on the field name — some read `outputLanguage`, others
// `expectedOutputs`. Unknown dictionary members are ignored (not thrown), so we
// pass BOTH in one call; the honored one attests, the other is harmless. We
// never fall back to a language-less create.
async function createPromptSession(LM, system, language, avail, onStatus) {
  const base = { initialPrompts: [{ role: "system", content: system }] };
  if (avail === "downloadable") base.monitor = downloadMonitor(onStatus);

  const outputs = [{ type: "text", languages: [language] }];
  const inputs = [{ type: "text", languages: [...SUPPORTED] }];
  const variants = [
    { ...base, outputLanguage: language, expectedOutputs: outputs, expectedInputs: inputs },
    { ...base, outputLanguage: language, expectedOutputs: outputs },
    { ...base, outputLanguage: language },
    { ...base, expectedOutputs: outputs },
  ];

  for (const opts of variants) {
    try {
      return await LM.create(opts);
    } catch (e) {
      /* try next shape */
    }
  }
  return null;
}

// Run a single system+user prompt through the Prompt API. Returns trimmed
// text, or null if the API is unavailable / yields nothing.
async function runPrompt(system, user, language, onStatus) {
  const LM = getLanguageModel();
  if (!LM) return null;
  const avail = await availabilityOf(LM);
  if (avail === "no") return null;

  const session = await createPromptSession(LM, system, language, avail, onStatus);
  if (!session) return null;

  onStatus?.({ phase: "summarizing" });
  let out;
  try {
    // Also attest the output language at request time — some builds check here.
    try {
      out = await session.prompt(user, { outputLanguage: language });
    } catch (e) {
      out = await session.prompt(user);
    }
  } finally {
    session.destroy?.();
  }
  const clean = (out || "").trim();
  return clean || null;
}

async function tryPromptApi(text, language, onStatus) {
  const langName = LANG_NAMES[language];
  const system =
    "You summarize an online store's return and refund policy for a shopper. " +
    "The text below was reached from the store's own returns/refunds link, so treat it as a return policy. " +
    "Produce a short, scannable summary. " +
    "Cover, only when present in the text: the return window (number of days), " +
    "item condition requirements, how refunds are issued and how long they take, " +
    "who pays for return shipping, exchanges, and any exclusions or non-returnable items. " +
    "Use at most 6 short bullet points, each starting with '- '. " +
    "Do not invent details that are not in the text. " +
    `Respond in ${langName}.`;

  const clean = await runPrompt(system, `Return/refund policy text:\n\n${text}`, language, onStatus);
  return clean ? { summary: clean, engine: "prompt" } : null;
}

async function trySummarizerApi(text, language, onStatus) {
  const SM = getSummarizer();
  if (!SM) return null;
  const avail = await availabilityOf(SM);
  if (avail === "no") return null;

  const opts = {
    type: "key-points",
    format: "markdown",
    length: "medium",
    sharedContext: "An online store's return and refund policy.",
    outputLanguage: language,
  };
  if (avail === "downloadable") opts.monitor = downloadMonitor(onStatus);

  let summarizer;
  try {
    summarizer = await SM.create(opts);
  } catch (e) {
    // Retry without the language hint if unsupported.
    delete opts.outputLanguage;
    summarizer = await SM.create(opts);
  }

  onStatus?.({ phase: "summarizing" });
  let out;
  try {
    out = await summarizer.summarize(text, {
      context: "Summarize the return window, refund method, who pays return shipping, and any exclusions.",
    });
  } finally {
    summarizer.destroy?.();
  }

  const clean = (out || "").trim();
  return clean ? { summary: clean, engine: "summarizer" } : null;
}

/**
 * Summarize return-policy text on-device.
 * Returns one of:
 *   { source: 'ai', summary, engine }
 *   { source: 'ai', noPolicy: true, engine }
 *   { source: 'raw' }   // AI unavailable/failed — caller shows raw text
 */
export async function summarizePolicy(rawText, lang, onStatus) {
  const language = resolveLang(lang);
  const text = (rawText || "").slice(0, MAX_INPUT);

  try {
    const p = await tryPromptApi(text, language, onStatus);
    if (p?.summary) return { source: "ai", ...p };
  } catch (e) { /* fall through to summarizer */ }

  try {
    const s = await trySummarizerApi(text, language, onStatus);
    if (s?.summary) return { source: "ai", ...s };
  } catch (e) { /* fall through to raw */ }

  return { source: "raw" };
}

export function aiMaybeAvailable() {
  return Boolean(getLanguageModel() || getSummarizer());
}

/**
 * Summarize what customers say about a store's returns/refunds, from review
 * text. Returns { source: 'ai', summary } or { source: 'raw' } when on-device
 * AI is unavailable (caller then shows sample reviews verbatim).
 */
export async function summarizeReturnComplaints(reviewsText, lang, onStatus) {
  const language = resolveLang(lang);
  const langName = LANG_NAMES[language];
  const text = (reviewsText || "").slice(0, MAX_INPUT);

  const system =
    "You analyze customer reviews about an online store's returns and refunds. " +
    "Summarize the return/refund experience customers describe: the main complaints, " +
    "roughly how common each theme is, and any positives. Be balanced and specific, " +
    "and don't overstate — these are self-selected reviews, not a full picture. " +
    "Use at most 5 short bullet points, each starting with '- '. " +
    "Do not invent details that are not in the reviews. " +
    `Respond in ${langName}.`;

  try {
    const clean = await runPrompt(system, `Customer reviews:\n\n${text}`, language, onStatus);
    if (clean) return { source: "ai", summary: clean };
  } catch (e) { /* fall through to raw */ }

  return { source: "raw" };
}
