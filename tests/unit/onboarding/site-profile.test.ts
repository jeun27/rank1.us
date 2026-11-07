import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { profileFromHtml, readHome } from "@/lib/onboarding/site-profile";

// Onboarding v2 DP1 (share/ux-plan/onboarding-welcome §4): fixtures only, no network.
const fx = (name: string) => readFileSync(`tests/fixtures/sites/${name}.html`, "utf8");

describe("profileFromHtml: JSON-LD → meta/og → title/H1", () => {
  it("restaurant: every field from JSON-LD, tagged schema", () => {
    expect(profileFromHtml(fx("restaurant"))).toEqual({
      name: "Example Ramen House",
      vertical: "restaurant",
      category: "restaurant",
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      address: "1 Example Way, 92618",
      phone: "+1 949-555-0100",
      areaServed: ["Irvine", "Tustin"],
      sameAs: ["https://www.yelp.com/biz/example-ramen-house", "https://www.youtube.com/@exampleramen"],
      sources: {
        name: "schema",
        vertical: "schema",
        category: "schema",
        cuisine: "schema",
        city: "schema",
        state: "schema",
        address: "schema",
        phone: "schema",
        areaServed: "schema",
        sameAs: "schema",
      },
    });
  });

  it("plumber: a JSON-LD array with a typed array; phone from the first tel: link", () => {
    const p = profileFromHtml(fx("plumber"));
    expect(p).toMatchObject({
      name: "Example Plumbing Co",
      vertical: "plumbing",
      category: "plumber",
      city: "Tustin",
      state: "CA",
      phone: "+19495550111",
      areaServed: ["Orange County"],
    });
    expect(p.sources).toMatchObject({ name: "schema", vertical: "schema", phone: "title" });
    expect(p.cuisine).toBeUndefined();
  });

  it("dentist without schema: vertical + category by keyword, city/state from geo meta, no cuisine off-vertical", () => {
    const p = profileFromHtml(fx("dentist"));
    expect(p).toMatchObject({
      name: "Example Smiles Dental",
      vertical: "dental",
      category: "dentist",
      city: "Irvine",
      state: "CA",
    });
    expect(p.sources).toMatchObject({
      name: "title",
      vertical: "title",
      category: "title",
      city: "meta",
      state: "meta",
    });
    expect(p.cuisine).toBeUndefined();
  });

  it("saas: @graph; the name from the Organization, vertical from SoftwareApplication, no category", () => {
    const p = profileFromHtml(fx("saas"));
    expect(p).toMatchObject({
      name: "ExampleCRM Inc.",
      vertical: "saas",
      sameAs: ["https://www.linkedin.com/company/examplecrm"],
    });
    expect(p.category).toBeUndefined();
  });

  it("dtc: a Product node gives the vertical, never the business name (og:site_name wins)", () => {
    const p = profileFromHtml(fx("dtc"));
    expect(p).toMatchObject({ name: "Example Socks", vertical: "dtc" });
    expect(p.sources.name).toBe("meta");
  });

  it("no schema: title's first segment, keyword vertical (most hits wins), nothing invented", () => {
    const p = profileFromHtml(fx("no-schema"));
    expect(p).toEqual({
      name: "Example Roofing & Gutters",
      vertical: "roofing",
      category: "roofing",
      areaServed: [],
      sameAs: [],
      sources: { name: "title", vertical: "title", category: "title" },
    });
  });

  it("broken JSON-LD blocks are skipped, the valid one is used", () => {
    expect(profileFromHtml(fx("broken-jsonld"))).toMatchObject({
      name: "Example HVAC Pros",
      vertical: "hvac",
      category: "HVAC",
      city: "Irvine",
    });
  });

  it("@graph with an address array; a business type outside the page's nodes", () => {
    expect(profileFromHtml(fx("graph"))).toMatchObject({
      name: "Example Glow Spa",
      vertical: "beauty",
      category: "day spa",
      city: "Costa Mesa",
      address: "5 Example Ave",
      phone: "(714) 555-0122",
    });
  });

  it("no city default: a page with no location leaves city and state empty", () => {
    const p = profileFromHtml("<title>Example</title>");
    expect(p.city).toBeUndefined();
    expect(p.state).toBeUndefined();
    expect(p.vertical).toBeUndefined();
  });
});

describe("readHome", () => {
  const H = "https://example-ramen-house.test";
  const deps = (pages: Record<string, string>) => ({
    fetch: vi.fn<typeof globalThis.fetch>(async (input) => {
      const body = pages[String(input)];
      return body === undefined
        ? new Response("no", { status: 404, headers: { "content-type": "text/html" } })
        : new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    }),
    lookup: vi.fn(async () => [{ address: "93.184.216.34" }]),
    timeoutMs: 50,
  });

  it("reads the home page only (robots + home), and returns the profile", async () => {
    const d = deps({ [`${H}/`]: fx("restaurant") });
    const p = await readHome("example-ramen-house.test", d);
    expect(p).toMatchObject({ status: "ok", name: "Example Ramen House", city: "Irvine", cuisine: "ramen" });
    expect(d.fetch.mock.calls.map((c) => String(c[0]))).toEqual([`${H}/robots.txt`, `${H}/`]);
  });

  it("unreadable (robots Disallow /, a bad host, or no HTML) → status unreadable, never thrown", async () => {
    expect(
      await readHome("example-ramen-house.test", deps({ [`${H}/robots.txt`]: "User-agent: *\nDisallow: /" })),
    ).toEqual({
      status: "unreadable",
      areaServed: [],
      sameAs: [],
      sources: {},
    });
    expect((await readHome("localhost", deps({}))).status).toBe("unreadable");
    expect((await readHome("example-ramen-house.test", deps({}))).status).toBe("unreadable");
  });
});
