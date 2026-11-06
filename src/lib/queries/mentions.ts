import type { DbClient } from "./client";

// G7 "Lists that name your rivals but not you" (0030). The candidate pages are computed on read from
// stored citations (data-pipeline); only these decisions are stored. "added" feeds the grouped R17 fix.

export type MentionStatus = "added" | "dismissed";
// Who decided is stored but not readable by users (a raw user id; the UI shows only the decision).
export type MentionDecision = { url: string; status: MentionStatus; decided_at: string };

// Members (incl. the dfy_client) and the team on DFY; empty for anyone else. Newest first.
export async function listMentionDecisions(db: DbClient, businessId: string): Promise<MentionDecision[]> {
  const { data, error } = await db
    .from("mention_target_decisions")
    .select("url, status, decided_at")
    .eq("business_id", businessId)
    .order("decided_at", { ascending: false })
    .order("url");
  if (error) throw error;
  return data.map((d) => ({ ...d, status: d.status as MentionStatus }));
}

// "Add to fixes" / "Not relevant", or null to clear. Self-serve members or the team on DFY (never a
// dfy_client). Errors: 22023 a non-http(s) URL over 2000 characters or a bad status, 42501 not allowed.
export async function setMentionTarget(
  db: DbClient,
  businessId: string,
  url: string,
  status: MentionStatus | null,
): Promise<void> {
  const { error } = await db.rpc("set_mention_target", {
    p_business_id: businessId,
    p_url: url,
    p_status: status as string,
  });
  if (error) throw error;
}

// The one grouped "Get on these lists" fix (R17) from the 'added' decisions: updated or created
// with evidence { urls }, or deleted (todo/doing only) when nothing is added (returns null).
// detail = the filled "{n} lists AI cites name {rivals} but not you.". Errors: 22023, 42501.
export async function upsertMentionFix(db: DbClient, businessId: string, detail: string): Promise<string | null> {
  const { data, error } = await db.rpc("upsert_mention_fix", { p_business_id: businessId, p_detail: detail });
  if (error) throw error;
  return data;
}
