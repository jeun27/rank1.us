import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";
import { isPrivateAddress } from "./address";

// The one guarded way Rank1 reads someone else's website (SSRF guard, lead-mandated):
// - http/https only, ports 80/443, no userinfo; IP-literal hosts must be public.
// - DNS is resolved inside the socket's own lookup, and the connection goes only to an address that
//   passed the check (every record public), so there is no second lookup to rebind. The connected
//   socket's remote address is checked again.
// - At most 3 redirects, each hop re-validated from scratch. 5 s per request (headers + body).
// - 512 KB cap: a larger Content-Length is refused unread, a longer stream is cut at the cap.
// - No cookies or credentials are ever sent; Set-Cookie is ignored. No proxy, no keep-alive pool.
export const MAX_BYTES = 512 * 1024;
export const TIMEOUT_MS = 5_000;
export const MAX_REDIRECTS = 3;

export type Lookup = (host: string) => Promise<{ address: string; family?: number }[]>;
// A fetch-shaped transport (manual redirects). Production uses the pinned node:http(s) one below.
export type Transport = (url: URL, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

export type GuardOptions = {
  headers?: Record<string, string>;
  lookup?: Lookup;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  // Only redirects that stay on this bare host (www-insensitive) are followed, when set.
  sameSite?: string;
  // Tests only: open the guard to a local test server. Production uses the defaults.
  allow?: (ip: string) => boolean;
  ports?: number[];
  // Tests only: a fetch-shaped fake. The DNS check then runs before the call instead of at connect.
  transport?: Transport;
};

export type GuardedPage = { url: string; status: number; headers: Headers; body: string };
export type GuardFailure =
  "bad_url" | "blocked_address" | "off_site" | "redirect_limit" | "too_large" | "timeout" | "unreachable";
export type GuardResult = { ok: true; page: GuardedPage } | { ok: false; reason: GuardFailure };

class Blocked extends Error {}
const isPublic = (ip: string) => !isPrivateAddress(ip);
const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");
const hostIp = (u: URL) => u.hostname.replace(/^\[|\]$/g, "");
const systemLookup: Lookup = (h) => dnsLookup(h, { all: true, verbatim: true });

type Resolved = { address: string; family: number };
type AllCallback = (err: null, addresses: Resolved[]) => void;

// Resolves inside the socket: every record must pass, and the socket connects to the first one.
function pinnedLookup(lookup: Lookup, allow: (ip: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    lookup(hostname).then(
      (addrs) => {
        if (!addrs.length || addrs.some((a) => !allow(a.address))) return callback(new Blocked(), "", 4);
        const pick: Resolved = { address: addrs[0].address, family: addrs[0].family ?? isIP(addrs[0].address) };
        // Node asks for every address when autoSelectFamily is on; answer with only the checked one.
        if ((options as { all?: boolean }).all) (callback as unknown as AllCallback)(null, [pick]);
        else callback(null, pick.address, pick.family);
      },
      (e) => callback(e as NodeJS.ErrnoException, "", 4),
    );
  };
}

const NO_BODY = new Set([204, 205, 304]);

function pinnedTransport(lookup: Lookup, allow: (ip: string) => boolean): Transport {
  return (url, init) =>
    new Promise((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const req = send(url, {
        method: "GET",
        headers: init.headers,
        agent: false,
        lookup: pinnedLookup(lookup, allow),
      });
      req.on("socket", (socket) =>
        socket.once("connect", () => {
          if (!socket.remoteAddress || !allow(socket.remoteAddress)) req.destroy(new Blocked());
        }),
      );
      init.signal.addEventListener("abort", () => req.destroy(new Error("aborted")), { once: true });
      req.on("response", (res: IncomingMessage) => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers))
          if (v !== undefined && k !== "set-cookie") headers.set(k, Array.isArray(v) ? v.join(", ") : v);
        const status = res.statusCode ?? 0;
        const body = NO_BODY.has(status) ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>);
        if (!body) res.resume();
        resolve(new Response(body, { status, headers }));
      });
      req.on("error", reject);
      req.end();
    });
}

async function readCapped(res: Response, max: number): Promise<string | null> {
  if (Number(res.headers.get("content-length") ?? 0) > max) return null;
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function validUrl(u: URL, ports: number[]): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
  return ports.includes(port);
}

export async function guardedGet(input: string | URL, opts: GuardOptions = {}): Promise<GuardResult> {
  const allow = opts.allow ?? isPublic;
  const lookup = opts.lookup ?? systemLookup;
  const ports = opts.ports ?? [80, 443];
  const max = opts.maxBytes ?? MAX_BYTES;
  const transport = opts.transport ?? pinnedTransport(lookup, allow);
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "bad_url" };
  }
  for (let hop = 0; hop <= (opts.maxRedirects ?? MAX_REDIRECTS); hop++) {
    if (!validUrl(url, ports)) return { ok: false, reason: "bad_url" };
    if (opts.sameSite && bare(url.hostname) !== bare(opts.sameSite)) return { ok: false, reason: "off_site" };
    const ip = hostIp(url);
    if (isIP(ip) && !allow(ip)) return { ok: false, reason: "blocked_address" };
    if (opts.transport && !isIP(ip)) {
      const addrs = await lookup(url.hostname).catch(() => []);
      if (!addrs.length || addrs.some((a) => !allow(a.address))) return { ok: false, reason: "blocked_address" };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);
    try {
      const res = await transport(url, { headers: { ...opts.headers }, signal: ctrl.signal });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => {});
        try {
          url = new URL(location, url);
        } catch {
          return { ok: false, reason: "bad_url" };
        }
        continue;
      }
      const body = await readCapped(res, max);
      if (body === null) return { ok: false, reason: "too_large" };
      return { ok: true, page: { url: url.toString(), status: res.status, headers: res.headers, body } };
    } catch (e) {
      if (e instanceof Blocked || (e as { cause?: unknown })?.cause instanceof Blocked)
        return { ok: false, reason: "blocked_address" };
      return { ok: false, reason: ctrl.signal.aborted ? "timeout" : "unreachable" };
    } finally {
      clearTimeout(timer);
      ctrl.abort();
    }
  }
  return { ok: false, reason: "redirect_limit" };
}
