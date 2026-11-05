import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { CUISINES } from "./cuisines";
import type { SiteRead } from "./types";

export const USER_AGENT = "Rank1/1.0 (+https://rank1.us)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

export type ReadSiteDeps = {
  fetch?: typeof fetch;
  lookup?: (host: string) => Promise<{ address: string }[]>;
  timeoutMs?: number;
};

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");

// A public hostname only: no IP literals, no localhost, no internal-looking names.
export function siteHost(domain: string): string | null {
  const raw = domain.trim().toLowerCase();
  let host: string;
  try {
    host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  if (
    isIP(host.replace(/^\[|\]$/g, "")) ||
    !/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
  )
    return null;
  if (/(^|\.)(localhost|local|internal|lan|home|corp|invalid)$/.test(host)) return null;
  return host;
}

// Loopback, private, link-local, CGNAT, multicast and reserved ranges (v4 and v6).
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

async function publicHost(host: string, lookup: NonNullable<ReadSiteDeps["lookup"]>) {
  try {
    const addrs = await lookup(host);
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

type Page = { status: number; type: string; body: string };

// GET with a timeout and a size cap. Follows same-site redirects only (www and http/https variants).
async function get(
  url: URL,
  deps: Required<ReadSiteDeps>,
  lookupOk: (h: string) => Promise<boolean>,
): Promise<Page | null> {
  const site = bare(url.hostname);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (bare(url.hostname) !== site || !(await lookupOk(url.hostname))) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs);
    try {
      const res = await deps.fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9" },
        redirect: "manual",
        signal: ctrl.signal,
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url);
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        continue;
      }
      const text = await res.text();
      return { status: res.status, type: res.headers.get("content-type") ?? "", body: text.slice(0, MAX_BYTES) };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// robots.txt rules for Rank1 (its own group if present, else '*'). Longest match wins; Allow wins ties.
export function robotsAllows(robots: string, path: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  for (const line of robots.split(/\r?\n/)) {
    const m = line.replace(/#.*/, "").match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === "user-agent") {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(m[2].toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: m[2] });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && "rank1".startsWith(a)));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  let best: { allow: boolean; len: number } = { allow: true, len: -1 };
  for (const r of rules) {
    if (!r.path) continue;
    const re = new RegExp(
      `^${r.path
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\\\$$/, "$")}`,
    );
    if (re.test(path) && (r.path.length > best.len || (r.path.length === best.len && r.allow)))
      best = { allow: r.allow, len: r.path.length };
  }
  return best.allow;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const meta = (html: string, prop: string) => {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1];
};

// og:site_name, else the <title> up to its first separator.
export function siteName(html: string): string | undefined {
  const og = meta(html, "og:site_name");
  if (og && decode(og)) return decode(og);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const first = title
    ? decode(title)
        .split(/\s+[|·•–—-]\s+|\s*\|\s*/)[0]
        ?.trim()
    : "";
  return first || undefined;
}

export const pageText = (html: string) =>
  decode(html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "));

// The CUISINES entry named most often in the text (whole words); ties go to the list order.
export function matchCuisine(text: string): string | undefined {
  let best: { cuisine: string; n: number } | null = null;
  for (const c of CUISINES) {
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const n = text.match(new RegExp(`(^|[^\\p{L}])${esc}(?=[^\\p{L}]|$)`, "giu"))?.length ?? 0;
    if (n > 0 && (!best || n > best.n)) best = { cuisine: c, n };
  }
  return best?.cuisine;
}

const isHtml = (p: Page | null): p is Page => !!p && p.status >= 200 && p.status < 300 && /html/i.test(p.type);

// Reads the home page and /menu (robots.txt respected) for a name and a cuisine. No LLM; never throws.
export async function readSite(domain: string, deps: ReadSiteDeps = {}): Promise<SiteRead> {
  const host = siteHost(domain);
  if (!host) return { status: "unreadable" };
  const d: Required<ReadSiteDeps> = {
    fetch: deps.fetch ?? fetch,
    lookup: deps.lookup ?? ((h) => dnsLookup(h, { all: true })),
    timeoutMs: deps.timeoutMs ?? TIMEOUT_MS,
  };
  const ok = new Map<string, Promise<boolean>>();
  const lookupOk = (h: string) => {
    if (!ok.has(h)) ok.set(h, publicHost(h, d.lookup));
    return ok.get(h)!;
  };
  const base = new URL(`https://${host}/`);
  const robots = await get(new URL("/robots.txt", base), d, lookupOk);
  const rules = robots && robots.status >= 200 && robots.status < 300 ? robots.body : "";
  if (!robotsAllows(rules, "/")) return { status: "unreadable" };
  const home = await get(base, d, lookupOk);
  if (!isHtml(home)) return { status: "unreadable" };
  const menu = robotsAllows(rules, "/menu") ? await get(new URL("/menu", base), d, lookupOk) : null;
  const text = [
    meta(home.body, "description") ?? "",
    pageText(home.body),
    isHtml(menu) ? pageText(menu.body) : "",
  ].join(" ");
  const name = siteName(home.body);
  const cuisine = matchCuisine(text);
  return { status: "ok", ...(name ? { name } : {}), ...(cuisine ? { cuisine } : {}) };
}
