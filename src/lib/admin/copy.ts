// /admin/test strings, exactly as docs/COPY.md "Admin (lead, 2026-11-05)".
export const adminCopy = {
  title: "Engine test",
  engineLabel: "Engine",
  questionLabel: "Question",
  levelLabel: "Location level",
  engines: { chatgpt: "ChatGPT", gemini: "Gemini", google_aio: "Google AI Overview", perplexity: "Perplexity" },
  levels: { country: "Country", state: "State", city: "City" },
  run: "Run test",
  running: "Running…",
  missingKeys: "Missing API keys: {names}. Add them in Vercel to run live tests.",
  status: "Status",
  answer: "Answer",
  citations: "Cited links",
  location: "Location",
  cost: "Cost (USD)",
  exact: "Exact",
  fallback: "Country fallback",
} as const;

export const missingKeysText = (names: readonly string[]) => adminCopy.missingKeys.replace("{names}", names.join(", "));
