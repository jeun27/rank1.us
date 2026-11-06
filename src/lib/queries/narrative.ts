import type { Json } from "@/types/db";
import type { DbClient } from "./client";

// G4 narrative (0028): the words a business wants AI to use about it (and to avoid), and one stored
// word-match result per run. No LLM: matching is word matching on stored answer text.

export const NARRATIVE_MAX_WORDS = 20;
export const NARRATIVE_SNIPPET_MAX = 400;

export type NarrativeWords = { want: string[]; avoid: string[] };

// Members (incl. the dfy_client) and the team on DFY; null for anyone else.
export async function getNarrativeWords(db: DbClient, businessId: string): Promise<NarrativeWords | null> {
  const { data, error } = await db
    .from("businesses")
    .select("narrative_want, narrative_avoid")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw error;
  return data ? { want: data.narrative_want, avoid: data.narrative_avoid } : null;
}

// Self-serve members or the team on DFY (never a dfy_client). Words are trimmed, lowercased and
// deduped. Errors: 22023 over 20 words, a word under 2 or over 40 characters, or in both lists; 42501.
export async function setNarrativeWords(db: DbClient, businessId: string, words: NarrativeWords): Promise<void> {
  const { error } = await db.rpc("set_narrative_words", {
    p_business_id: businessId,
    p_want: words.want,
    p_avoid: words.avoid,
  });
  if (error) throw error;
}

export type WordCount = { word: string; count: number };

export type NarrativeResult = {
  run_id: string;
  business_id: string | null;
  checked_at: string;
  want: WordCount[];
  avoid: WordCount[];
  // Answers that name the business (the denominator for every count).
  n: number;
  // ≤ 400 characters of one stored answer, around snippet_word. Labelled as a word match in the UI.
  snippet: string | null;
  snippet_word: string | null;
};

// The business's newest result, or null (members incl. the dfy_client, the team on DFY).
export async function getLatestNarrativeResult(db: DbClient, businessId: string): Promise<NarrativeResult | null> {
  const { data, error } = await db
    .from("narrative_results")
    .select("run_id, business_id, checked_at, want, avoid, n, snippet, snippet_word")
    .eq("business_id", businessId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as NarrativeResult | null;
}

export type NarrativeResultInput = {
  want: WordCount[];
  avoid: WordCount[];
  n: number;
  snippet: string | null;
  snippetWord: string | null;
};

// Service client only. Stores (or replaces) a run's match. The DB refuses (22023) words not in the
// business's lists, counts over n, and a snippet over 400 characters, not in the run's stored answer
// text, or without its word.
export async function recordNarrativeResult(
  serviceDb: DbClient,
  runId: string,
  r: NarrativeResultInput,
): Promise<void> {
  const { error } = await serviceDb.rpc("record_narrative_result", {
    p_run_id: runId,
    p: { want: r.want, avoid: r.avoid, n: r.n, snippet: r.snippet, snippet_word: r.snippetWord } as unknown as Json,
  });
  if (error) throw error;
}
