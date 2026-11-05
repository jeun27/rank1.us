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

const { GET } = await import("@/app/auth/callback/route");

const call = async (qs: string) => {
  const res = await GET(new NextRequest(`http://localhost:3000/auth/callback${qs}`));
  expect(res.status).toBe(307);
  const loc = new URL(res.headers.get("location")!);
  expect(loc.origin).toBe("http://localhost:3000");
  return loc.pathname + loc.search;
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  ensureSelfServeWorkspace.mockResolvedValue("ws-1");
  getLanding.mockResolvedValue("onboarding");
});

describe("/auth/callback", () => {
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

  it("sends an email-link failure back with the link error", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    expect(await call("?code=abc&via=email")).toBe("/signin?error=link");
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    expect(await call("?token_hash=th&type=magiclink")).toBe("/signin?error=link");
    expect(await call("?token_hash=th&type=bogus")).toBe("/signin?error=link");
  });

  it("does not leave the user stranded when the workspace call fails", async () => {
    ensureSelfServeWorkspace.mockRejectedValue(new Error("db down"));
    expect(await call("?code=abc")).toBe("/signin?error=google");
  });
});
