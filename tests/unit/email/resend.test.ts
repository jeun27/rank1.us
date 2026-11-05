import { afterEach, describe, expect, it, vi } from "vitest";
import { contactEmail, RESEND_URL, sendEmail } from "@/lib/email/resend";

const visitor = { name: "Ana Example", email: "visitor@example.test", company: "Example Ramen Co", tier: "Agency bundle" as const, message: "Hello\nthere" };
const env = { CONTACT_FROM_EMAIL: "from@example.test", CONTACT_TO_EMAIL: "to@example.test" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("contactEmail", () => {
  it("goes to CONTACT_TO_EMAIL from CONTACT_FROM_EMAIL, with the visitor as reply_to", () => {
    expect(contactEmail(visitor, env)).toEqual({
      from: "from@example.test",
      to: "to@example.test",
      reply_to: "visitor@example.test",
      subject: "Contact us: Agency bundle from Example Ramen Co",
      text: "Name: Ana Example\nEmail: visitor@example.test\nCompany: Example Ramen Co\nTier: Agency bundle\n\nHello\nthere",
    });
  });
  it("uses the name when there is no company", () => {
    expect(contactEmail({ ...visitor, company: null }, env)?.subject).toBe("Contact us: Agency bundle from Ana Example");
  });
  it("is null when either address is missing", () => {
    expect(contactEmail(visitor, { CONTACT_TO_EMAIL: "to@example.test" })).toBeNull();
    expect(contactEmail(visitor, { CONTACT_FROM_EMAIL: "from@example.test" })).toBeNull();
  });
});

describe("sendEmail", () => {
  const email = contactEmail(visitor, env)!;

  it("POSTs the payload to Resend with the bearer key and an idempotency key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ id: "49a3999c" }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendEmail(email, "contact-1")).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(RESEND_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ authorization: "Bearer re_test_key", "content-type": "application/json", "idempotency-key": "contact-1" });
    expect(JSON.parse(init?.body as string)).toEqual(email);
  });

  it("returns false on a Resend error or network error, and logs no addresses or message", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "bad" }, { status: 422 })));
    expect(await sendEmail(email, "contact-1")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await sendEmail(email, "contact-1")).toBe(false);
    const logged = JSON.stringify(log.mock.calls);
    for (const secret of ["visitor@example.test", "from@example.test", "to@example.test", "Hello", "re_test_key"]) expect(logged).not.toContain(secret);
  });

  it("does not call Resend without RESEND_API_KEY", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await sendEmail(email, "contact-1")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
