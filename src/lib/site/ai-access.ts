import "server-only";
import { pageText, robotsDecision, siteHost, USER_AGENT } from "@/lib/onboarding/read-site";
import { AI_CRAWLERS, type AiAccessInput, type AiAccessOutcome, type CrawlerResult } from "@/lib/queries/ai-access";
import { guardedGet, type GuardOptions } from "./guarded-get";

// G2 "Can AI see your site?": robots.txt for the 6 AI crawlers, the page as it reads with JavaScript off,
// the same page requested as GPTBot, and a Cloudflare hint. Three requests at most, all through the guard.
// It reads public pages only and stores outcomes and counts, never page text.

export const aiAccessEnabled = (env: Record<string, string | undefined> = process.env) =>
  env.ENABLE_AI_ACCESS_CHECK === "true";

// OpenAI's published GPTBot user agent (https://platform.openai.com/docs/bots).
export const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)";
// Fewer visible words than this with JavaScript off = the page is empty to AI crawlers (they don't run JS).
export const JS_EMPTY_WORDS = 50;
// Statuses a bot gets from a firewall or rate limiter while a browser gets the page.
const BLOCK_STATUSES = new Set([401, 403, 406, 429, 503]);
const CHALLENGE = /cf-chl|just a moment\.\.\.|attention required|captcha/i;

export const crawlerResults = (robots: string): CrawlerResult[] =>
  AI_CRAWLERS.map((agent) => {
    const d = robotsDecision(robots, "/", agent);
    return { agent, allowed: d.allowed, line: d.line };
  });

export const visibleWords = (html: string) => pageText(html).split(/\s+/).filter(Boolean).length;

type Deps = Pick<GuardOptions, "lookup" | "transport" | "allow" | "ports" | "timeoutMs">;

export async function checkAiAccess(domain: string, deps: Deps = {}): Promise<AiAccessInput> {
  const host = siteHost(domain);
  const empty: AiAccessInput = {
    domain,
    outcome: "unreachable",
    crawlers: crawlerResults(""),
    visibleWords: null,
    statusNormal: null,
    statusGptbot: null,
    cloudflare: false,
    pagesChecked: 0,
  };
  if (!host) return empty;
  const get = (path: string, ua: string) =>
    guardedGet(`https://${host}${path}`, { ...deps, sameSite: host, headers: { "User-Agent": ua } });

  const robotsRes = await get("/robots.txt", USER_AGENT);
  // Only a robots.txt that loaded counts; a missing or failing one blocks nobody.
  const robots = robotsRes.ok && robotsRes.page.status >= 200 && robotsRes.page.status < 300 ? robotsRes.page.body : "";
  const crawlers = crawlerResults(robots);

  const home = await get("/", USER_AGENT);
  if (!home.ok || home.page.status < 200 || home.page.status >= 300) return { ...empty, crawlers };
  const bot = await get("/", GPTBOT_UA);

  const statusNormal = home.page.status;
  const statusGptbot = bot.ok ? bot.page.status : null;
  const botBlocked = bot.ok && (BLOCK_STATUSES.has(bot.page.status) || CHALLENGE.test(bot.page.body));
  const h = home.page.headers;
  const cloudflare = h.has("cf-ray") || /cloudflare/i.test(h.get("server") ?? "");
  const words = visibleWords(home.page.body);

  const outcome: AiAccessOutcome =
    crawlers.some((c) => !c.allowed) || botBlocked
      ? "blocked"
      : words < JS_EMPTY_WORDS
        ? "js_empty"
        : cloudflare
          ? "cloudflare"
          : "good";
  return {
    domain: host,
    outcome,
    crawlers,
    visibleWords: words,
    statusNormal,
    statusGptbot,
    cloudflare,
    pagesChecked: 1,
  };
}
