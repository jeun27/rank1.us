import "server-only";
import { loadNarrative, type NarrativeView } from "@/lib/narrative/service";
import type { DbClient } from "@/lib/queries/client";
import { getNarrativeWords } from "@/lib/queries/narrative";

type Env = Record<string, string | undefined>;

// #144 S1: the Dashboard reads the cheap word lists first. Answers load (loadNarrative) only with
// ENABLE_NARRATIVE on and at least one word saved; no words gives the quiet line's view without them.
export async function loadDashboardNarrative(
  db: DbClient,
  businessId: string,
  env: Env = process.env,
): Promise<NarrativeView | null> {
  if (env.ENABLE_NARRATIVE !== "true") return null;
  const words = await getNarrativeWords(db, businessId);
  if (!words) return null;
  if (!words.want.length && !words.avoid.length) return { words, checkedAt: null, result: null };
  const view = await loadNarrative(db, businessId, env);
  return view && view !== "disabled" ? view : null;
}
