import type { AiAccessCheck } from "@/lib/queries/ai-access";

// G2 "Can AI see your site?" (lead OK 2026-11-06). Strings: COPY.md "GAS (lead, 2026-11-06)".
// The search/answer crawlers whose block is a fix: R14's FIX_BOTS (tested equal), copied here so the
// client bundle doesn't pull in the robots.txt reader.
export const SEARCH_BOTS: readonly string[] = ["OAI-SearchBot", "PerplexityBot"];
// The GPTBot-UA request got one of these: the soft edge hint (data-pipeline's BLOCK_STATUSES).
const EDGE_STATUSES = new Set([401, 403, 406, 429, 503]);
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const list = (names: string[]) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export const aiAccessCopy = {
  title: "Can AI see your site?",
  count: (n: number) => `${n} of 6 AI crawlers can read your site`,
  good: "AI can read your site.",
  searchBlocked: (bots: string[]) =>
    `AI search can't read your site: ${list(bots)} ${bots.length === 1 ? "is" : "are"} blocked in robots.txt.`,
  othersOnly: (n: number) =>
    `AI search can read your site. You block ${n} other AI crawler${n === 1 ? "" : "s"}, which is your call.`,
  jsEmpty: "Your homepage shows almost no text without JavaScript, so ChatGPT can't read what you offer.",
  edge: "Your site may be blocking AI crawlers at the edge (for example a Cloudflare bot setting). Check your bot settings.",
  cloudflareTitle: "Your site lets AI in, but Cloudflare may be blocking it.",
  cloudflareHint:
    "Your site runs on Cloudflare. Its AI bot blocking is on by default for many new sites, and robots.txt can't show it. Check Security, then Bots, in your Cloudflare dashboard.",
  unreachable: (domain: string) => `We couldn't reach ${domain}.`,
  unreachableSite: "We couldn't reach your site.",
  jsOff: "With JavaScript off",
  words: (n: number) => `${n} words show`,
  allowed: "Allowed",
  blocked: "Blocked",
  noRule: "No rule",
  crawler: "Crawler",
  access: "Access",
  rule: "robots.txt line",
  checked: (age: string) => `Checked ${age} ago · robots.txt + homepage`,
  explainer: "We read robots.txt and load your homepage the way AI crawlers would.",
  reassure: (age: string) => `AI can read your site · checked ${age} ago`,
};
const c = aiAccessCopy;

export type AiAnswer = { tone: "success" | "info" | "warn" | "error"; line: string; hint: string | null };

export const readableCount = (check: AiAccessCheck) => check.crawlers.filter((x) => x.allowed).length;

// The panel's first line, by outcome (D3, lead Q2: a search bot's block is the error, others are the owner's call).
export function aiAccessAnswer(check: AiAccessCheck): AiAnswer {
  switch (check.outcome) {
    case "good":
      return { tone: "success", line: c.good, hint: null };
    case "blocked": {
      const blocked = check.crawlers.filter((x) => !x.allowed).map((x) => x.agent as string);
      const search = blocked.filter((b) => SEARCH_BOTS.includes(b));
      return search.length
        ? { tone: "error", line: c.searchBlocked(search), hint: null }
        : { tone: "info", line: c.othersOnly(blocked.length), hint: null };
    }
    case "js_empty":
      return { tone: "error", line: c.jsEmpty, hint: null };
    case "cloudflare":
      return check.status_gptbot !== null && EDGE_STATUSES.has(check.status_gptbot)
        ? { tone: "warn", line: c.edge, hint: null }
        : { tone: "warn", line: c.cloudflareTitle, hint: c.cloudflareHint };
    case "unreachable":
      return {
        tone: "error",
        line: check.domain && HOSTNAME.test(check.domain) ? c.unreachable(check.domain) : c.unreachableSite,
        hint: null,
      };
  }
}
