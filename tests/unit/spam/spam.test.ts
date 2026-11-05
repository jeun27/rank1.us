import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, hashIp } from "@/lib/spam/ipHash";
import { auditDailyLimit, CONTACT_LIMIT, contactWindowStart, honeypotFilled, utcDayStart } from "@/lib/spam/rateLimit";
import { readBody } from "@/lib/spam/readBody";
import { SITEVERIFY_URL, verifyTurnstile } from "@/lib/spam/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hashIp", () => {
  it("is SHA-256 hex of IP + salt, and never the raw IP", () => {
    const h = hashIp("203.0.113.7", "salt-a");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashIp("203.0.113.7", "salt-a"));
    expect(h).not.toContain("203.0.113.7");
    // sha256("203.0.113.7salt-a")
    expect(h).toBe("0dabe4ef4e1458acceba6666d1b6beb64900ee8fa8f6678edec80c54a772de56");
  });
  it("changes with the salt and the IP", () => {
    expect(hashIp("203.0.113.7", "salt-a")).not.toBe(hashIp("203.0.113.7", "salt-b"));
    expect(hashIp("203.0.113.7", "salt-a")).not.toBe(hashIp("203.0.113.8", "salt-a"));
  });
  it("reads IP_HASH_SALT and refuses to hash without it", () => {
    vi.stubEnv("IP_HASH_SALT", "salt-a");
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7", "salt-a"));
    vi.stubEnv("IP_HASH_SALT", "");
    expect(() => hashIp("203.0.113.7")).toThrow(/IP_HASH_SALT/);
  });
});

describe("clientIp", () => {
  const req = (h: Record<string, string>) => new Request("http://x.test", { headers: h });
  it("takes the first x-forwarded-for entry, then x-real-ip, then 'unknown'", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("rate limit windows", () => {
  it("contact: 3 per rolling hour", () => {
    expect(CONTACT_LIMIT).toBe(3);
    const now = new Date("2026-11-05T10:30:00Z");
    expect(contactWindowStart(now).toISOString()).toBe("2026-11-05T09:30:00.000Z");
  });
  it("audit: the UTC day starts at midnight UTC", () => {
    expect(utcDayStart(new Date("2026-11-05T23:59:59Z")).toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-11-06T00:00:00Z")).toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });
  it("AUDIT_DAILY_LIMIT must be a whole number", () => {
    expect(auditDailyLimit("50")).toBe(50);
    expect(auditDailyLimit("0")).toBe(0);
    for (const bad of [undefined, "", "abc", "-1", "2.5"])
      expect(() => auditDailyLimit(bad)).toThrow(/AUDIT_DAILY_LIMIT/);
  });
});

describe("honeypot", () => {
  it("is filled only by a non-empty string", () => {
    expect(honeypotFilled({ website: "http://spam.test" })).toBe(true);
    expect(honeypotFilled({ website: "" })).toBe(false);
    expect(honeypotFilled({})).toBe(false);
  });
});

describe("readBody", () => {
  const req = (body: string) => new Request("http://x.test", { method: "POST", body });
  it("returns JSON objects only", async () => {
    expect(await readBody(req('{"a":1}'))).toEqual({ a: 1 });
    expect(await readBody(req("[1]"))).toBeNull();
    expect(await readBody(req("not json"))).toBeNull();
    expect(await readBody(req(JSON.stringify({ a: "x".repeat(20_001) })))).toBeNull();
  });
});

describe("verifyTurnstile", () => {
  function mockFetch(json: unknown) {
    const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(json)),
    );
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("posts secret, token and remoteip to siteverify and trusts only success: true", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    const fetch = mockFetch({ success: true });
    expect(await verifyTurnstile("tok", "203.0.113.7")).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      secret: "test-secret",
      response: "tok",
      remoteip: "203.0.113.7",
    });

    mockFetch({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await verifyTurnstile("tok", "203.0.113.7")).toBe(false);
  });
  it("leaves out remoteip when the IP is unknown", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    const fetch = mockFetch({ success: true });
    await verifyTurnstile("tok", "unknown");
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).not.toHaveProperty("remoteip");
  });
  it("fails closed without a secret, without a token, on a too-long token and on network errors", async () => {
    const fetch = mockFetch({ success: true });
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await verifyTurnstile("tok", "203.0.113.7")).toBe(false);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    expect(await verifyTurnstile(undefined, "203.0.113.7")).toBe(false);
    expect(await verifyTurnstile("", "203.0.113.7")).toBe(false);
    expect(await verifyTurnstile("x".repeat(2049), "203.0.113.7")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    expect(await verifyTurnstile("tok", "203.0.113.7")).toBe(false);
  });
});
