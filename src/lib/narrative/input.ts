import type { NarrativeWords } from "@/lib/queries/narrative";

// The server actions' check of the word lists, like the RPC (0028), which checks again: up to 8 each,
// 2-40 characters after trimming and lowercasing, none in both lists. null = bad input.
const clean = (w: string) => w.trim().toLowerCase().replace(/\s+/g, " ");
const validList = (l: unknown): l is string[] =>
  Array.isArray(l) &&
  l.length <= 8 &&
  l.every((w) => typeof w === "string" && clean(w).length >= 2 && clean(w).length <= 40);

export function parseNarrativeWords(input: unknown): NarrativeWords | null {
  const i = input as Partial<NarrativeWords> | null;
  if (!i || !validList(i.want) || !validList(i.avoid)) return null;
  const want = i.want.map(clean);
  const avoid = i.avoid.map(clean);
  return want.some((w) => avoid.includes(w)) ? null : { want, avoid };
}

// The RPC's error codes as the actions' codes, never the raw message.
export function narrativeErrorCode(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String(e.code) : "";
  return code === "42501" ? "not_allowed" : code === "22023" ? "bad_input" : "save_failed";
}
