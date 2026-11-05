import { isHtmlPage, type SiteFetcher, type SitePage } from "@/lib/onboarding/read-site";
import { normalize } from "@/lib/runs/mentions";
import { PRICE, faqText, headings, lines, links } from "./html";
import { fix, ok, type FixResult } from "./types";

export const DEFAULT_MAX_PAGES = 20;
const SHOWN = 5;
const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|webp|avif|svg|css|js|zip|mp4|mov)($|[?#])/i;

// Dish names = the text before the first price on a menu line (2–60 chars, with letters), deduped.
export function dishNames(menuHtml: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines(menuHtml)) {
    const at = line.search(new RegExp(PRICE.source));
    if (at <= 0) continue;
    const name = line
      .slice(0, at)
      .replace(/[\s\-–—:·|.,]+$/u, "")
      .trim();
    const key = normalize(name);
    if (name.length < 2 || name.length > 60 || !/\p{L}{2}/u.test(name) || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

const phrase = (n: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");

// R11: crawl same-site pages (home, menu, then their links; ≤ maxPages, robots obeyed by the fetcher)
// and look for each dish in H1–H3 and FAQ text.
export async function checkDishes(
  f: SiteFetcher,
  home: SitePage,
  menu: SitePage,
  maxPages = DEFAULT_MAX_PAGES,
): Promise<FixResult> {
  const dishes = dishNames(menu.body);
  const queue = [home.url, menu.url];
  const seen = new Set<string>();
  const covered: string[] = [];
  while (queue.length && seen.size < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const page = url === home.url ? home : url === menu.url ? menu : await f.page(url);
    if (!isHtmlPage(page)) continue;
    covered.push(...headings(page.body), faqText(page.body));
    for (const l of links(page.body)) {
      try {
        const u = new URL(l.href, page.url);
        u.hash = "";
        if (
          u.hostname.replace(/^www\./, "") === f.base.hostname.replace(/^www\./, "") &&
          !NOT_A_PAGE.test(u.pathname) &&
          !seen.has(u.toString())
        )
          queue.push(u.toString());
      } catch {
        // Skip malformed links.
      }
    }
    if (f.used().exhausted) break;
  }
  const text = normalize(covered.join(" \n "));
  const uncovered = dishes.filter((d) => !phrase(normalize(d)).test(text));
  const evidence = { menu_url: menu.url, dishes_checked: dishes.length, uncovered, pages_checked: seen.size };
  if (!uncovered.length) return ok("R11", evidence);
  return fix("R11", evidence, { dishes: uncovered.slice(0, SHOWN).join(", ") });
}
