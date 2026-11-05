import { describe, expect, it } from "vitest";
import { INDUSTRIES, normalizeDomain, TIERS, validateAudit, validateContact } from "@/lib/spam/validate";

describe("normalizeDomain", () => {
  it.each([
    ["ramenhouse.com", "ramenhouse.com"],
    ["  RamenHouse.COM ", "ramenhouse.com"],
    ["https://www.ramenhouse.com/menu?x=1#top", "ramenhouse.com"],
    ["http://ramen-house.co.uk:8080/", "ramen-house.co.uk"],
    ["ramenhouse.com.", "ramenhouse.com"],
  ])("%s -> %s", (raw, want) => expect(normalizeDomain(raw)).toBe(want));

  it.each(["ramenhouse", "", "   ", "ramen house.com", "-ramen.com", "ramen.c", "ramen.123", "a..com", "@.com", undefined, 42])(
    "rejects %s",
    (raw) => expect(normalizeDomain(raw)).toBeNull(),
  );
});

describe("validateAudit", () => {
  it("accepts and normalizes", () => {
    expect(validateAudit({ email: " owner@ramenhouse.com ", domain: "www.RamenHouse.com" })).toEqual({
      ok: true,
      data: { email: "owner@ramenhouse.com", domain: "ramenhouse.com" },
    });
  });
  it("names each bad field", () => {
    expect(validateAudit({ email: "nope", domain: "ramenhouse" })).toEqual({ ok: false, errors: ["email", "domain"] });
    expect(validateAudit({})).toEqual({ ok: false, errors: ["email", "domain"] });
  });
});

describe("validateContact", () => {
  const good = { name: "Ana Example", email: "ana@example.test", company: "Example Ramen Co", industry: "Restaurant", tier: "Agency bundle", message: "Hi\nthere" };

  it("accepts a full form and keeps message newlines", () => {
    const r = validateContact(good);
    expect(r).toEqual({ ok: true, data: { ...good, industry_other: null, message: "Hi\nthere" } });
  });
  it("industry (Jeun #22): required, exactly the six options, no dental, no dollar amounts", () => {
    expect(INDUSTRIES).toEqual(["Restaurant", "HVAC", "Plumbing", "Roofing", "Pest control", "Other"]);
    for (const i of INDUSTRIES) expect(i).not.toMatch(/\$|\d|dental/i);
    for (const i of INDUSTRIES) expect(validateContact({ ...good, industry: i }).ok).toBe(true);
    const { industry: _drop, ...noIndustry } = good;
    void _drop;
    expect(validateContact(noIndustry)).toEqual({ ok: false, errors: ["industry"] });
    expect(validateContact({ ...good, industry: "" })).toEqual({ ok: false, errors: ["industry"] });
    expect(validateContact({ ...good, industry: "Dental" })).toEqual({ ok: false, errors: ["industry"] });
  });
  it("Other text: optional, up to 60 characters, only with Other", () => {
    const other = validateContact({ ...good, industry: "Other", industry_other: "  Pool service " });
    expect(other.ok && other.data.industry_other).toBe("Pool service");
    const blank = validateContact({ ...good, industry: "Other", industry_other: "  " });
    expect(blank.ok && blank.data.industry_other).toBeNull();
    expect(validateContact({ ...good, industry: "Other", industry_other: "x".repeat(60) }).ok).toBe(true);
    expect(validateContact({ ...good, industry: "Other", industry_other: "x".repeat(61) })).toEqual({ ok: false, errors: ["industry_other"] });
    expect(validateContact({ ...good, industry: "HVAC", industry_other: "Pool service" })).toEqual({ ok: false, errors: ["industry_other"] });
  });
  it("company is optional (stored as null) and never an error: over 100 characters is cut", () => {
    const r = validateContact({ ...good, company: "  " });
    expect(r.ok && r.data.company).toBeNull();
    const long = validateContact({ ...good, company: "x".repeat(150) });
    expect(long.ok && long.data.company).toBe("x".repeat(100));
  });
  it("collapses newlines in single-line fields", () => {
    const r = validateContact({ ...good, name: "Ana\r\nBcc: x" });
    expect(r.ok && r.data.name).toBe("Ana Bcc: x");
  });
  it("tier is exactly one of the three, with no dollar amounts", () => {
    expect(TIERS).toEqual(["Agency bundle", "Done-for-you (custom)", "Other"]);
    for (const t of TIERS) expect(t).not.toMatch(/\$|\d/);
    for (const t of TIERS) expect(validateContact({ ...good, tier: t }).ok).toBe(true);
    expect(validateContact({ ...good, tier: "Enterprise" })).toEqual({ ok: false, errors: ["tier"] });
  });
  it("rejects empty, too long and wrong types", () => {
    expect(validateContact({})).toEqual({ ok: false, errors: ["name", "email", "industry", "tier", "message"] });
    expect(validateContact({ ...good, name: "x".repeat(101), company: "x".repeat(101), message: "x".repeat(5001) })).toEqual({
      ok: false,
      errors: ["name", "message"],
    });
    expect(validateContact({ ...good, email: ["ana@example.test"] })).toEqual({ ok: false, errors: ["email"] });
  });
});
