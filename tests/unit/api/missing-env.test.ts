import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as auditPOST } from "@/app/api/audit/request/route";
import { POST as contactPOST } from "@/app/api/contact/route";

// The real service client (not mocked) with no Supabase env: both routes fail the same clean way.
const IP = "203.0.113.7";
const contact = { name: "Ana Example", email: "visitor@example.test", industry: "Restaurant", tier: "Other", message: "Secret message", "cf-turnstile-response": "tok", website: "" };
const audit = { email: "owner@example.test", domain: "ramenhouse.com", "cf-turnstile-response": "tok", website: "" };
const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(new Request("http://localhost/api", { method: "POST", headers: { "x-forwarded-for": IP }, body: JSON.stringify(body) }));

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.stubEnv("IP_HASH_SALT", "salt");
  vi.stubEnv("AUDIT_DAILY_LIMIT", "10");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true })));
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("missing Supabase env", () => {
  it.each([
    ["/api/contact", contactPOST, contact],
    ["/api/audit/request", auditPOST, audit],
  ])("%s returns 500 {error: 'server'} and logs only an error code", async (_name, handler, body) => {
    const res = await post(handler, body);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server" });
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]).toHaveLength(1);
    expect(log.mock.calls[0][0]).toMatch(/^[a-z /]+: [a-z ]+$/);
    const logged = JSON.stringify(log.mock.calls);
    for (const s of ["visitor@example.test", "owner@example.test", "Secret message", IP, "supabase"]) expect(logged).not.toContain(s);
  });
});
