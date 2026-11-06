// Example data for the /dev/app gallery and unit tests: the real fix_rules titles and §5b customer
// copy, filled with invented details for a made-up site. Not real results.
import { fix, type RuleKey } from "@/lib/fixes/types";
import type { DoneView, FixView } from "./FixList";

// Titles as seeded in fix_rules (record_fix_results copies them into fixes.title).
const TITLE: Record<RuleKey, string> = {
  R10: "Crawlable HTML menu on your own site",
  R11: "Dish-level pages / FAQ blocks (signature dishes, dietary tags)",
  R14: "robots.txt allows AI search crawlers",
  R16: "Your site lets AI in, but Cloudflare may be blocking it.",
  R18: "Your homepage needs JavaScript to show its text",
  R19: "Put your keyword in your video titles",
  R20: "Put your keyword in the first two lines of the description",
  R21: "Add chapters on videos 5 minutes or longer",
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
  {
    ...item("f2", "R11", "doing", { dishes: "tonkotsu ramen, vegan miso ramen" }),
    // Who/when (backend #101): the team started it.
    status_changed_at: "2026-11-05T18:00:00Z",
    changed_by: { is_team: true, name: null },
  },
];
// A done fix (listDoneFixes, #101), closed by a member.
export const exampleDone: DoneView[] = [
  {
    id: "d1",
    rule_key: "R14",
    title: "Opening hours in the Business Profile",
    detail: "Your hours now match on Google and your site.",
    status_changed_at: "2026-11-04T19:00:00Z",
    changed_by: { is_team: false, name: "Example Owner" },
  },
];
export const exampleTidyUps: FixView[] = [item("h1", "H1", "todo")];
export const exampleUnchecked = (["R10", "R14"] as const).map((rule_key) => ({ rule_key, title: TITLE[rule_key] }));
