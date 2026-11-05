import { isHtmlPage, type SiteFetcher, type SitePage } from "@/lib/onboarding/read-site";
import { images, links, prices } from "./html";
import { fix, ok, unchecked, type FixResult } from "./types";

export const MIN_PRICES = 5;
export const MIN_IMAGES = 3;

const PDF = /\.pdf($|[?#])/i;
const IMAGE = /\.(jpe?g|png|gif|webp|avif|heic)($|[?#])/i;

// The home page's first same-site link whose text or href says "menu", else /menu.
export function menuCandidates(home: SitePage, f: Pick<SiteFetcher, "base">): string[] {
  const found = links(home.body).find((l) => /menu/i.test(l.text) || /menu/i.test(l.href));
  const out: string[] = [];
  if (found) {
    try {
      const u = new URL(found.href, home.url);
      if (u.hostname.replace(/^www\./, "") === f.base.hostname.replace(/^www\./, "")) out.push(u.toString());
    } catch {
      // A malformed href is ignored.
    }
  }
  out.push(new URL("/menu", f.base).toString());
  return [...new Set(out)];
}

export type MenuCheck = { result: FixResult; menu: SitePage | null };

// R10: PDF or image menus are fixes; an HTML menu with dish prices is ok; no menu or an unclear page is
// 'unchecked' (lead, 2026-11-05: R10 no-menu case, reconcile with Build Pack).
export async function checkMenu(f: SiteFetcher, home: SitePage): Promise<MenuCheck> {
  for (const url of menuCandidates(home, f)) {
    if (PDF.test(url))
      return { result: fix("R10", { menu_url: url, kind: "pdf" }, { "PDF/image": "PDF" }), menu: null };
    if (IMAGE.test(url))
      return { result: fix("R10", { menu_url: url, kind: "image" }, { "PDF/image": "image" }), menu: null };
    const page = await f.page(url);
    if (!page || page.status < 200 || page.status >= 300) continue;
    if (/pdf/i.test(page.type))
      return { result: fix("R10", { menu_url: page.url, kind: "pdf" }, { "PDF/image": "PDF" }), menu: null };
    if (/^image\//i.test(page.type))
      return { result: fix("R10", { menu_url: page.url, kind: "image" }, { "PDF/image": "image" }), menu: null };
    if (!isHtmlPage(page)) continue;
    const p = prices(page.body.replace(/<[^>]+>/g, " "));
    const i = images(page.body);
    const evidence = { menu_url: page.url, kind: "html", prices: p, images: i };
    if (p >= MIN_PRICES) return { result: ok("R10", evidence), menu: page };
    if (i >= MIN_IMAGES)
      return { result: fix("R10", { ...evidence, kind: "image" }, { "PDF/image": "image" }), menu: null };
    return { result: unchecked("R10", "menu_ambiguous", evidence), menu: null };
  }
  return { result: unchecked("R10", "menu_not_found", { kind: "none" }), menu: null };
}
