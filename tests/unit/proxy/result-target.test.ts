import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resultTarget } from "@/lib/supabase/middleware";

const lookups: string[] = [];
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ in: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    }),
  }),
}));
// The lead lookup: only the exact token "AbC-dEf_123" exists.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, token: string) => ({
          maybeSingle: async () => {
            lookups.push(token);
            return { data: token === "AbC-dEf_123" ? { run_id: "r1" } : null, error: null };
          },
        }),
      }),
    }),
  }),
}));

afterEach(() => {
  lookups.length = 0;
  vi.unstubAllEnvs();
});

describe("resultTarget: route from the normalized path, key from the raw one", () => {
  it("keeps a mixed-case base64url token exactly as written", () => {
    expect(resultTarget("/audit/AbC-dEf_123")).toEqual({ kind: "audit", key: "AbC-dEf_123" });
    expect(resultTarget("/Audit//AbC-dEf_123/")).toEqual({ kind: "audit", key: "AbC-dEf_123" });
    expect(resultTarget("/app/runs/0F2c-Run")).toEqual({ kind: "run", key: "0F2c-Run" });
  });

  it("ignores the exports and other paths", () => {
    expect(resultTarget("/audit/AbC/export.csv")).toBeNull();
    expect(resultTarget("/app/runs")).toBeNull();
    expect(resultTarget("/")).toBeNull();
  });
});

describe("proxy: /audit/<token>", () => {
  const run = async (path: string) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const { updateSession } = await import("@/lib/supabase/middleware");
    return updateSession(new NextRequest(new URL(path, "http://localhost:3000")));
  };

  it("a real mixed-case token reaches the page (it is looked up as written, not lowercased)", async () => {
    const res = await run("/audit/AbC-dEf_123");
    expect(res.status).not.toBe(404);
    expect(lookups).toEqual(["AbC-dEf_123"]);
  });

  it("an unknown token is a real 404", async () => {
    expect((await run("/audit/not-a-token")).status).toBe(404);
  });
});

// Step 11: /team?b=<id> streams too, so an unknown or non-DFY client must 404 before the page sends a 200.
describe("teamClient: the ?b= of /team", () => {
  it("returns the client id of /team only", async () => {
    const { teamClient } = await import("@/lib/supabase/middleware");
    expect(teamClient("/team", new URLSearchParams("b=abc-123"))).toBe("abc-123");
    expect(teamClient("/Team/", new URLSearchParams("b=abc-123"))).toBe("abc-123");
    expect(teamClient("/team", new URLSearchParams(""))).toBeNull();
    expect(teamClient("/team", new URLSearchParams("b="))).toBeNull();
    expect(teamClient("/app", new URLSearchParams("b=abc-123"))).toBeNull();
  });
});
