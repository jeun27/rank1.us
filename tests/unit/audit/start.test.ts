import { describe, expect, it, vi } from "vitest";
import { NO_CUISINE, buildFreeAudit, defaultPicks, startFreeAudit, type StartDeps } from "@/lib/audit/start";
import { buildQuestions } from "@/lib/questions/templates";
import { IRVINE_PLACES } from "../../fixtures/irvine";

const places = [...IRVINE_PLACES]
  .map((p) => ({ name: p.name, kind: p.kind }))
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
const lead = { id: "lead-1", domain: "example-ramen-house.test" };

const base = () => ({
  readSite: vi.fn<StartDeps["readSite"]>(async () => ({
    status: "ok",
    name: "Example Ramen House",
    cuisine: "ramen",
  })),
  findLocalCompetitors: vi.fn<StartDeps["findLocalCompetitors"]>(async () => ({
    status: "ok",
    items: [
      { name: "Example Noodle Bar", cid: "1", domain: "example-noodle-bar.test", rating: 4.4 },
      { name: "Example Izakaya", cid: "2" },
    ],
  })),
  listLocalPlaces: vi.fn<StartDeps["listLocalPlaces"]>(async () => places),
  createFreeAudit: vi.fn<StartDeps["createFreeAudit"]>(async () => "run-1"),
  log: vi.fn<(line: string) => void>(),
});
const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });

describe("defaultPicks", () => {
  it("first 3 verified landmarks and areas in the given order, vegan/vegetarian, date night", () => {
    expect(defaultPicks(places)).toEqual({
      landmarks: places
        .filter((p) => p.kind === "landmark")
        .slice(0, 3)
        .map((p) => p.name),
      areas: places
        .filter((p) => p.kind === "area")
        .slice(0, 3)
        .map((p) => p.name),
      dietary: ["vegan", "vegetarian"],
      occasion: ["date night"],
    });
  });
});

describe("startFreeAudit", () => {
  it("readSite → Maps top 5 → buildQuestions (≤25, long form, city level) → create_free_audit", async () => {
    const d = deps();
    expect(await startFreeAudit(lead, d)).toBe("run-1");
    expect(d.findLocalCompetitors).toHaveBeenCalledWith({
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      domain: lead.domain,
    });
    expect(d.listLocalPlaces).toHaveBeenCalledWith("Irvine", "CA");
    const input = d.createFreeAudit.mock.calls[0][0];
    const expected = buildQuestions({ cuisine: "ramen", city: "Irvine", state: "CA" }, defaultPicks(places));
    expect(input).toEqual({
      lead_id: "lead-1",
      business: { name: "Example Ramen House", domain: lead.domain },
      competitors: [{ name: "Example Noodle Bar", domain: "example-noodle-bar.test" }, { name: "Example Izakaya" }],
      location: { country: "US", state: "CA", city: "Irvine" },
      questions: expected.map((q) => ({ text: q.long_text, location_level: "city" })),
    });
    expect(input.questions.length).toBeGreaterThan(0);
    expect(input.questions.length).toBeLessThanOrEqual(25);
  });

  it("unreadable site → business name null (the snapshot uses the domain), generic templates with 'restaurants', Maps on plain 'restaurant'", async () => {
    const d = deps({ readSite: vi.fn(async () => ({ status: "unreadable" as const })) });
    await startFreeAudit(lead, d);
    const input = d.createFreeAudit.mock.calls[0][0];
    expect(input.business).toEqual({ name: null, domain: lead.domain });
    expect(d.findLocalCompetitors).toHaveBeenCalledWith(expect.objectContaining({ cuisine: "" }));
    const generic = buildQuestions({ cuisine: NO_CUISINE, city: "Irvine", state: "CA" }, defaultPicks(places));
    expect(input.questions.map((q) => q.text)).toEqual(generic.map((q) => q.long_text));
    expect(
      input.questions.every((q) => !/ramen|sushi|pho|hot pot|dim sum|Sichuan|Korean BBQ|brunch/.test(q.text)),
    ).toBe(true);
    expect(d.log).toHaveBeenCalledWith("free audit: site unreadable, using the domain as the brand");
  });

  it("read but no cuisine → site name kept, generic questions", async () => {
    const d = deps({ readSite: vi.fn(async () => ({ status: "ok" as const, name: "Example Place" })) });
    await startFreeAudit(lead, d);
    expect(d.createFreeAudit.mock.calls[0][0].business.name).toBe("Example Place");
  });

  it.each(["missing_keys", "error"] as const)("Maps %s → no competitors, still starts", async (status) => {
    const d = deps({ findLocalCompetitors: vi.fn(async () => ({ status, items: [] })) });
    expect(await startFreeAudit(lead, d)).toBe("run-1");
    expect(d.createFreeAudit.mock.calls[0][0].competitors).toEqual([]);
    expect(d.log).toHaveBeenCalledWith(`free audit: competitors ${status}`);
  });

  it("throwing readSite, Maps or places still start the audit", async () => {
    const boom = async () => {
      throw new Error("x");
    };
    const d = deps({ readSite: vi.fn(boom), findLocalCompetitors: vi.fn(boom), listLocalPlaces: vi.fn(boom) });
    expect(await startFreeAudit(lead, d)).toBe("run-1");
    expect(d.createFreeAudit.mock.calls[0][0].questions.length).toBeGreaterThan(0);
  });

  it("create_free_audit failing → null and one log line without PII, never thrown", async () => {
    const d = deps({
      createFreeAudit: vi.fn(async () => Promise.reject({ code: "P0001", message: `lead ${lead.domain}` })),
    });
    expect(await startFreeAudit({ ...lead }, d)).toBeNull();
    const lines = d.log.mock.calls.map((c) => String(c[0]));
    expect(lines).toContain("free audit: create_free_audit failed (P0001)");
    expect(lines.some((l) => l.includes(lead.domain) || l.includes("@"))).toBe(false);
  });
});

describe("buildFreeAudit", () => {
  it("passes at most 5 competitors (create_free_audit's limit)", async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ name: `Example Place ${i}`, cid: String(i) }));
    const input = await buildFreeAudit(
      lead,
      deps({ findLocalCompetitors: vi.fn(async () => ({ status: "ok" as const, items })) }),
    );
    expect(input.competitors).toHaveLength(5);
  });
});
