"use server";
import { revalidatePath } from "next/cache";
import { selectedBusinessId } from "@/app/app/current";
import { narrativeErrorCode, parseNarrativeWords } from "@/lib/narrative/input";
import { setNarrativeWords, type NarrativeWords } from "@/lib/queries/narrative";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";

// G4 Settings save for the signed-in member's current business. A public endpoint, so the lists are checked
// here like the RPC does (≤8 each, 2-40 characters, none in both); it checks again. Codes only, never text.
export async function saveNarrativeWordsAction(input: NarrativeWords): Promise<{ ok: true } | { error: string }> {
  if (process.env.ENABLE_NARRATIVE !== "true") return { error: "disabled" };
  const words = parseNarrativeWords(input);
  if (!words) return { error: "bad_input" };
  try {
    const db = await createClient();
    const business = await getCurrentBusiness(db, await selectedBusinessId());
    if (!business) return { error: "no_business" };
    await setNarrativeWords(db, business.id, words);
  } catch (e) {
    return { error: narrativeErrorCode(e) };
  }
  revalidatePath("/app");
  revalidatePath("/app/settings/narrative");
  return { ok: true };
}
