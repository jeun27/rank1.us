import type { Vertical } from "@/lib/queries/onboarding";
import { createSiteFetcher, decode, isHtmlPage, matchCuisine, meta, pageText, siteName } from "./read-site";
import type { ReadSiteDeps } from "./read-site";
import type { ProfileSource, SiteProfile } from "./types";

// Onboarding v2 DP1 (share/ux-plan/onboarding-welcome §4): the business profile from the home page.
// Deterministic, no LLM: JSON-LD first, then meta/og, then the title/H1/description. Sources: schema =
// JSON-LD, meta = meta tags (og:site_name, geo.*), title = the title, H1, description or page body.

// JSON-LD @type → vertical + the category label ("What you do"). saas/dtc get no category from a type.
const TYPES: Record<string, [Vertical, string | null]> = {
  Restaurant: ["restaurant", "restaurant"],
  FoodEstablishment: ["restaurant", "restaurant"],
  Plumber: ["plumbing", "plumber"],
  HVACBusiness: ["hvac", "HVAC"],
  RoofingContractor: ["roofing", "roofer"],
  PestControl: ["pest_control", "pest control"],
  AutoRepair: ["auto", "auto repair"],
  AutomotiveBusiness: ["auto", "auto shop"],
  BeautySalon: ["beauty", "beauty salon"],
  HairSalon: ["beauty", "hair salon"],
  DaySpa: ["beauty", "day spa"],
  ExerciseGym: ["gym", "gym"],
  SportsActivityLocation: ["gym", "gym"],
  Dentist: ["dental", "dentist"],
  EventVenue: ["events", "event venue"],
  SoftwareApplication: ["saas", null],
  Product: ["dtc", null],
  OnlineStore: ["dtc", null],
};
// Nodes that can name the business (a Product or an app is not the business).
const NAMERS = new Set(["LocalBusiness", "Organization", "Corporation", "Store", "OnlineStore"]);

// Keyword fallback over the title + H1 + meta description: whole words, most hits wins, ties = this
// order. The winning keyword is the category (none for saas/dtc).
const KEYWORDS: [Vertical, string[]][] = [
  ["restaurant", ["restaurant", "cafe", "bistro", "eatery", "diner"]],
  ["hvac", ["hvac", "heating", "air conditioning", "furnace"]],
  ["plumbing", ["plumber", "plumbing"]],
  ["roofing", ["roofing", "roofer"]],
  ["pest_control", ["pest control", "exterminator", "termite"]],
  ["auto", ["auto repair", "mechanic", "car repair"]],
  ["beauty", ["salon", "spa", "barber"]],
  ["gym", ["gym", "fitness"]],
  ["events", ["event venue", "wedding venue", "banquet hall"]],
  ["dental", ["dentist", "dental"]],
  ["saas", ["software", "saas"]],
  ["dtc", ["online store", "free shipping"]],
];

type Node = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && decode(v) ? decode(v) : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const types = (n: Node) => list(n["@type"]).filter((t): t is string => typeof t === "string");
const count = (text: string, word: string) =>
  text.match(new RegExp(`(^|[^\\p{L}])${word.replace(/\s+/g, "\\s+")}(?=[^\\p{L}]|$)`, "giu"))?.length ?? 0;

// Every JSON-LD node on the page: arrays and @graph flattened, unparseable blocks skipped.
function nodes(html: string): Node[] {
  const out: Node[] = [];
  const walk = (v: unknown) => {
    for (const x of list(v))
      if (x && typeof x === "object") {
        out.push(x as Node);
        if ("@graph" in x) walk((x as Node)["@graph"]);
      }
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      // A broken block reads as nothing.
    }
  }
  return out;
}

const keywordVertical = (text: string) => {
  let best: { vertical: Vertical; word: string; n: number } | null = null;
  for (const [vertical, words] of KEYWORDS) {
    const hits = words.map((w) => [w, count(text, w)] as const);
    const n = hits.reduce((a, [, h]) => a + h, 0);
    const word = hits.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    if (n > 0 && (!best || n > best.n)) best = { vertical, word, n };
  }
  return best;
};

// The one normalise step at the reader's output, so a read profile always fits #199's businesses CHECK
// (no 23514 on insert): https links only (no spaces, ≤ 500 chars), deduped, at most 20; text trimmed
// to its column cap. An emptied list loses its source tag.
const CAP = { address: 200, areaServed: 200, phone: 40, category: 100 } as const;
const MAX_LINKS = 20;
const clip = (v: string | undefined, n: number) => v?.slice(0, n).trim() || undefined;
function normalise(p: Omit<SiteProfile, "status">): Omit<SiteProfile, "status"> {
  const out = { ...p, sources: { ...p.sources } };
  for (const k of ["address", "phone", "category"] as const) {
    out[k] = clip(p[k], CAP[k]);
    if (!out[k]) {
      delete out[k];
      delete out.sources[k];
    }
  }
  out.areaServed = p.areaServed.map((a) => clip(a, CAP.areaServed)).filter((a): a is string => !!a);
  out.sameAs = [...new Set(p.sameAs.filter((u) => /^https:\/\/\S+$/.test(u) && u.length <= 500))].slice(0, MAX_LINKS);
  for (const k of ["areaServed", "sameAs"] as const) if (!out[k].length) delete out.sources[k];
  return out;
}

export function profileFromHtml(html: string): Omit<SiteProfile, "status"> {
  const all = nodes(html);
  const biz = all.find((n) =>
    types(n).some((t) => (TYPES[t] && t !== "Product" && t !== "SoftwareApplication") || NAMERS.has(t)),
  );
  const typed = [biz, ...all].flatMap((n) => (n ? types(n).filter((t) => TYPES[t]) : []))[0];
  const p: Omit<SiteProfile, "status"> = { areaServed: [], sameAs: [], sources: {} };
  const set = <K extends keyof SiteProfile["sources"]>(
    key: K,
    value: SiteProfile[K] | undefined,
    source: ProfileSource,
  ) => {
    if (value === undefined || p[key] !== undefined) return;
    (p as Record<string, unknown>)[key] = value;
    p.sources[key] = source;
  };

  set("name", str(biz?.name), "schema");
  const og = meta(html, "og:site_name");
  set("name", og ? str(og) : undefined, "meta");
  set("name", siteName(html), "title");

  const head = [
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ") ?? "",
    meta(html, "description") ?? "",
  ]
    .map(decode)
    .join(" ");
  if (typed) {
    set("vertical", TYPES[typed][0], "schema");
    set("category", TYPES[typed][1] ?? undefined, "schema");
  } else {
    const k = keywordVertical(head);
    set("vertical", k?.vertical, "title");
    if (k && k.vertical !== "saas" && k.vertical !== "dtc") set("category", k.word, "title");
  }

  if (!p.vertical || p.vertical === "restaurant") {
    const serves = list(biz?.servesCuisine).map(str).filter(Boolean).join(" ");
    set("cuisine", serves ? (matchCuisine(serves) ?? serves) : undefined, "schema");
    set("cuisine", matchCuisine(`${meta(html, "description") ?? ""} ${pageText(html)}`), "title");
  }

  const addr = list(biz?.address).find((a): a is Node => !!a && typeof a === "object");
  set("city", str(addr?.addressLocality), "schema");
  set("state", str(addr?.addressRegion), "schema");
  set("city", str(meta(html, "geo.placename")), "meta");
  set("state", str(meta(html, "geo.region"))?.replace(/^[A-Z]{2}-/i, ""), "meta");
  const street = [str(addr?.streetAddress), str(addr?.postalCode)].filter(Boolean).join(", ");
  set("address", street || undefined, "schema");

  set("phone", str(biz?.telephone), "schema");
  set("phone", str(html.match(/href=["']tel:([^"']+)["']/i)?.[1]), "title");

  const areas = list(biz?.areaServed)
    .map((a) => str(a) ?? str((a as Node | null)?.name))
    .filter((a): a is string => !!a);
  if (areas.length) {
    p.areaServed = areas;
    p.sources.areaServed = "schema";
  }
  p.sameAs = all.flatMap((n) => list(n.sameAs)).filter((u): u is string => typeof u === "string");
  if (p.sameAs.length) p.sources.sameAs = "schema";
  return normalise(p);
}

// Stages 1–3 of the reading log: the home page only (robots.txt respected). Never throws.
export async function readHome(domain: string, deps: ReadSiteDeps = {}): Promise<SiteProfile> {
  const unreadable: SiteProfile = { status: "unreadable", areaServed: [], sameAs: [], sources: {} };
  try {
    const f = await createSiteFetcher(domain, deps);
    if (!f || !f.allowed("/")) return unreadable;
    const home = await f.page("/");
    return isHtmlPage(home) ? { status: "ok", ...profileFromHtml(home.body) } : unreadable;
  } catch {
    return unreadable;
  }
}

// DP2: services, stage 4 of the reading log. JSON-LD offers → <nav> link labels minus the stoplist →
// sitemap paths one level under /services/, /menu/ or /treatments/. At most one sitemap fetch (robots'
// Sitemap: line on this site, else /sitemap.xml), robots respected, an index never followed.
export type SiteServices = {
  status: "ok" | "unreadable";
  services: string[];
  source: Extract<ProfileSource, "schema" | "nav" | "sitemap"> | null;
};
const MAX_SERVICES = 12;
const STOP = new Set([
  "home",
  "about",
  "about us",
  "contact",
  "contact us",
  "blog",
  "news",
  "careers",
  "jobs",
  "login",
  "log in",
  "sign in",
  "sign up",
  "account",
  "cart",
  "checkout",
  "faq",
  "faqs",
  "menu",
  "services",
  "our services",
  "gallery",
  "reviews",
  "testimonials",
  "locations",
  "book",
  "book now",
  "order online",
  "shop",
  "privacy",
  "privacy policy",
  "terms",
  "search",
]);
// Non-blank, ≤ 100 chars each, deduped, ≤ 12 (inside #199's services CHECK: 30 × 100).
const uniq = (xs: string[]) =>
  [
    ...new Map(
      xs
        .map((x) => clip(x, 100))
        .filter((x): x is string => !!x)
        .map((x) => [x.toLowerCase(), x]),
    ).values(),
  ].slice(0, MAX_SERVICES);

// An Offer's name: itemOffered.name, else its own name.
const offerName = (o: unknown) => {
  const n = (o ?? {}) as Node;
  return str((n.itemOffered as Node | undefined)?.name) ?? str(n.name);
};
const schemaServices = (html: string) =>
  uniq(
    nodes(html)
      .flatMap((n) => [...list(n.makesOffer), ...list((n.hasOfferCatalog as Node | undefined)?.itemListElement)])
      .map(offerName)
      .filter((s): s is string => !!s),
  );

export function navServices(html: string): string[] {
  const labels = [...html.matchAll(/<nav[\s>][\s\S]*?<\/nav>/gi)].flatMap((nav) =>
    [...nav[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((a) => decode(a[1].replace(/<[^>]+>/g, " "))),
  );
  return uniq(labels.filter((l) => l && l.length <= 60 && !STOP.has(l.toLowerCase())));
}

export function sitemapServices(xml: string, host: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    let u: URL;
    try {
      u = new URL(decode(m[1]));
    } catch {
      continue;
    }
    const slug = u.pathname.match(/^\/(?:services|menu|treatments)\/([^/]+)\/?$/i)?.[1];
    if (!slug || u.hostname.replace(/^www\./, "") !== host) continue;
    const words = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
    if (words) out.push(words[0].toUpperCase() + words.slice(1));
  }
  return uniq(out);
}

export async function readServices(domain: string, deps: ReadSiteDeps = {}): Promise<SiteServices> {
  const unreadable: SiteServices = { status: "unreadable", services: [], source: null };
  try {
    const f = await createSiteFetcher(domain, deps);
    if (!f || !f.allowed("/")) return unreadable;
    const home = await f.page("/");
    if (!isHtmlPage(home)) return unreadable;
    for (const [source, services] of [
      ["schema", schemaServices(home.body)],
      ["nav", navServices(home.body)],
    ] as const)
      if (services.length) return { status: "ok", services, source };
    const listed = f.robots.text.match(/^\s*sitemap\s*:\s*(\S+)/im)?.[1];
    const sitemap = await f.page(listed ?? "/sitemap.xml");
    const services = sitemap && sitemap.status < 300 ? sitemapServices(sitemap.body, f.host) : [];
    return { status: "ok", services, source: services.length ? "sitemap" : null };
  } catch {
    return unreadable;
  }
}
