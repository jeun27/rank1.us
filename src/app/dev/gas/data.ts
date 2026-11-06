// Example data for the GAS prototypes: invented businesses, domains and answers. Not real results.

export const BUSINESS = {
  name: "Example Ramen House",
  city: "Irvine, CA",
  domain: "example-ramen.test",
};

export type PillarKey = "P0" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

// Labels from the GAS brief. `short` is the tag text; `why` is one plain line for the group header.
export const PILLARS: Record<PillarKey, { label: string; short: string; why: string }> = {
  P0: { label: "Know where you stand", short: "Baseline", why: "Your score, your rivals and the gaps between you." },
  P1: { label: "Prompts & keywords", short: "Prompts", why: "The questions people ask AI about places like yours." },
  P2: { label: "Content (freshness)", short: "Content", why: "Your own pages: current, clear and easy to quote." },
  P3: { label: "Brand mentions", short: "Mentions", why: "Other sites, lists and reviews that name you." },
  P4: { label: "YouTube & video", short: "Video", why: "Videos AI can find and quote." },
  P5: { label: "Technical access", short: "Access", why: "Whether AI can open and read your site at all." },
  P6: { label: "Measure & prove", short: "Measure", why: "Showing the visits and money AI sends you." },
};

// Q1 (recommended): blockers first. The alternative is plain P0 → P6.
export const ORDER_BLOCKERS: PillarKey[] = ["P5", "P3", "P2", "P1", "P4", "P6", "P0"];
export const ORDER_PLAIN: PillarKey[] = ["P0", "P1", "P2", "P3", "P4", "P5", "P6"];

export type Fix = {
  id: string;
  pillar: PillarKey;
  title: string;
  detail: string;
  affected: number | null;
  status: "todo" | "doing" | "done";
  // DFY fixes the team can apply for the client (always diff → confirm → apply → change log).
  edit?: { where: string; before: string; after: string };
  unchecked?: boolean;
};

export const FIXES: Fix[] = [
  {
    id: "f1",
    pillar: "P5",
    title: "robots.txt allows AI search crawlers",
    detail:
      "Your robots.txt blocks OAI-SearchBot and ClaudeBot from /menu, so ChatGPT search and Claude can't read your menu.",
    affected: 14,
    status: "todo",
    edit: {
      where: "robots.txt",
      before: "User-agent: OAI-SearchBot\nDisallow: /menu\n\nUser-agent: ClaudeBot\nDisallow: /menu",
      after: "User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /",
    },
  },
  {
    id: "f2",
    pillar: "P5",
    title: "Menu readable without JavaScript",
    detail:
      "Your menu page is empty when JavaScript is off. ChatGPT's crawler doesn't run JavaScript, so it sees no dishes.",
    affected: 9,
    status: "doing",
  },
  {
    id: "f3",
    pillar: "P3",
    title: 'Get on "Best ramen in Irvine" lists',
    detail: "3 lists AI cites name Example Noodle Bar and Example Tonkotsu Co. but not you.",
    affected: 11,
    status: "todo",
  },
  {
    id: "f4",
    pillar: "P3",
    title: "Business Profile description says what you are",
    detail: "Your Business Profile description doesn't mention tonkotsu, vegan ramen or Diamond Jamboree.",
    affected: 6,
    status: "todo",
    edit: {
      where: "Google Business Profile: description",
      before: "Welcome to our restaurant! Come try our food.",
      after:
        "Handmade tonkotsu and vegan miso ramen at Diamond Jamboree, Irvine. Broth simmered 18 hours. Open late Friday and Saturday.",
    },
  },
  {
    id: "f5",
    pillar: "P2",
    title: "Refresh the menu page",
    detail: "Your menu page was last changed 7 months ago. Add this season's dishes and current prices.",
    affected: 8,
    status: "todo",
  },
  {
    id: "f6",
    pillar: "P2",
    title: "Dish-level pages / FAQ blocks (signature dishes, dietary tags)",
    detail: "Add a short section for tonkotsu ramen and vegan miso ramen, each opening with the answer.",
    affected: 5,
    status: "done",
  },
  {
    id: "f7",
    pillar: "P1",
    title: 'Track "late-night ramen near Diamond Jamboree"',
    detail: "People ask AI about late-night ramen near you. You're open until 1 am but don't track this question.",
    affected: null,
    status: "todo",
  },
  {
    id: "f8",
    pillar: "P4",
    title: "Put the keyword in your top video's title",
    detail:
      '"Our story" is your most-watched video. A title like "Tonkotsu ramen in Irvine: how we make our broth" can be found.',
    affected: null,
    status: "todo",
  },
  {
    id: "f9",
    pillar: "P6",
    title: "Add an AI traffic channel in GA4",
    detail: "Group visits from ChatGPT, Perplexity, Gemini, Copilot and Claude so the monthly report can show them.",
    affected: null,
    status: "todo",
  },
];

export const RIVALS = ["Example Noodle Bar", "Example Tonkotsu Co.", "Example Udon Spot"];
