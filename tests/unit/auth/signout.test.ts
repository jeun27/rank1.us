import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }) }));
const { POST } = await import("@/app/auth/signout/route");

const post = (headers: Record<string, string | undefined>) =>
  POST(
    new NextRequest("http://localhost:3000/auth/signout", {
      method: "POST",
      headers: headers as Record<string, string>,
    }),
  );

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://sb.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  signOut.mockReset();
});

describe("POST /auth/signout", () => {
  it("sends to /signin?error=config instead of a 500 when the Supabase env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await post({ "sec-fetch-site": "same-origin" });
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname + to.search).toBe("/signin?error=config");
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([{ "sec-fetch-site": "same-origin" }, { origin: "http://localhost:3000" }])(
    "signs out a same-origin request (%o) and goes to /signin",
    async (h) => {
      const res = await post(h);
      expect(res.status).toBe(303);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/signin");
      expect(signOut).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { "sec-fetch-site": "cross-site", origin: "https://evil.test" },
    { origin: "https://evil.test" },
    { "sec-fetch-site": "same-site", origin: "https://www.localhost:3000" },
    {},
  ])("refuses a cross-site or unmarked request (%o)", async (h) => {
    const res = await post(h);
    expect(res.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });
});
