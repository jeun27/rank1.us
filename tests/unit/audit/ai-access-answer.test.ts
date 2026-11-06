import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aiAccessAnswer, aiAccessCopy as c, readableCount, SEARCH_BOTS } from "@/components/audit/ai-access";
import { FIX_BOTS } from "@/lib/fixes/r14-robots";
import { AI_CRAWLERS, type AiAccessCheck } from "@/lib/queries/ai-access";

// G2 (lead OK 2026-11-06, D3 + Q2): the panel's answer line by outcome. A block of an R14 bot
// (OAI-SearchBot, PerplexityBot) is the error; blocking only other crawlers is the owner's call.
const crawlers = (blocked: string[] = []) =>
  AI_CRAWLERS.map((agent) => ({
    agent,
    allowed: !blocked.includes(agent),
    line: blocked.includes(agent) ? `Disallow: /` : null,
  }));
const check = (over: Partial<AiAccessCheck> = {}): AiAccessCheck => ({
  run_id: "r1",
  business_id: null,
  domain: "exampleramen.test",
  checked_at: "2026-11-06T10:00:00Z",
  outcome: "good",
  crawlers: crawlers(),
  visible_words: 420,
  status_normal: 200,
  status_gptbot: 200,
  cloudflare: false,
  pages_checked: 1,
  error: null,
  ...over,
});

describe("aiAccessAnswer", () => {
  it("the search bots are exactly R14's", () => expect(SEARCH_BOTS).toEqual(FIX_BOTS));

  it("good", () => {
    expect(aiAccessAnswer(check())).toEqual({ tone: "success", line: "AI can read your site.", hint: null });
  });

  it("a search bot blocked: the error, naming the bots", () => {
    const one = check({ outcome: "blocked", crawlers: crawlers(["PerplexityBot", "GPTBot"]) });
    expect(aiAccessAnswer(one)).toEqual({
      tone: "error",
      line: "AI search can't read your site: PerplexityBot is blocked in robots.txt.",
      hint: null,
    });
    const two = check({ outcome: "blocked", crawlers: crawlers(["OAI-SearchBot", "PerplexityBot"]) });
    expect(aiAccessAnswer(two).line).toBe(
      "AI search can't read your site: OAI-SearchBot and PerplexityBot are blocked in robots.txt.",
    );
  });

  it("only other crawlers blocked: info, the owner's call", () => {
    expect(aiAccessAnswer(check({ outcome: "blocked", crawlers: crawlers(["GPTBot", "Google-Extended"]) }))).toEqual({
      tone: "info",
      line: "AI search can read your site. You block 2 training crawlers, which is your call.",
      hint: null,
    });
    expect(aiAccessAnswer(check({ outcome: "blocked", crawlers: crawlers(["GPTBot"]) })).line).toBe(
      "AI search can read your site. You block 1 training crawler, which is your call.",
    );
  });

  it("js_empty: the R18 copy", () => {
    expect(aiAccessAnswer(check({ outcome: "js_empty", visible_words: 12 }))).toEqual({
      tone: "error",
      line: "Your homepage shows almost no text without JavaScript, so ChatGPT can't read what you offer.",
      hint: null,
    });
  });

  it("cloudflare with the GPTBot request blocked: the edge hint, never 'blocked'", () => {
    const a = aiAccessAnswer(check({ outcome: "cloudflare", cloudflare: true, status_gptbot: 403 }));
    expect(a.tone).toBe("warn");
    expect(a.line).toBe(c.edge);
    expect(a.line).toContain("may be blocking");
  });

  it("cloudflare otherwise: the R16 title, with its customer copy as the hint", () => {
    expect(aiAccessAnswer(check({ outcome: "cloudflare", cloudflare: true }))).toEqual({
      tone: "warn",
      line: "Your site lets AI in, but Cloudflare may be blocking it.",
      hint: c.cloudflareHint,
    });
  });

  it("unreachable: the domain only when it's a hostname (it can be raw input)", () => {
    const u = (domain: string | null) =>
      aiAccessAnswer(check({ outcome: "unreachable", domain, crawlers: [], visible_words: null })).line;
    expect(u("exampleramen.test")).toBe("We couldn't reach exampleramen.test.");
    expect(u("not a domain <b>")).toBe("We couldn't reach your site.");
    expect(u(null)).toBe("We couldn't reach your site.");
  });

  it("counts the readable crawlers out of 6", () => {
    expect(readableCount(check({ crawlers: crawlers(["GPTBot", "ClaudeBot"]) }))).toBe(4);
    expect(c.count(4)).toBe("4 of 6 AI crawlers can read your site");
  });
});

describe("copy", () => {
  it("every G2 string is in COPY.md", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [
      c.title,
      c.good,
      c.jsOff,
      c.allowed,
      c.blocked,
      c.noRule,
      c.explainer,
      c.edge,
      c.cloudflareTitle,
      c.cloudflareHint,
      c.jsEmpty,
      c.unreachableSite,
      c.crawler,
      c.access,
      c.rule,
    ])
      expect(copy, s).toContain(`"${s}"`);
    for (const s of [
      '"{n} of 6 AI crawlers can read your site"',
      '"AI search can\'t read your site: {bots} {is/are} blocked in robots.txt."',
      '"AI search can read your site. You block {n} training crawlers, which is your call."',
      '"{n} words show"',
      '"We couldn\'t reach {domain}."',
      '"Checked {age} ago · robots.txt + homepage"',
      '"AI can read your site · checked {age} ago"',
    ])
      expect(copy, s).toContain(s);
  });
});
