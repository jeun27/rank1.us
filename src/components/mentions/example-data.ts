// G7 on Example data: invented list pages and rivals, no real sites.
import type { MentionTarget, MentionTargets } from "@/lib/metrics/mentions";

const t = (
  path: string,
  title: string | null,
  rivals: string[],
  answers: number,
  over: Partial<MentionTarget> = {},
): MentionTarget => ({
  url: `https://lists.example.test/${path}`,
  domain: "lists.example.test",
  title,
  category: "News & blogs",
  rivals,
  answers,
  engines: ["chatgpt", "perplexity"],
  ...over,
});

export const exampleMentions: MentionTargets = {
  n: 240,
  candidates: [
    t(
      "best-ramen-irvine",
      "The 12 best ramen shops in Irvine",
      ["Example Noodle Bar", "Example Izakaya", "Example Udon Spot", "Example Pho Spot"],
      18,
    ),
    t("late-night-diamond-jamboree", "Where to eat late at Diamond Jamboree", ["Example Izakaya"], 7, {
      engines: ["gemini"],
    }),
    t("vegan-ramen", null, ["Example Noodle Bar", "Example Tonkotsu Co."], 4, {
      domain: "guide.example.test",
      url: "https://guide.example.test/vegan-ramen",
      category: "Review sites",
    }),
  ],
  added: [t("oc-noodle-guide", "The OC noodle guide", ["Example Noodle Bar", "Example Izakaya"], 11)],
  dismissed: [t("chain-roundup", "Chain restaurants near you", ["Example Pho Spot"], 2)],
};
export const exampleMentionsNone: MentionTargets = { n: 240, candidates: [], added: [], dismissed: [] };
