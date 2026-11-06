import { mentionTargets, r17Fill, type MentionDecision, type MentionInput } from "@/lib/metrics/mentions";
import { fix, ok, unchecked, type FixResult } from "./types";

// R17 "Get on these lists" (G7, one grouped fix): the pages a member or the team added from the
// mentions list, still cited this run. Evidence = their URLs. Nothing added = ok.
export function checkLists(results: MentionInput | null, decisions: MentionDecision[]): FixResult {
  if (!results) return unchecked("R17", "no_results");
  const { added } = mentionTargets(results, decisions);
  const fill = r17Fill(added);
  const evidence = { urls: added.map((t) => t.url) };
  return fill ? fix("R17", evidence, fill) : ok("R17", evidence);
}
