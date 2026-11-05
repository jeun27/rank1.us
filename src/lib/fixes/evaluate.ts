import { createSiteFetcher, isHtmlPage, type FetcherOptions } from "@/lib/onboarding/read-site";
import { checkSchema } from "./h1-schema";
import { checkMenu } from "./r10-menu";
import { checkDishes, DEFAULT_MAX_PAGES } from "./r11-dishes";
import { checkRobots } from "./r14-robots";
import { unchecked, type FixResult, type RuleKey } from "./types";

// Per business: robots + home + menu + ≤20 R11 pages = ≤23 requests, inside a 45 s crawl budget (lead).
export const BUDGET_MS = 45_000;
export const MAX_REQUESTS = 3 + DEFAULT_MAX_PAGES;
const RULES: RuleKey[] = ["R10", "R11", "R14", "H1"];

const guard = async (rule: RuleKey, run: () => Promise<FixResult> | FixResult): Promise<FixResult> => {
  try {
    return await run();
  } catch {
    return unchecked(rule, "error");
  }
};

// The four enabled site rules for a business, in R10, R11, R14, H1 order. Never throws; no paid calls.
export async function evaluateFixes(
  business: { domain: string | null },
  opts: FetcherOptions & { maxPages?: number } = {},
): Promise<FixResult[]> {
  if (!business.domain) return RULES.map((r) => unchecked(r, "no_domain"));
  const f = await createSiteFetcher(business.domain, { maxRequests: MAX_REQUESTS, budgetMs: BUDGET_MS, ...opts }).catch(
    () => null,
  );
  if (!f) return RULES.map((r) => unchecked(r, "no_domain"));

  const r14 = await guard("R14", () => checkRobots(f.robots));
  if (!f.allowed("/"))
    return [
      unchecked("R10", "robots_disallowed"),
      unchecked("R11", "robots_disallowed"),
      r14,
      unchecked("H1", "robots_disallowed"),
    ];
  const home = await f.page("/").catch(() => null);
  if (!isHtmlPage(home))
    return [
      unchecked("R10", "site_unreachable"),
      unchecked("R11", "site_unreachable"),
      r14,
      unchecked("H1", "site_unreachable"),
    ];

  const menuCheck = await checkMenu(f, home).catch(() => null);
  const r10 = menuCheck?.result ?? unchecked("R10", "error");
  const menu = menuCheck?.menu ?? null;
  const r11 = menu
    ? await guard("R11", () => checkDishes(f, home, menu, opts.maxPages ?? DEFAULT_MAX_PAGES))
    : unchecked("R11", "no_html_menu");
  const h1 = await guard("H1", () => checkSchema([home, menu]));
  return [r10, r11, r14, h1];
}
