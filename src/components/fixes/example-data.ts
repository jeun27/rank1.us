// Example data for the /dev/app gallery and unit tests: the real fix_rules titles and §5b customer
// copy, filled with invented details for a made-up site. Not real results.
import { fix, type RuleKey } from "@/lib/fixes/types";
import type { FixView } from "./FixList";

// Titles as seeded in fix_rules (record_fix_results copies them into fixes.title).
const TITLE: Record<RuleKey, string> = {
  R10: "Crawlable HTML menu on your own site",
  R11: "Dish-level pages / FAQ blocks (signature dishes, dietary tags)",
  R14: "robots.txt allows AI search crawlers",
  H1: "Restaurant/Menu schema (hygiene only)",
};

const item = (id: string, key: RuleKey, status: FixView["status"], fill: Record<string, string> = {}): FixView => ({
  id,
  rule_key: key,
  title: TITLE[key],
  detail: fix(key, {}, fill).detail,
  affected_answers: null,
  status,
});

// Smallest effort first, as listFixes ranks them: R14 (S), R10 (M-L), R11 (L).
export const exampleFixes: FixView[] = [
  item("f3", "R14", "todo", { bots: "OAI-SearchBot", paths: "/menu" }),
  item("f1", "R10", "todo", { "PDF/image": "PDF" }),
  item("f2", "R11", "doing", { dishes: "tonkotsu ramen, vegan miso ramen" }),
];
export const exampleTidyUps: FixView[] = [item("h1", "H1", "todo")];
export const exampleUnchecked = (["R10", "R14"] as const).map((rule_key) => ({ rule_key, title: TITLE[rule_key] }));
