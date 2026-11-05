import { isHtmlPage, type SitePage } from "@/lib/onboarding/read-site";
import { jsonLd, ldNodes, ldTypes } from "./html";
import { fix, ok, type FixResult } from "./types";

// schema.org Restaurant, its FoodEstablishment family, and Menu.
const TYPES = new Set([
  "Restaurant",
  "FoodEstablishment",
  "CafeOrCoffeeShop",
  "Bakery",
  "BarOrPub",
  "Brewery",
  "Distillery",
  "FastFoodRestaurant",
  "IceCreamShop",
  "Winery",
  "Menu",
]);

// H1 (hygiene): Restaurant/Menu JSON-LD on the home or menu page, or a hasMenu property.
export function checkSchema(pages: (SitePage | null)[]): FixResult {
  const html = pages.filter(isHtmlPage);
  const nodes = html.flatMap((p) => jsonLd(p.body).flatMap((v) => ldNodes(v)));
  const types = [...new Set(nodes.flatMap(ldTypes).filter((t) => TYPES.has(t)))];
  const evidence = { pages_checked: html.map((p) => p.url), types_found: types };
  return types.length || nodes.some((n) => "hasMenu" in n) ? ok("H1", evidence) : fix("H1", evidence);
}
