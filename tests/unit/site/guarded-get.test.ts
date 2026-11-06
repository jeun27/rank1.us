// @vitest-environment node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { guardedGet, MAX_BYTES, type GuardOptions } from "@/lib/site/guarded-get";

// A real local server. Production only ever reaches public IPs on 80/443; these tests open the guard to
// exactly 127.0.0.1 and this port through the test-only `allow` / `ports` options.
let server: Server;
let port = 0;
let seen: IncomingMessage[] = [];
let handler: (req: IncomingMessage, res: ServerResponse) => void = (_req, res) => res.end("ok");

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push(req);
    handler(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  seen = [];
  handler = (_req, res) => res.end("ok");
});

const LOCAL = (ip: string) => ip === "127.0.0.1" || ip === "::ffff:127.0.0.1";
const local = (over: GuardOptions = {}): GuardOptions => ({
  lookup: async () => [{ address: "127.0.0.1", family: 4 }],
  allow: LOCAL,
  ports: [port],
  ...over,
});
const at = (path = "/", host = "site.test") => `http://${host}:${port}${path}`;

describe("guardedGet against a local server (test-only allow)", () => {
  it("reads a page and sends no Cookie or Authorization, even after a Set-Cookie", async () => {
    handler = (req, res) => {
      if (req.url === "/") {
        res.writeHead(302, { location: "/next", "set-cookie": "sid=example; Path=/" });
        return res.end();
      }
      res.end("hello");
    };
    const r = await guardedGet(at("/"), local({ headers: { "User-Agent": "Rank1-test" } }));
    expect(r).toMatchObject({ ok: true, page: { status: 200, body: "hello", url: at("/next") } });
    expect(seen).toHaveLength(2);
    for (const req of seen) {
      expect(req.headers.cookie).toBeUndefined();
      expect(req.headers.authorization).toBeUndefined();
      expect(req.headers["user-agent"]).toBe("Rank1-test");
    }
  });

  it("follows 3 redirects, refuses a 4th", async () => {
    handler = (req, res) => {
      const n = Number(req.url!.slice(1) || 0);
      if (n < 9) {
        res.writeHead(302, { location: `/${n + 1}` });
        return res.end();
      }
      res.end("end");
    };
    expect(await guardedGet(at("/6"), local())).toMatchObject({ ok: true, page: { body: "end" } });
    expect(await guardedGet(at("/5"), local())).toEqual({ ok: false, reason: "redirect_limit" });
  });

  it("a redirect to a private IP literal or a host that resolves private is refused before connecting", async () => {
    handler = (_req, res) => {
      res.writeHead(302, { location: `http://127.0.0.2:${port}/x` });
      res.end();
    };
    expect(await guardedGet(at("/"), local())).toEqual({ ok: false, reason: "blocked_address" });
    expect(seen).toHaveLength(1);

    handler = (_req, res) => {
      res.writeHead(302, { location: at("/x", "evil.test") });
      res.end();
    };
    const lookup = vi.fn(async (h: string) =>
      h === "evil.test" ? [{ address: "10.0.0.1", family: 4 }] : [{ address: "127.0.0.1", family: 4 }],
    );
    seen = [];
    expect(await guardedGet(at("/"), local({ lookup }))).toEqual({ ok: false, reason: "blocked_address" });
    expect(seen).toHaveLength(1);
    expect(lookup).toHaveBeenCalledWith("evil.test");
  });

  it("DNS rebinding: each connection uses the address its own lookup checked; a second, private answer is refused", async () => {
    handler = (req, res) => {
      if (req.url === "/") {
        res.writeHead(302, { location: "/again" });
        return res.end();
      }
      res.end("should not be read");
    };
    const answers = [[{ address: "127.0.0.1", family: 4 }], [{ address: "10.0.0.7", family: 4 }]];
    const lookup = vi.fn(async () => answers.shift()!);
    expect(await guardedGet(at("/"), local({ lookup }))).toEqual({ ok: false, reason: "blocked_address" });
    expect(lookup).toHaveBeenCalledTimes(2); // one per connection, never a separate pre-check + re-resolve
    expect(seen.map((r) => r.url)).toEqual(["/"]);
  });

  it("the connected socket's address is re-checked (refused if it isn't allowed)", async () => {
    let calls = 0;
    const allow = (ip: string) => (calls++ === 0 ? LOCAL(ip) : false); // lookup passes, the socket check fails
    expect(await guardedGet(at("/"), local({ allow }))).toEqual({ ok: false, reason: "blocked_address" });
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("a host with any private record (mixed answer) is refused, nothing sent", async () => {
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    const allow = (ip: string) => ip === "93.184.216.34" || false;
    expect(await guardedGet(at("/"), local({ lookup, allow }))).toEqual({ ok: false, reason: "blocked_address" });
    expect(seen).toHaveLength(0);
  });

  it("oversize: a big Content-Length is refused unread, and a chunked body is cut at the cap", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-length": String(MAX_BYTES + 1) });
      res.end("x".repeat(10));
    };
    expect(await guardedGet(at("/"), local())).toEqual({ ok: false, reason: "too_large" });
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      const chunk = "y".repeat(64 * 1024);
      for (let i = 0; i < 9; i++) res.write(chunk);
      res.end();
    };
    expect(await guardedGet(at("/"), local())).toEqual({ ok: false, reason: "too_large" });
    expect(MAX_BYTES).toBe(512 * 1024);
    handler = (_req, res) => res.end("z".repeat(MAX_BYTES));
    expect(await guardedGet(at("/"), local())).toMatchObject({ ok: true });
  });

  it("timeout: slow headers or a stalled body", async () => {
    handler = () => {}; // never answers
    expect(await guardedGet(at("/"), local({ timeoutMs: 150 }))).toEqual({ ok: false, reason: "timeout" });
    handler = (_req, res) => {
      res.writeHead(200);
      res.write("partial"); // then stalls
    };
    expect(await guardedGet(at("/"), local({ timeoutMs: 150 }))).toEqual({ ok: false, reason: "timeout" });
  });
});

describe("guardedGet with production defaults", () => {
  it.each([
    "http://127.0.0.1/",
    "http://127.1.2.3/",
    "http://10.0.0.1/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://2130706433/", // 127.0.0.1 as a number
    "http://0x7f.0.0.1/",
    "http://017700000001/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://[64:ff9b::a00:1]/",
  ])("%s → blocked_address, no lookup", async (url) => {
    const lookup = vi.fn();
    expect(await guardedGet(url, { lookup })).toEqual({ ok: false, reason: "blocked_address" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("a hostname that resolves private, or to nothing, is refused", async () => {
    for (const answer of [[{ address: "10.1.2.3", family: 4 }], [{ address: "::1", family: 6 }], []])
      expect(await guardedGet("https://example.test/", { lookup: async () => answer })).toEqual({
        ok: false,
        reason: "blocked_address",
      });
  });

  it.each([
    "ftp://example.com/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://example.com:8080/",
    "https://example.com:22/",
    "http://user:pass@example.com/",
    "not a url",
  ])("%s → bad_url", async (url) => {
    const lookup = vi.fn();
    expect(await guardedGet(url, { lookup })).toEqual({ ok: false, reason: "bad_url" });
    expect(lookup).not.toHaveBeenCalled();
  });
});
