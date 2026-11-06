import "server-only";
import { isIP } from "node:net";
import { guardedGet } from "@/lib/site/guarded-get";
import { CUISINES } from "./cuisines";
import type { SiteRead } from "./types";

export const USER_AGENT = "Rank1/1.0 (+https://rank1.us)";
const TIMEOUT_MS = 10_000;
export const MAX_BYTES = 1_000_000;

export type ReadSiteDeps = {
  // Tests only: a fetch-shaped fake (the guard then checks DNS before the call).
  fetch?: typeof fetch;
  lookup?: (host: string) => Promise<{ address: string }[]>;
  timeoutMs?: number;
};
type Deps = ReadSiteDeps & { timeoutMs: number };

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
  return host.replace(/^www\./, "");
}

export { isPrivateAddress } from "@/lib/site/address";

export type SitePage = { url: string; status: number; type: string; body: string };
// GET through the shared SSRF guard (src/lib/site/guarded-get.ts: public IPs checked at connect, no
// rebinding window), with a timeout and a size cap. Follows same-site redirects only (www and http/https).
async function get(url: URL, deps: Deps): Promise<SitePage | null> {
  const r = await guardedGet(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9" },
    lookup: deps.lookup,
    timeoutMs: deps.timeoutMs,
    maxBytes: MAX_BYTES,
    sameSite: url.hostname,
    transport: deps.fetch && ((u, init) => deps.fetch!(u, { ...init, redirect: "manual" })),
  });
  if (!r.ok) return null;
  return { url: r.page.url, status: r.page.status, type: r.page.headers.get("content-type") ?? "", body: r.page.body };
}

// robots.txt rules for an agent (Rank1 by default): its own group if present, else '*'. Longest match
// wins; Allow wins ties.
export function robotsAllows(robots: string, path: string, agent = "rank1"): boolean {
  const me = agent.toLowerCase();
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
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && me.startsWith(a)));
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

export type RobotsState = { status: "ok" | "missing" | "error"; text: string };

export type SiteFetcher = {
  host: string;
  base: URL;
  robots: RobotsState;
  // Rank1's own robots rules for a path (missing or failed robots.txt = allow all).
  allowed: (path: string) => boolean;
  // A same-site page through the guard, cached; null when blocked, failed or over budget.
  page: (pathOrUrl: string) => Promise<SitePage | null>;
  used: () => { requests: number; exhausted: boolean };
};

export type FetcherOptions = ReadSiteDeps & { maxRequests?: number; budgetMs?: number; now?: () => number };

// The guarded fetcher readSite and the fix checks share: SSRF/DNS guard, same-site redirects, size
// cap, per-request timeout, Rank1 UA, robots.txt obeyed, plus an optional request and time budget.
export async function createSiteFetcher(domain: string, opts: FetcherOptions = {}): Promise<SiteFetcher | null> {
  const host = siteHost(domain);
  if (!host) return null;
  // fetch is a test seam only; production goes through the guard's pinned transport.
  const d: Deps = { fetch: opts.fetch, lookup: opts.lookup, timeoutMs: opts.timeoutMs ?? TIMEOUT_MS };
  const now = opts.now ?? Date.now;
  const started = now();
  let requests = 0;
  let exhausted = false;
  const spend = () => {
    if (requests >= (opts.maxRequests ?? Infinity) || now() - started >= (opts.budgetMs ?? Infinity)) {
      exhausted = true;
      return false;
    }
    requests++;
    return true;
  };
  const base = new URL(`https://${host}/`);
  const r = spend() ? await get(new URL("/robots.txt", base), d) : null;
  const robots: RobotsState =
    r && r.status >= 200 && r.status < 300
      ? { status: "ok", text: r.body }
      : r && r.status >= 400 && r.status < 500
        ? { status: "missing", text: "" }
        : { status: "error", text: "" };
  const allowed = (path: string) => robotsAllows(robots.text, path);
  const cache = new Map<string, Promise<SitePage | null>>();
  const page = (pathOrUrl: string) => {
    let url: URL;
    try {
      url = new URL(pathOrUrl, base);
    } catch {
      return Promise.resolve(null);
    }
    url.hash = "";
    const key = url.toString();
    if (bare(url.hostname) !== bare(host) || !allowed(url.pathname + url.search)) return Promise.resolve(null);
    if (!cache.has(key)) cache.set(key, spend() ? get(url, d) : Promise.resolve(null));
    return cache.get(key)!;
  };
  return { host, base, robots, allowed, page, used: () => ({ requests, exhausted }) };
}

export const isHtmlPage = (p: SitePage | null): p is SitePage =>
  !!p && p.status >= 200 && p.status < 300 && /html/i.test(p.type);

// Reads the home page and /menu (robots.txt respected) for a name and a cuisine. No LLM; never throws.
export async function readSite(domain: string, deps: ReadSiteDeps = {}): Promise<SiteRead> {
  const f = await createSiteFetcher(domain, deps);
  if (!f || !f.allowed("/")) return { status: "unreadable" };
  const home = await f.page("/");
  if (!isHtmlPage(home)) return { status: "unreadable" };
  const menu = await f.page("/menu");
  const text = [
    meta(home.body, "description") ?? "",
    pageText(home.body),
    isHtmlPage(menu) ? pageText(menu.body) : "",
  ].join(" ");
  const name = siteName(home.body);
  const cuisine = matchCuisine(text);
  return { status: "ok", ...(name ? { name } : {}), ...(cuisine ? { cuisine } : {}) };
}
