"use server";
import { revalidatePath } from "next/cache";
import { selectedBusinessId } from "@/app/app/current";
import { validMentionDecision, type MentionStatus } from "@/lib/mentions/input";
import { decideMention } from "@/lib/mentions/service";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";

// G7 "Add to fixes" / "Not relevant" / clear for the signed-in member's current business. A public
// endpoint, so the input is checked here too (the RPC checks again: http(s), ≤ 2000 characters).
export async function decideMentionAction(
  url: string,
  status: MentionStatus,
): Promise<{ fixId: string | null } | { error: string }> {
  if (!validMentionDecision(url, status)) return { error: "bad_input" };
  try {
    const db = await createClient();
    const business = await getCurrentBusiness(db, await selectedBusinessId());
    if (!business) return { error: "no_business" };
    const r = await decideMention(db, business.id, url, status);
    if (typeof r === "string") return { error: r };
    revalidatePath("/app/fixes");
    revalidatePath("/app/sources");
    return r;
  } catch {
    // Never the raw message.
    return { error: "save_failed" };
  }
}
