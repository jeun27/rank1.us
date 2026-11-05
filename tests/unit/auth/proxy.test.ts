import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let claims: { sub: string } | null = null;
let refreshed: { name: string; value: string }[] = [];
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_u: string, _k: string, opts: { cookies: { setAll: (c: unknown, h: unknown) => void } }) => ({
    auth: {
      getClaims: async () => {
        if (refreshed.length)
          opts.cookies.setAll(
            refreshed.map((c) => ({ ...c, options: {} })),
            { "cache-control": "private, no-cache, no-store" },
          );
        return { data: claims ? { claims } : null, error: null };
      },
    },
  }),
}));

const { proxy, config } = await import("@/proxy");

const req = (path: string) => new NextRequest(`http://localhost:3000${path}`);

beforeEach(() => {
  claims = null;
  refreshed = [];
});

describe("proxy", () => {
  it.each(["/app", "/app/billing", "/team", "/client/report"])("sends signed-out %s to /signin with next", async (p) => {
    const res = await proxy(req(p));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search).toBe(
      `/signin?next=${encodeURIComponent(p)}`,
    );
  });

  it.each(["/", "/signin", "/contact", "/auth/callback"])("lets signed-out %s through", async (p) => {
    const res = await proxy(req(p));
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets a signed-in user into /app and keeps refreshed cookies and no-store headers", async () => {
    claims = { sub: "u1" };
    refreshed = [{ name: "sb-test-auth-token", value: "new" }];
    const res = await proxy(req("/app"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("new");
    expect(res.headers.get("cache-control")).toBe("private, no-cache, no-store");
  });

  it("keeps refreshed cookies on the redirect too", async () => {
    refreshed = [{ name: "sb-test-auth-token", value: "" }];
    const res = await proxy(req("/team"));
    expect(res.status).toBe(307);
    expect(res.cookies.get("sb-test-auth-token")).toBeDefined();
  });

  it("skips static assets", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/_next/static/chunk.js")).toBe(false);
    expect(re.test("/jelly.png")).toBe(false);
    expect(re.test("/app")).toBe(true);
  });
});
