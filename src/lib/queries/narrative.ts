import type { DbClient } from "./client";

// G4 narrative (0028): the words a business wants AI to use about it, and to avoid. The match is
// computed on read from the latest run's stored answer text (data-pipeline; no LLM, nothing stored).

export const NARRATIVE_MAX_WORDS = 8;

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
// deduped. Errors: 22023 over 8 words, a word under 2 or over 40 characters, or in both lists; 42501.
export async function setNarrativeWords(db: DbClient, businessId: string, words: NarrativeWords): Promise<void> {
  const { error } = await db.rpc("set_narrative_words", {
    p_business_id: businessId,
    p_want: words.want,
    p_avoid: words.avoid,
  });
  if (error) throw error;
}
