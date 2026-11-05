import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = { exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const ensureSelfServeWorkspace = vi.fn();
const getLanding = vi.fn();
vi.mock("@/lib/queries/auth", () => ({
  ensureSelfServeWorkspace: (...a: unknown[]) => ensureSelfServeWorkspace(...a),
  getLanding: (...a: unknown[]) => getLanding(...a),
}));

// The request's cookies, as next/headers would expose them inside a route handler.
let jar = new Map<string, string>();
const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ has: (n: string) => jar.has(n), set: (...a: unknown[]) => cookieSet(...a) }),
}));

const { GET } = await import("@/app/auth/callback/route");

const call = async (qs: string, cookie?: string) => {
  jar = new Map(cookie ? [cookie.split("=") as [string, string]] : []);
  const res = await GET(
    new NextRequest(`http://localhost:3000/auth/callback${qs}`, { headers: cookie ? { cookie } : {} }),
  );
  expect(res.status).toBe(307);
  const loc = new URL(res.headers.get("location")!);
  expect(loc.origin).toBe("http://localhost:3000");
  return loc.pathname + loc.search;
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://sb.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.clearAllMocks();
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  ensureSelfServeWorkspace.mockResolvedValue("ws-1");
  getLanding.mockResolvedValue("onboarding");
});

describe("/auth/callback", () => {
  it.each([["NEXT_PUBLIC_SUPABASE_URL"], ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]])(
    "sends to /signin?error=config instead of a 500 when %s is missing",
    async (name) => {
      vi.stubEnv(name, "");
      expect(await call("?code=abc&next=%2Fapp%2Fbilling")).toBe("/signin?error=config");
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    },
  );

  it("exchanges a code, makes the self-serve workspace, then routes by landing", async () => {
    expect(await call("?code=abc")).toBe("/app/onboarding");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(ensureSelfServeWorkspace).toHaveBeenCalledTimes(1);
    expect(ensureSelfServeWorkspace.mock.invocationCallOrder[0]).toBeLessThan(getLanding.mock.invocationCallOrder[0]);
  });

  it.each([
    ["team", "/team"],
    ["dfy_client", "/client"],
    ["onboarding", "/app/onboarding"],
    ["dashboard", "/app"],
  ])("sends %s to %s", async (landing, path) => {
    getLanding.mockResolvedValue(landing);
    expect(await call("?code=abc")).toBe(path);
  });

  it("verifies an email token_hash link", async () => {
    getLanding.mockResolvedValue("dashboard");
    expect(await call("?token_hash=th&type=magiclink")).toBe("/app");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "th", type: "magiclink" });
  });

  it("honors a safe next and drops an unsafe one", async () => {
    expect(await call("?code=abc&next=%2Fapp%2Fbilling")).toBe("/app/billing");
    expect(await call("?code=abc&next=%2F%2Fevil.com")).toBe("/app/onboarding");
  });

  it("sends a Google failure back to /signin with the google error and the next path", async () => {
    expect(await call("?error=access_denied&next=%2Fapp%2Fbilling")).toBe("/signin?error=google&next=%2Fapp%2Fbilling");
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    expect(await call("?code=abc")).toBe("/signin?error=google");
    expect(ensureSelfServeWorkspace).not.toHaveBeenCalled();
  });

  // Step 12 (lead): a client invite link is type invite.
  it.each(["magiclink", "signup", "email", "invite"])("verifies a token_hash link of type %s", async (type) => {
    expect(await call(`?token_hash=th&type=${type}`)).toBe("/app/onboarding");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "th", type });
  });

  it("sends an expired or used email link back with the link error", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    expect(await call("?token_hash=th&type=magiclink")).toBe("/signin?error=link");
  });

  it.each(["?token_hash=th&type=bogus", "?token_hash=th&type=recovery", "?token_hash=th", "?type=magiclink"])(
    "rejects %s with the link error, without verifying",
    async (qs) => {
      expect(await call(qs)).toBe("/signin?error=link");
      expect(auth.verifyOtp).not.toHaveBeenCalled();
    },
  );

  it("shows the link banner, never the Google one, when there is no code and no token_hash", async () => {
    // e.g. an old implicit-flow link: the tokens are in the #fragment, which never reaches the server.
    expect(await call("")).toBe("/signin?error=link");
    expect(await call("?next=%2Fapp%2Fbilling")).toBe("/signin?error=link&next=%2Fapp%2Fbilling");
  });

  it("takes next from the sign-in cookie for email links, and clears it", async () => {
    expect(await call("?token_hash=th&type=magiclink", "rank1_next=%2Fapp%2Fbilling")).toBe("/app/billing");
    expect(cookieSet).toHaveBeenCalledWith("rank1_next", "", { path: "/auth", maxAge: 0 });
  });

  it("leaves cookies alone when there is no next cookie", async () => {
    await call("?code=abc");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("ignores an unsafe next in the cookie", async () => {
    expect(await call("?token_hash=th&type=magiclink", "rank1_next=%2F%2Fevil.com")).toBe("/app/onboarding");
  });

  it("does not leave the user stranded when the workspace call fails", async () => {
    ensureSelfServeWorkspace.mockRejectedValue(new Error("db down"));
    expect(await call("?code=abc")).toBe("/signin?error=google");
  });
});
