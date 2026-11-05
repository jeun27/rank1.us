import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let claims: { sub: string; email?: string } | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) } }),
}));

const { proxy } = await import("@/proxy");
const req = (path: string, method = "GET") => new NextRequest(`http://localhost:3000${path}`, { method });
const is404 = (res: Response) => {
  expect(res.status).toBe(404);
  expect(res.headers.get("x-middleware-rewrite")).toMatch(/\/404$/);
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://sb.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("FOUNDER_EMAIL", "founder@example.test");
  claims = null;
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy on /admin", () => {
  it.each(["/admin", "/admin/test"])("404s a signed-out visitor of %s (no redirect to sign-in)", async (p) => {
    is404(await proxy(req(p)));
  });

  it("404s another user, including the server action POST", async () => {
    claims = { sub: "u1", email: "owner@example.test" };
    is404(await proxy(req("/admin/test")));
    is404(await proxy(req("/admin/test", "POST")));
  });

  it("404s everyone while FOUNDER_EMAIL is unset", async () => {
    vi.stubEnv("FOUNDER_EMAIL", "");
    claims = { sub: "u1", email: "founder@example.test" };
    is404(await proxy(req("/admin/test")));
  });

  it("404s when Supabase isn't connected", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    is404(await proxy(req("/admin/test")));
  });

  it("lets the founder through", async () => {
    claims = { sub: "u1", email: "FOUNDER@example.test" };
    const res = await proxy(req("/admin/test"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("leaves look-alike paths alone", async () => {
    expect((await proxy(req("/administrator"))).status).toBe(200);
  });
});
