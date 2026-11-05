import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { CUISINES } from "./cuisines";
import type { SiteRead } from "./types";

export const USER_AGENT = "Rank1/1.0 (+https://rank1.us)";
const TIMEOUT_MS = 10_000;
export const MAX_BYTES = 1_000_000;
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
  return host.replace(/^www\./, "");
}

// Loopback, private, link-local, CGNAT, multicast and reserved ranges (v4 and v6, including v4-mapped
// in dotted or hex form and NAT64).
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip.split(".").map(Number));
  const h = expandV6(ip);
  if (!h) return true;
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return privateV4(v4Of(h));
  if (h[0] === 0x64 && h[1] === 0xff9b) return true;
  return (
    h.every((x) => x === 0) ||
    (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) ||
    (h[0] & 0xfe00) === 0xfc00 ||
    (h[0] & 0xffc0) === 0xfe80 ||
    (h[0] & 0xff00) === 0xff00 ||
    (h[0] === 0x2001 && h[1] === 0xdb8)
  );
}

function privateV4([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

const v4Of = (h: number[]) => [h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff];

// Eight 16-bit groups, or null if it isn't valid IPv6. A dotted v4 tail counts as the last two groups.
function expandV6(ip: string): number[] | null {
  let s = ip
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/%.*$/, "");
  if (isIP(s) !== 6) return null;
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail[1].split(".").map(Number);
    s = s.slice(0, -tail[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = s.split("::");
  const left = head ? head.split(":") : [];
  const right = rest !== undefined && rest ? rest.split(":") : [];
  const fill = rest === undefined ? [] : Array(8 - left.length - right.length).fill("0");
  const groups = [...left, ...fill, ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

async function publicHost(host: string, lookup: NonNullable<ReadSiteDeps["lookup"]>) {
  try {
    const addrs = await lookup(host);
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

// Reads at most MAX_BYTES: a larger Content-Length is refused unread, and a longer stream is cut off
// (and the request aborted) as soon as it passes the cap. Either way the page counts as unreadable.
async function readCapped(res: Response, ctrl: AbortController): Promise<string | null> {
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
    ctrl.abort();
    return null;
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      ctrl.abort();
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export type SitePage = { url: string; status: number; type: string; body: string };
type Page = SitePage;

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
      const body = await readCapped(res, ctrl);
      return body === null
        ? null
        : { url: url.toString(), status: res.status, type: res.headers.get("content-type") ?? "", body };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
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
  const d: Required<ReadSiteDeps> = {
    fetch: opts.fetch ?? fetch,
    lookup: opts.lookup ?? ((h) => dnsLookup(h, { all: true })),
    timeoutMs: opts.timeoutMs ?? TIMEOUT_MS,
  };
  const now = opts.now ?? Date.now;
  const started = now();
  const ok = new Map<string, Promise<boolean>>();
  const lookupOk = (h: string) => {
    if (!ok.has(h)) ok.set(h, publicHost(h, d.lookup));
    return ok.get(h)!;
  };
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
  const r = spend() ? await get(new URL("/robots.txt", base), d, lookupOk) : null;
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
    if (!cache.has(key)) cache.set(key, spend() ? get(url, d, lookupOk) : Promise.resolve(null));
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
