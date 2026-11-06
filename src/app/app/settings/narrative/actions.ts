"use server";
import { revalidatePath } from "next/cache";
import { selectedBusinessId } from "@/app/app/current";
import { setNarrativeWords, type NarrativeWords } from "@/lib/queries/narrative";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";

const clean = (w: string) => w.trim().toLowerCase().replace(/\s+/g, " ");
const validList = (l: unknown): l is string[] =>
  Array.isArray(l) &&
  l.length <= 8 &&
  l.every((w) => typeof w === "string" && clean(w).length >= 2 && clean(w).length <= 40);

// G4 Settings save for the signed-in member's current business. A public endpoint, so the lists are checked
// here like the RPC does (≤8 each, 2-40 characters, none in both); it checks again. Codes only, never text.
export async function saveNarrativeWordsAction(input: NarrativeWords): Promise<{ ok: true } | { error: string }> {
  if (process.env.ENABLE_NARRATIVE !== "true") return { error: "disabled" };
  if (!input || !validList(input.want) || !validList(input.avoid)) return { error: "bad_input" };
  const want = input.want.map(clean);
  const avoid = input.avoid.map(clean);
  if (want.some((w) => avoid.includes(w))) return { error: "bad_input" };
  try {
    const db = await createClient();
    const business = await getCurrentBusiness(db, await selectedBusinessId());
    if (!business) return { error: "no_business" };
    await setNarrativeWords(db, business.id, { want, avoid });
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? String(e.code) : "";
    return { error: code === "42501" ? "not_allowed" : code === "22023" ? "bad_input" : "save_failed" };
  }
  revalidatePath("/app");
  revalidatePath("/app/settings/narrative");
  return { ok: true };
}
