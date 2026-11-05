// Brand mention detection by text matching. No LLM: names, aliases and distinctive domains only.
export type TrackedBrand = {
  kind: "business" | "competitor";
  name: string;
  aliases?: string[];
  domain?: string | null;
};

export type BrandMention = { name: string; kind: TrackedBrand["kind"]; mentioned: boolean; position: number | null };

export type Mentions = { mentioned: boolean; first_position: number | null; brands: BrandMention[] };

// Domain labels too common to count as a brand on their own (food words, generic site words, our cities).
const STOPLIST = new Set([
  "ramen",
  "sushi",
  "pizza",
  "tacos",
  "burger",
  "burgers",
  "noodle",
  "noodles",
  "kitchen",
  "grill",
  "house",
  "cafe",
  "coffee",
  "bakery",
  "bistro",
  "diner",
  "eatery",
  "restaurant",
  "restaurants",
  "menu",
  "order",
  "online",
  "food",
  "foods",
  "delivery",
  "takeout",
  "local",
  "best",
  "irvine",
  "orange",
  "county",
  "california",
  "example",
  "official",
  "store",
  "shop",
  "group",
]);

// Case-folded, diacritics stripped, quotes unified, "&" folded to "and", whitespace collapsed.
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[‘’ʼ′`´]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A whole-word phrase: no letter or digit right before or after (so a possessive 's still matches).
const phrase = (p: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(p).replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "gu");

export function bareDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^www\./, "");
}

function patterns(b: TrackedBrand): string[] {
  const out = [b.name, ...(b.aliases ?? [])].map(normalize).filter((p) => p.length > 0);
  if (b.domain) {
    const host = bareDomain(b.domain);
    if (host.includes(".")) out.push(host);
    const label = host.split(".")[0];
    if (label.length >= 5 && !STOPLIST.has(label) && !label.split("-").every((w) => STOPLIST.has(w))) out.push(label);
  }
  return [...new Set(out)];
}

type Hit = { brand: number; start: number; end: number };

// Every brand's hits; overlapping hits go to the longest match, so a short brand inside a longer one doesn't count.
export function detectMentions(text: string | null | undefined, brands: TrackedBrand[]): Mentions {
  const t = normalize(text ?? "");
  const hits: Hit[] = [];
  brands.forEach((b, brand) => {
    for (const p of patterns(b))
      for (const m of t.matchAll(phrase(p))) hits.push({ brand, start: m.index, end: m.index + m[0].length });
  });
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Hit[] = [];
  for (const h of hits) if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);

  const first = new Map<number, number>();
  for (const h of kept) first.set(h.brand, Math.min(first.get(h.brand) ?? Infinity, h.start));
  const order = [...first.entries()].sort((a, b) => a[1] - b[1]).map(([brand]) => brand);
  const result = brands.map((b, i) => {
    const pos = order.indexOf(i);
    return { name: b.name, kind: b.kind, mentioned: pos >= 0, position: pos >= 0 ? pos + 1 : null };
  });
  const business = result.find((r) => r.kind === "business");
  return { mentioned: !!business?.mentioned, first_position: business?.position ?? null, brands: result };
}
