import "server-only";
import {
  mentionTargets,
  r17Fill,
  type MentionInput,
  type MentionTarget,
  type MentionTargets,
} from "@/lib/metrics/mentions";
import type { DbClient } from "@/lib/queries/client";
import { listMentionDecisions, setMentionTarget, upsertMentionFix } from "@/lib/queries/mentions";
import { getRunResults } from "@/lib/queries/results";
import { normalizeUrl } from "@/lib/runs/citations";
import { listRunSummaries } from "@/lib/queries/shell";

// G7 for the Mentions page and its server actions, behind ENABLE_MENTIONS. Everything runs on the
// signed-in user's client, so RLS and can_write_business decide (a dfy_client can read, never decide).
// R17's copy (lead, 2026-11-06): singular for one list, plural verb "cite" otherwise (COPY.md GAS). The grouped fix is upserted at once on every decision (lead O2);
// the weekly fix pass doesn't touch R17 (backend: it would fight the users' decisions).
export const R17_ONE = "1 list AI cites names {rivals} but not you.";
export const R17_MANY = "{n} lists AI cite name {rivals} but not you.";
// When no rival is known for any added list (lead, #131 S1): no names, never the competitor list.
export const R17_ONE_NO_NAMES = "1 list AI cites doesn't name you.";
export const R17_MANY_NO_NAMES = "{n} lists AI cite don't name you.";
// How far back an added list's rivals are looked up when it isn't in the latest run.
const HISTORY_RUNS = 8;

type Env = Record<string, string | undefined>;
export const mentionsEnabled = (env: Env = process.env) => env.ENABLE_MENTIONS === "true";

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

// The page's view, read once per render (review of #131): the latest run's lists split by the
// decisions, every added URL, and each added list's last known version (its rivals) from the newest of
// up to HISTORY_RUNS runs that still cites it. A decision then needs no reads.
export type MentionsView = MentionTargets & { addedUrls: string[]; known: MentionTarget[] };

export async function loadMentions(
  db: DbClient,
  businessId: string,
  env: Env = process.env,
): Promise<MentionsView | null | "disabled"> {
  if (!mentionsEnabled(env)) return "disabled";
  const [runs, decisions] = await Promise.all([
    listRunSummaries(db, businessId, HISTORY_RUNS, ["complete", "partial"]),
    listMentionDecisions(db, businessId),
  ]);
  if (!runs.length) return null;
  const latest = await getRunResults(db, runs[0].id);
  if (!latest) return null;
  const view = mentionTargets(latest as unknown as MentionInput, decisions);
  const addedUrls = decisions.filter((d) => d.status === "added").map((d) => normalizeUrl(d.url));
  const known = new Map<string, MentionTarget>(
    [...view.candidates, ...view.added, ...view.dismissed].map((t) => [t.url, t]),
  );
  for (const run of runs.slice(1)) {
    if (addedUrls.every((u) => known.has(u))) break;
    const results = await getRunResults(db, run.id);
    if (!results) continue;
    for (const t of mentionTargets(results as unknown as MentionInput, decisions).added)
      if (!known.has(t.url)) known.set(t.url, t);
  }
  return { ...view, addedUrls, known: [...known.values()] };
}

const fillDetail = (n: number, known: MentionTarget[]) => {
  const fill = r17Fill(known);
  if (!fill) return (n === 1 ? R17_ONE_NO_NAMES : R17_MANY_NO_NAMES).replace("{n}", String(n));
  return (n === 1 ? R17_ONE : R17_MANY).replace("{n}", String(n)).replace("{rivals}", fill.rivals);
};

// "Add to fixes" / "Not relevant" / clear, from the page's loaded view: saves the decision, then rebuilds
// the one open R17 fix. Two writes, no reads. n = every added list; rivals = only from the added lists'
// own stored evidence (lead, #131 S1). Errors keep their real cause (S2); the UI shows its generic
// failure copy for rule_unavailable/bad_detail. The caller revalidates the page after.
export async function decideMention(
  db: DbClient,
  businessId: string,
  url: string,
  status: "added" | "dismissed" | null,
  view: MentionsView,
  env: Env = process.env,
): Promise<{ fixId: string | null } | "disabled" | "not_allowed" | "bad_url" | "rule_unavailable" | "bad_detail"> {
  if (!mentionsEnabled(env)) return "disabled";
  try {
    await setMentionTarget(db, businessId, url, status);
  } catch (e) {
    if (codeOf(e) === "42501") return "not_allowed";
    if (codeOf(e) === "22023") return "bad_url";
    throw e;
  }
  const key = normalizeUrl(url);
  const added = new Set(view.addedUrls);
  if (status === "added") added.add(key);
  else added.delete(key);
  const known = view.known.filter((t) => added.has(t.url));
  // The RPC needs a detail even when nothing is added (it then deletes the open R17 and ignores it).
  try {
    return { fixId: await upsertMentionFix(db, businessId, fillDetail(Math.max(added.size, 1), known)) };
  } catch (e) {
    if (codeOf(e) === "42501") return "not_allowed";
    if (codeOf(e) === "22023")
      return /mention_rule_unavailable/.test(String((e as Error).message)) ? "rule_unavailable" : "bad_detail";
    throw e;
  }
}
