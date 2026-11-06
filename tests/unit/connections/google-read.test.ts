import { describe, expect, it, vi } from "vitest";
import "./no-live";
import { listGa4Properties } from "@/lib/connections/ga4";
import { GoogleApiError } from "@/lib/connections/google-api";
import { listSites } from "@/lib/connections/search-console";
import * as fx from "../../fixtures/google";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Search Console", () => {
  it("lists sites with their permission; unverified sites have no read access", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(fx.sites));
    expect(await listSites("ya29.example", { fetch })).toEqual([
      { siteUrl: "https://example.com/", permissionLevel: "siteOwner", readable: true },
      { siteUrl: "sc-domain:example.com", permissionLevel: "siteFullUser", readable: true },
      { siteUrl: "https://example.net/", permissionLevel: "siteUnverifiedUser", readable: false },
    ]);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/webmasters/v3/sites");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer ya29.example");
    expect(init!.method).toBe("GET");
  });

  it("no sites → empty; an API error keeps only the status", async () => {
    expect(await listSites("t", { fetch: vi.fn(async () => json({})) })).toEqual([]);
    const err = await listSites("t", { fetch: vi.fn(async () => json({ error: { message: "x" } }, 401)) }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.status).toBe(401);
  });
});

describe("GA4 shell", () => {
  it("flattens account summaries into a property picker", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(fx.accountSummaries));
    expect(await listGa4Properties("t", { fetch })).toEqual([
      { property: "properties/400000001", displayName: "example.com", account: "Example Ramen House" },
    ]);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
    );
  });
});

describe("no live Google calls", () => {
  it("the global fetch is blocked in these tests", async () => {
    await expect(fetch("https://mybusinessbusinessinformation.googleapis.com/v1/locations/1")).rejects.toThrow(
      "live call blocked: mybusinessbusinessinformation.googleapis.com",
    );
  });
});
