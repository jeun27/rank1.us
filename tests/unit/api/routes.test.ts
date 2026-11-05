import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route order and storage, with the query layer mocked and Turnstile/Resend mocked at fetch.
const q = vi.hoisted(() => ({
  countRecentContactRequests: vi.fn(),
  insertContactRequest: vi.fn(),
  markContactRequestEmailed: vi.fn(),
  countLeadsSince: vi.fn(),
  insertLead: vi.fn(),
}));
vi.mock("@/lib/queries/contactRequests", async (real) => ({ ...(await real<object>()), ...q }));
vi.mock("@/lib/queries/leads", () => q);
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
// after() needs a Next request scope; run the callback inline so the audit start is observable.
const auditService = vi.hoisted(() => ({ startFreeAuditWith: vi.fn(async () => "run-1") }));
vi.mock("@/lib/audit/service", () => auditService);
const afterImpl = vi.hoisted(() => ({ fn: (task: () => unknown) => void task() }));
vi.mock("next/server", async (real) => ({
  ...(await real<object>()),
  after: (task: () => unknown) => afterImpl.fn(task),
}));

import { POST as contactPOST } from "@/app/api/contact/route";
import { POST as auditPOST } from "@/app/api/audit/request/route";

const contact = {
  name: "Ana Example",
  email: "visitor@example.test",
  company: "Example Ramen Co",
  industry: "Other",
  industry_other: "Pool service",
  tier: "Other",
  message: "Secret message",
  "cf-turnstile-response": "tok",
  website: "",
};
const audit = {
  email: "owner@example.test",
  domain: "https://www.RamenHouse.com/",
  "cf-turnstile-response": "tok",
  website: "",
};
const IP = "203.0.113.7";

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "x-forwarded-for": IP, "user-agent": "vitest" },
      body: JSON.stringify(body),
    }),
  );

let turnstileOk = true;
let resendOk = true;
let fetchMock: ReturnType<typeof vi.fn>;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("CONTACT_FROM_EMAIL", "from@example.test");
  vi.stubEnv("CONTACT_TO_EMAIL", "to@example.test");
  vi.stubEnv("IP_HASH_SALT", "salt");
  vi.stubEnv("AUDIT_DAILY_LIMIT", "2");
  turnstileOk = true;
  resendOk = true;
  fetchMock = vi.fn(async (url: string) =>
    url.includes("challenges.cloudflare.com")
      ? Response.json({ success: turnstileOk })
      : resendOk
        ? Response.json({ id: "email-1" })
        : Response.json({ message: "down" }, { status: 500 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  for (const f of Object.values(q)) f.mockReset();
  q.countRecentContactRequests.mockResolvedValue(0);
  q.insertContactRequest.mockResolvedValue("row-1");
  q.countLeadsSince.mockResolvedValue(0);
  q.insertLead.mockResolvedValue("lead-1");
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // Nothing personal is ever logged.
  const logged = JSON.stringify(log.mock.calls);
  for (const s of ["visitor@example.test", "owner@example.test", "Secret message", IP]) expect(logged).not.toContain(s);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const calledHosts = () => fetchMock.mock.calls.map(([u]) => new URL(u as string).host);

describe("POST /api/contact", () => {
  it("stores the row with a hashed IP, emails it, then marks it emailed", async () => {
    const res = await post(contactPOST, contact);
    expect(res.status).toBe(200);
    expect(calledHosts()).toEqual(["challenges.cloudflare.com", "api.resend.com"]);
    const row = q.insertContactRequest.mock.calls[0][1];
    expect(row).toMatchObject({
      name: "Ana Example",
      email: "visitor@example.test",
      company: "Example Ramen Co",
      industry: "Other",
      industry_other: "Pool service",
      tier: "Other",
      message: "Secret message",
      user_agent: "vitest",
    });
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sent.text).toContain("Industry: Other – Pool service");
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(IP);
    expect(q.countRecentContactRequests.mock.calls[0][1]).toBe(row.ip_hash);
    const since: Date = q.countRecentContactRequests.mock.calls[0][2];
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(3_600_000 - 1000);
    expect(Date.now() - since.getTime()).toBeLessThanOrEqual(3_600_000 + 1000);
    expect(q.markContactRequestEmailed).toHaveBeenCalledWith({}, "row-1");
  });

  it("400 when industry is missing, not an option, or Other text breaks the rules", async () => {
    for (const bad of [
      { industry: "" },
      { industry: "Dental" },
      { industry: "HVAC", industry_other: "Pool" },
      { industry_other: "x".repeat(61) },
    ]) {
      const res = await post(contactPOST, { ...contact, ...bad });
      expect(res.status).toBe(400);
    }
    expect(q.insertContactRequest).not.toHaveBeenCalled();
  });

  it("400 with field names on bad input, before anything else", async () => {
    const res = await post(contactPOST, { ...contact, email: "nope", tier: "$500 plan", website: "spam" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ errors: ["email", "tier"] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q.insertContactRequest).not.toHaveBeenCalled();
    expect((await contactPOST(new Request("http://localhost/api", { method: "POST", body: "nope" }))).status).toBe(400);
  });

  it("honeypot filled: 200, stores nothing, sends nothing", async () => {
    const res = await post(contactPOST, { ...contact, website: "http://spam.test" });
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q.countRecentContactRequests).not.toHaveBeenCalled();
    expect(q.insertContactRequest).not.toHaveBeenCalled();
  });

  it("Turnstile failure: 403, stores nothing", async () => {
    turnstileOk = false;
    const res = await post(contactPOST, contact);
    expect(res.status).toBe(403);
    expect(calledHosts()).toEqual(["challenges.cloudflare.com"]);
    expect(q.insertContactRequest).not.toHaveBeenCalled();
  });

  it("4th request in the hour: 429, stores nothing", async () => {
    q.countRecentContactRequests.mockResolvedValue(3);
    const res = await post(contactPOST, contact);
    expect(res.status).toBe(429);
    expect(q.insertContactRequest).not.toHaveBeenCalled();
    q.countRecentContactRequests.mockResolvedValue(2);
    expect((await post(contactPOST, contact)).status).toBe(200);
  });

  it("Resend failure: keeps the row with emailed=false and returns the error state", async () => {
    resendOk = false;
    const res = await post(contactPOST, contact);
    expect(res.status).toBe(502);
    expect(q.insertContactRequest).toHaveBeenCalledOnce();
    expect(q.insertContactRequest.mock.calls[0][1]).not.toHaveProperty("emailed", true);
    expect(q.markContactRequestEmailed).not.toHaveBeenCalled();
  });

  it("missing IP_HASH_SALT or a DB error: 500, no email", async () => {
    vi.stubEnv("IP_HASH_SALT", "");
    expect((await post(contactPOST, contact)).status).toBe(500);
    vi.stubEnv("IP_HASH_SALT", "salt");
    q.insertContactRequest.mockRejectedValue(new Error("db down"));
    expect((await post(contactPOST, contact)).status).toBe(500);
    expect(calledHosts()).not.toContain("api.resend.com");
  });
});

describe("POST /api/audit/request", () => {
  it("still answers 202 when after() can't schedule the audit (no request scope), and logs it", async () => {
    const real = afterImpl.fn;
    afterImpl.fn = () => {
      throw new Error("`after` was called outside a request scope");
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await post(auditPOST, audit);
      expect(res.status).toBe(202);
      expect(q.insertLead).toHaveBeenCalled();
      expect(auditService.startFreeAuditWith).not.toHaveBeenCalled();
      expect(err).toHaveBeenCalledWith("audit request: free audit not scheduled");
    } finally {
      afterImpl.fn = real;
      err.mockRestore();
    }
  });

  it("202 queued, inserts a lead with the normalized domain, hashed IP and a random token", async () => {
    const res = await post(auditPOST, audit);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "queued" });
    expect(calledHosts()).toEqual(["challenges.cloudflare.com"]);
    const row = q.insertLead.mock.calls[0][1];
    expect(row).toMatchObject({ email: "owner@example.test", domain: "ramenhouse.com" });
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await post(auditPOST, audit);
    expect(q.insertLead.mock.calls[1][1].token).not.toBe(row.token);
    expect(auditService.startFreeAuditWith).toHaveBeenCalledWith(expect.anything(), {
      id: "lead-1",
      domain: "ramenhouse.com",
    });
    const since: Date = q.countLeadsSince.mock.calls[0][1];
    expect(since.getUTCHours() + since.getUTCMinutes() + since.getUTCSeconds()).toBe(0);
  });

  it("400 on a domain without an ending", async () => {
    const res = await post(auditPOST, { ...audit, domain: "ramenhouse" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ errors: ["domain"] });
    expect(q.insertLead).not.toHaveBeenCalled();
  });

  it("honeypot: 202 queued but stores nothing", async () => {
    const res = await post(auditPOST, { ...audit, website: "x" });
    expect(res.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q.insertLead).not.toHaveBeenCalled();
  });

  it("Turnstile failure: 403", async () => {
    turnstileOk = false;
    expect((await post(auditPOST, audit)).status).toBe(403);
    expect(q.insertLead).not.toHaveBeenCalled();
  });

  it("AUDIT_DAILY_LIMIT reached: 429; unset: 500", async () => {
    q.countLeadsSince.mockResolvedValue(2);
    expect((await post(auditPOST, audit)).status).toBe(429);
    vi.stubEnv("AUDIT_DAILY_LIMIT", "");
    q.countLeadsSince.mockResolvedValue(0);
    expect((await post(auditPOST, audit)).status).toBe(500);
    expect(q.insertLead).not.toHaveBeenCalled();
  });
});
