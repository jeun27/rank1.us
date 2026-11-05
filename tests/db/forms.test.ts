import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as auditPOST } from "@/app/api/audit/request/route";
import { POST as contactPOST } from "@/app/api/contact/route";
import { hashIp } from "@/lib/spam/ipHash";
import { apiUrl, must, serviceClient } from "./helpers";

// The real routes against local Supabase. Turnstile and Resend are mocked at fetch; Supabase calls pass through.
const realFetch = globalThis.fetch;
let resendOk = true;
const thirdParty: string[] = [];

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", apiUrl());
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY!);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("CONTACT_FROM_EMAIL", "from@example.test");
  vi.stubEnv("CONTACT_TO_EMAIL", "to@example.test");
  vi.stubEnv("IP_HASH_SALT", `salt-${randomUUID()}`);
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.host === "challenges.cloudflare.com" || url.host === "api.resend.com") {
      thirdParty.push(url.host);
      if (url.host === "challenges.cloudflare.com") return Response.json({ success: true });
      return resendOk ? Response.json({ id: "email-1" }) : Response.json({ message: "down" }, { status: 500 });
    }
    return realFetch(input, init);
  });
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  resendOk = true;
  thirdParty.length = 0;
});

// A fresh documentation-range IP per test keeps rate-limit counts apart.
const newIp = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 8)}`;
const post = (handler: (r: Request) => Promise<Response>, ip: string, body: unknown) =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );

const contact = (tag: string) => ({
  name: "Ana Example",
  email: `${tag}@example.test`,
  company: "Example Ramen Co",
  industry: "Restaurant",
  tier: "Agency bundle",
  message: "Example data",
  "cf-turnstile-response": "tok",
  website: "",
});

const rowsFor = async (ip: string) =>
  must(await serviceClient().from("contact_requests").select("*").eq("ip_hash", hashIp(ip)).order("created_at"));

describe("POST /api/contact (local Supabase)", () => {
  it("stores a row with emailed=true after Resend succeeds", async () => {
    const ip = newIp();
    const res = await post(contactPOST, ip, contact(randomUUID()));
    expect(res.status).toBe(200);
    const rows = await rowsFor(ip);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Ana Example",
      company: "Example Ramen Co",
      industry: "Restaurant",
      industry_other: null,
      tier: "Agency bundle",
      emailed: true,
    });
    expect(thirdParty).toEqual(["challenges.cloudflare.com", "api.resend.com"]);
  });

  it("stores industry Other with its text", async () => {
    const ip = newIp();
    expect(
      (await post(contactPOST, ip, { ...contact(randomUUID()), industry: "Other", industry_other: "Pool service" }))
        .status,
    ).toBe(200);
    expect((await rowsFor(ip))[0]).toMatchObject({ industry: "Other", industry_other: "Pool service" });
  });

  it("keeps the row with emailed=false when Resend fails", async () => {
    const ip = newIp();
    resendOk = false;
    expect((await post(contactPOST, ip, contact(randomUUID()))).status).toBe(502);
    const rows = await rowsFor(ip);
    expect(rows).toHaveLength(1);
    expect(rows[0].emailed).toBe(false);
  });

  it("the 4th request from one IP within an hour gets 429 and is not stored", async () => {
    const ip = newIp();
    for (let i = 0; i < 3; i++) expect((await post(contactPOST, ip, contact(randomUUID()))).status).toBe(200);
    expect((await post(contactPOST, ip, contact(randomUUID()))).status).toBe(429);
    expect(await rowsFor(ip)).toHaveLength(3);
    // Another IP is not affected.
    expect((await post(contactPOST, newIp(), contact(randomUUID()))).status).toBe(200);
  });

  it("rows older than an hour do not count", async () => {
    const ip = newIp();
    const old = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    must(
      await serviceClient()
        .from("contact_requests")
        .insert(
          [1, 2, 3].map(() => ({
            name: "Old",
            email: "old@example.test",
            industry: "Restaurant",
            ip_hash: hashIp(ip),
            created_at: old,
          })),
        ),
    );
    expect((await post(contactPOST, ip, contact(randomUUID()))).status).toBe(200);
  });

  it("honeypot stores nothing", async () => {
    const ip = newIp();
    expect((await post(contactPOST, ip, { ...contact(randomUUID()), website: "spam" })).status).toBe(200);
    expect(await rowsFor(ip)).toHaveLength(0);
    expect(thirdParty).toEqual([]);
  });
});

describe("POST /api/audit/request (local Supabase)", () => {
  it("inserts a leads row and answers 202 queued", async () => {
    const { count } = await serviceClient().from("leads").select("id", { count: "exact", head: true });
    vi.stubEnv("AUDIT_DAILY_LIMIT", String((count ?? 0) + 1000));
    const ip = newIp();
    const email = `${randomUUID()}@example.test`;
    const res = await post(auditPOST, ip, {
      email,
      domain: "https://www.RamenHouse.com/menu",
      "cf-turnstile-response": "tok",
      website: "",
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "queued" });
    const rows = must(await serviceClient().from("leads").select("*").eq("email", email));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ domain: "ramenhouse.com", ip_hash: hashIp(ip), run_id: null });
    expect(rows[0].token.length).toBeGreaterThanOrEqual(43);
  });

  it("429 once today's leads reach AUDIT_DAILY_LIMIT", async () => {
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const { count } = await serviceClient()
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", midnight.toISOString());
    vi.stubEnv("AUDIT_DAILY_LIMIT", String(count ?? 0));
    const email = `${randomUUID()}@example.test`;
    const res = await post(auditPOST, newIp(), {
      email,
      domain: "ramenhouse.com",
      "cf-turnstile-response": "tok",
      website: "",
    });
    expect(res.status).toBe(429);
    expect(must(await serviceClient().from("leads").select("id").eq("email", email))).toHaveLength(0);
  });
});
