import "server-only";
import { mentionTargets, r17Fill, type MentionInput, type MentionTargets } from "@/lib/metrics/mentions";
import type { DbClient } from "@/lib/queries/client";
import { listMentionDecisions, setMentionTarget, upsertMentionFix } from "@/lib/queries/mentions";
import { getRunResults } from "@/lib/queries/results";
import { listRunSummaries } from "@/lib/queries/shell";

// G7 for the Mentions page and its server actions, behind ENABLE_MENTIONS. Everything runs on the
// signed-in user's client, so RLS and can_write_business decide (a dfy_client can read, never decide).
// R17's copy (lead, 2026-11-06): singular for one list, plural verb "cite" otherwise (COPY.md GAS). The grouped fix is upserted at once on every decision (lead O2);
// the weekly fix pass doesn't touch R17 (backend: it would fight the users' decisions).
export const R17_ONE = "1 list AI cites names {rivals} but not you.";
export const R17_MANY = "{n} lists AI cite name {rivals} but not you.";
export const R17_TITLE = "Get on these lists";

type Env = Record<string, string | undefined>;
export const mentionsEnabled = (env: Env = process.env) => env.ENABLE_MENTIONS === "true";

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

async function latest(db: DbClient, businessId: string) {
  const [run] = await listRunSummaries(db, businessId, 1, ["complete", "partial"]);
  return run ? getRunResults(db, run.id) : null;
}

// The page's lists from the latest run, split by the decisions; null before the first run.
export async function loadMentions(
  db: DbClient,
  businessId: string,
  env: Env = process.env,
): Promise<MentionTargets | null | "disabled"> {
  if (!mentionsEnabled(env)) return "disabled";
  const [results, decisions] = await Promise.all([latest(db, businessId), listMentionDecisions(db, businessId)]);
  return results ? mentionTargets(results as unknown as MentionInput, decisions) : null;
}

// "Add to fixes" / "Not relevant" / clear: saves the decision, then rebuilds the one open R17 fix.
// n = every added list; rivals = from the added lists still cited in the latest run (if none are,
// the business's competitors, so the copy stays whole).
export async function decideMention(
  db: DbClient,
  businessId: string,
  url: string,
  status: "added" | "dismissed" | null,
  env: Env = process.env,
): Promise<{ fixId: string | null } | "disabled" | "not_allowed" | "bad_url"> {
  if (!mentionsEnabled(env)) return "disabled";
  try {
    await setMentionTarget(db, businessId, url, status);
    const [results, decisions] = await Promise.all([latest(db, businessId), listMentionDecisions(db, businessId)]);
    const added = decisions.filter((d) => d.status === "added").length;
    const input = results as unknown as MentionInput | null;
    const fill = input ? r17Fill(mentionTargets(input, decisions).added) : null;
    const rivals =
      fill?.rivals ??
      (input?.brands ?? [])
        .filter((b) => b.kind === "competitor")
        .slice(0, 3)
        .map((b) => b.name)
        .join(", ");
    // The RPC needs a detail even when nothing is added (it then deletes the open R17 and ignores it).
    // With no rival name at all, fall back to R17's lead-approved title rather than inventing words.
    const copy = added === 1 ? R17_ONE : R17_MANY;
    const detail = rivals ? copy.replace("{n}", String(added)).replace("{rivals}", rivals) : R17_TITLE;
    return { fixId: await upsertMentionFix(db, businessId, detail) };
  } catch (e) {
    const code = codeOf(e);
    if (code === "42501") return "not_allowed";
    if (code === "22023") return "bad_url";
    throw e;
  }
}
