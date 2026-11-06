import { LIVE_CONNECTORS } from "@/lib/connections/recommend";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const svc = vi.hoisted(() => ({ beginGoogleConnect: vi.fn(), finishGoogleConnect: vi.fn() }));
vi.mock("@/lib/connections/service", async (real) => ({ ...(await real<object>()), ...svc }));
const db = vi.hoisted(() => ({ createClient: vi.fn(async () => ({})), createServiceClient: vi.fn(() => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: db.createClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: db.createServiceClient }));

const start = await import("@/app/api/connections/google/start/route");
const callback = await import("@/app/api/connections/google/callback/route");

const req = (path: string, cookie?: string) =>
  new NextRequest(`https://evil-host.example${path}`, { headers: cookie ? { cookie } : {} });

beforeEach(() => {
  vi.stubEnv("ENABLE_CONNECTIONS", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rank1.example");
  svc.beginGoogleConnect.mockReset();
  svc.finishGoogleConnect.mockReset();
  db.createClient.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("the flag", () => {
  it.each(["", "false", "1"])("ENABLE_CONNECTIONS=%j → 404 on both routes, before anything else", async (v) => {
    vi.stubEnv("ENABLE_CONNECTIONS", v);
    expect((await start.GET(req("/api/connections/google/start?business=b&connector=gbp"))).status).toBe(404);
    expect((await callback.GET(req("/api/connections/google/callback?state=s&code=c"))).status).toBe(404);
    expect(db.createClient).not.toHaveBeenCalled();
  });
});

describe("GET /api/connections/google/start", () => {
  it("redirects to Google and sets the state cookie (httpOnly, Secure, Lax, callback path, 10 min)", async () => {
    svc.beginGoogleConnect.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      cookie: "c0ok",
    });
    const res = await start.GET(req("/api/connections/google/start?business=biz-1&connector=gbp&return=/client"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?x=1");
    const set = res.headers.get("set-cookie")!;
    expect(set).toContain("rank1_google_oauth=c0ok");
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/Secure/i);
    expect(set).toMatch(/SameSite=lax/i);
    expect(set).toContain("Path=/api/connections/google/callback");
    expect(set).toContain("Max-Age=600");
    expect(svc.beginGoogleConnect.mock.calls[0][1]).toEqual({
      businessId: "biz-1",
      connector: "gbp",
      returnTo: "/client",
    });
  });

  it("NEXT_PUBLIC_SITE_URL unset or http → 503 not_configured before Google or any access check", async () => {
    for (const site of ["", "http://rank1.example"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
      const res = await start.GET(req("/api/connections/google/start?business=b&connector=gbp"));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "not_configured" });
      expect(res.headers.get("location")).toBeNull();
    }
    expect(svc.beginGoogleConnect).not.toHaveBeenCalled();
    expect(db.createClient).not.toHaveBeenCalled();
  });

  // G1: YouTube's tile is live, so it connects. The #146 S1 gate still holds: an OAuth connector that isn't
  // in LIVE_CONNECTORS is refused (checked by taking YouTube out for this test).
  it("YouTube connects now its tile is live (G1)", async () => {
    svc.beginGoogleConnect.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      cookie: "c0ok",
    });
    await start.GET(req("/api/connections/google/start?business=b&connector=youtube"));
    expect(svc.beginGoogleConnect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ connector: "youtube" }),
    );
  });

  it("a connector not in LIVE_CONNECTORS is refused (400) before any access check (lead, #146 S1)", async () => {
    const live = LIVE_CONNECTORS as string[];
    const at = live.indexOf("youtube");
    live.splice(at, 1);
    try {
      const res = await start.GET(req("/api/connections/google/start?business=b&connector=youtube"));
      expect(res.status).toBe(400);
      expect(svc.beginGoogleConnect).not.toHaveBeenCalled();
      expect(db.createClient).not.toHaveBeenCalled();
    } finally {
      live.splice(at, 0, "youtube");
    }
  });

  it("an unknown connector or no business → 400, no access check", async () => {
    for (const q of ["?business=b&connector=shopify", "?connector=gbp", "?business=b"])
      expect((await start.GET(req(`/api/connections/google/start${q}`))).status).toBe(400);
    expect(svc.beginGoogleConnect).not.toHaveBeenCalled();
  });

  it("not allowed → back to the return path with the outcome, on the site URL (never the request host)", async () => {
    svc.beginGoogleConnect.mockResolvedValue("not_allowed");
    const res = await start.GET(req("/api/connections/google/start?business=b&connector=ga4&return=/client"));
    expect(res.headers.get("location")).toBe("https://rank1.example/client?connection=ga4&status=not_allowed");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("GET /api/connections/google/callback", () => {
  it.each([
    [
      { status: "connected", connector: "gbp", returnTo: "/client" },
      "https://rank1.example/client?connection=gbp&status=connected",
    ],
    [
      { status: "denied", connector: "ga4", returnTo: "/app" },
      "https://rank1.example/app?connection=ga4&status=denied",
    ],
    [
      { status: "error", connector: null, returnTo: "/app/settings" },
      "https://rank1.example/app/settings?status=error",
    ],
  ])("%j → redirect, and the state cookie is cleared", async (outcome, location) => {
    svc.finishGoogleConnect.mockResolvedValue(outcome);
    const res = await callback.GET(
      req("/api/connections/google/callback?state=st&code=4%2Fc", "rank1_google_oauth=c0ok"),
    );
    expect(res.headers.get("location")).toBe(location);
    const set = res.headers.get("set-cookie")!;
    expect(set).toContain("rank1_google_oauth=;");
    expect(set).toContain("Path=/api/connections/google/callback");
    expect(set).toMatch(/Max-Age=0/);
    expect(svc.finishGoogleConnect.mock.calls[0][1]).toEqual({ cookie: "c0ok", state: "st", code: "4/c", error: null });
  });

  it("a thrown error still clears the cookie and lands on /app/settings?status=error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    svc.finishGoogleConnect.mockRejectedValue(new Error("db down: secret detail"));
    const res = await callback.GET(req("/api/connections/google/callback?state=st&code=c", "rank1_google_oauth=x"));
    expect(res.headers.get("location")).toBe("https://rank1.example/app/settings?status=error");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("NEXT_PUBLIC_SITE_URL unset or http → 503 not_configured, no redirect to the request host", async () => {
    for (const site of ["", "http://rank1.example"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
      const res = await callback.GET(req("/api/connections/google/callback?state=st&code=c", "rank1_google_oauth=x"));
      expect(res.status).toBe(503);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    }
    expect(svc.finishGoogleConnect).not.toHaveBeenCalled();
  });
});
