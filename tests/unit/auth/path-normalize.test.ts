import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { normalizePath } from "@/lib/auth/path";

let claims: { sub: string; email?: string } | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) } }),
}));
const { proxy } = await import("@/proxy");

const req = (path: string) => new NextRequest(`http://localhost:3000${path}`);
const is404 = (res: Response) => {
  expect(res.status).toBe(404);
  expect(res.headers.get("x-middleware-rewrite")).toMatch(/\/404$/);
};
const toSignIn = (res: Response) => {
  expect(res.status).toBe(307);
  expect(new URL(res.headers.get("location")!).pathname).toBe("/signin");
};

describe("normalizePath", () => {
  it.each([
    ["/%61dmin/test", "/admin/test"],
    ["/admin%2Ftest", "/admin/test"],
    ["/admin%252Ftest", "/admin/test"],
    ["//admin", "/admin"],
    ["/./admin", "/admin"],
    ["/ADMIN", "/admin"],
    ["/x/%2e%2e/admin", "/admin"],
    ["/x/../admin/./test/", "/admin/test"],
    ["/admin%5Ctest", "/admin/test"],
    ["/", "/"],
    ["/contact", "/contact"],
  ])("%s → %s", (raw, out) => {
    expect(normalizePath(raw)).toBe(out);
  });

  it.each(["/%", "/admin%E0%A4%A", "/%zz"])("malformed %s → null", (raw) => {
    expect(normalizePath(raw)).toBeNull();
  });
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://sb.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("FOUNDER_EMAIL", "founder@example.test");
  claims = null;
});
afterEach(() => vi.unstubAllEnvs());

const ADMIN = [
  "/%61dmin/test",
  "/admin%2Ftest",
  "/admin%252ftest",
  "//admin",
  "//admin/test",
  "/./admin",
  "/ADMIN",
  "/Admin/Test",
  "/x/%2e%2e/admin/test",
  "/%2e/admin",
];

describe("proxy: encoded /admin paths", () => {
  it.each(ADMIN)("404s %s for a signed-out visitor", async (p) => {
    is404(await proxy(req(p)));
  });

  it.each(ADMIN)("404s %s for another user", async (p) => {
    claims = { sub: "u1", email: "owner@example.test" };
    is404(await proxy(req(p)));
  });

  it("404s a query-string variant (/ADMIN?x=1) and malformed encodings", async () => {
    is404(await proxy(req("/ADMIN?x=1")));
    for (const p of ["/%", "/admin%E0%A4%A", "/%zz/test"]) is404(await proxy(req(p)));
  });

  it("404s encoded /admin when Supabase isn't connected", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    for (const p of ADMIN) is404(await proxy(req(p)));
  });

  it("lets the founder through on an encoded path too (the page gate still applies)", async () => {
    claims = { sub: "u1", email: "founder@example.test" };
    expect((await proxy(req("/%61dmin/test"))).status).toBe(200);
  });
});

describe.each(["/app", "/team", "/client"])("proxy: encoded %s paths", (area) => {
  const a = area.slice(1);
  const variants = [
    `/%${a.charCodeAt(0).toString(16)}${a.slice(1)}`,
    `/${a}%2Fbilling`,
    `/${a}%252Fx`,
    `//${a}`,
    `/./${a}`,
    `/${a.toUpperCase()}`,
    `/x/%2e%2e/${a}`,
  ];

  it.each(variants)("sends a signed-out %s to /signin", async (p) => {
    toSignIn(await proxy(req(p)));
  });

  it.each(variants)("sends %s to /signin while Supabase isn't connected", async (p) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    toSignIn(await proxy(req(p)));
  });
});

describe("public paths are untouched", () => {
  it.each(["/", "/contact", "/application", "/teams", "/clientele", "/administrator"])("%s passes", async (p) => {
    expect((await proxy(req(p))).status).toBe(200);
  });
});
