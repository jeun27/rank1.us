import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  navServices,
  readHomeStage,
  readServices,
  readSitemapServices,
  sitemapServices,
} from "@/lib/onboarding/site-profile";

// Onboarding v2 DP2 (share/ux-plan/onboarding-welcome §4): fixtures only, no network.
const fx = (name: string) => readFileSync(`tests/fixtures/sites/${name}`, "utf8");
const H = "https://example-plumbing.test";
const NAV = fx("services-nav.html");
const NONE = fx("services-none.html");
const SITEMAP = fx("services-sitemap.xml");

function deps(pages: Record<string, string>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const body = pages[String(input)];
    const xml = String(input).endsWith(".xml");
    return body === undefined
      ? new Response("no", { status: 404, headers: { "content-type": "text/html" } })
      : new Response(body, { status: 200, headers: { "content-type": xml ? "application/xml" : "text/html" } });
  });
  return { fetch, lookup: vi.fn(async () => [{ address: "93.184.216.34" }]), timeoutMs: 50 };
}
const urls = (d: ReturnType<typeof deps>) => d.fetch.mock.calls.map((c) => String(c[0]));

describe("parsers", () => {
  it("nav: link labels inside <nav> minus the stoplist, deduped, in page order", () => {
    expect(navServices(NAV)).toEqual(["Drain cleaning", "Water heater repair", "Leak detection"]);
    expect(navServices(NONE)).toEqual([]);
  });

  it("sitemap: one level under /services/, /menu/, /treatments/ on this site only, as labels", () => {
    expect(sitemapServices(SITEMAP, "example-plumbing.test")).toEqual(["Drain cleaning", "Water heater repair"]);
  });
});

describe("readServices", () => {
  it("JSON-LD offers win (makesOffer, hasOfferCatalog), and no sitemap is fetched", async () => {
    const home = `<script type="application/ld+json">{"@type":"Plumber","name":"Example Plumbing Co",
      "makesOffer":[{"itemOffered":{"name":"Drain cleaning"}}],
      "hasOfferCatalog":{"itemListElement":[{"itemOffered":{"name":"Repiping"}},{"name":"Drain cleaning"}]}}</script>${NAV}`;
    const d = deps({ [`${H}/`]: home, [`${H}/sitemap.xml`]: SITEMAP });
    expect(await readServices("example-plumbing.test", d)).toEqual({
      status: "ok",
      services: ["Drain cleaning", "Repiping"],
      source: "schema",
    });
    expect(urls(d)).toEqual([`${H}/robots.txt`, `${H}/`]);
  });

  it("nav only: nav labels, no sitemap fetched", async () => {
    const d = deps({ [`${H}/`]: NAV });
    expect(await readServices("example-plumbing.test", d)).toEqual({
      status: "ok",
      services: ["Drain cleaning", "Water heater repair", "Leak detection"],
      source: "nav",
    });
    expect(urls(d)).not.toContain(`${H}/sitemap.xml`);
  });

  it("both nav and sitemap: nav wins (2nd signal before 3rd)", async () => {
    const d = deps({ [`${H}/`]: NAV, [`${H}/sitemap.xml`]: SITEMAP });
    expect((await readServices("example-plumbing.test", d)).source).toBe("nav");
  });

  it("sitemap only: the robots Sitemap: line is used, fetched once", async () => {
    const d = deps({
      [`${H}/robots.txt`]: `User-agent: *\nAllow: /\nSitemap: ${H}/sitemap_index.xml`,
      [`${H}/`]: NONE,
      [`${H}/sitemap_index.xml`]: SITEMAP,
    });
    expect(await readServices("example-plumbing.test", d)).toEqual({
      status: "ok",
      services: ["Drain cleaning", "Water heater repair"],
      source: "sitemap",
    });
    expect(urls(d)).toEqual([`${H}/robots.txt`, `${H}/`, `${H}/sitemap_index.xml`]);
  });

  it("none: empty services, no source; a sitemap robots disallows is never fetched", async () => {
    const d = deps({
      [`${H}/robots.txt`]: "User-agent: *\nDisallow: /sitemap.xml",
      [`${H}/`]: NONE,
      [`${H}/sitemap.xml`]: SITEMAP,
    });
    expect(await readServices("example-plumbing.test", d)).toEqual({ status: "ok", services: [], source: null });
    expect(urls(d)).toEqual([`${H}/robots.txt`, `${H}/`]);
  });

  it("an off-site Sitemap: line is ignored (no other host fetched)", async () => {
    const d = deps({ [`${H}/robots.txt`]: "Sitemap: https://other-site.test/sitemap.xml", [`${H}/`]: NONE });
    await readServices("example-plumbing.test", d);
    expect(urls(d).every((u) => u.startsWith(H))).toBe(true);
  });

  it("fits #199's CHECK through the shared normalise step: non-blank, each ≤ 100 chars, deduped, at most 30", async () => {
    const d = deps({ [`${H}/`]: fx("services-oversize.html") });
    const { services, source } = await readServices("example-plumbing.test", d);
    expect(source).toBe("schema");
    expect(services).toHaveLength(30);
    expect(services.every((x) => x.trim() !== "" && x.length <= 100)).toBe(true);
    expect(services[0]).toMatch(/^Water heater repair x+$/);
    expect(services.filter((x) => x.toLowerCase() === "drain cleaning")).toEqual(["drain cleaning"]);
    expect(
      sitemapServices(
        `<loc>https://example-plumbing.test/services/${"a-".repeat(80)}b</loc>`,
        "example-plumbing.test",
      )[0].length,
    ).toBeLessThanOrEqual(100);
  });

  it("unreadable home → unreadable, never thrown", async () => {
    expect(await readServices("example-plumbing.test", deps({}))).toEqual({
      status: "unreadable",
      services: [],
      source: null,
    });
    expect((await readServices("localhost", deps({}))).status).toBe("unreadable");
  });
});

// #213 review: one "Read my site" fetches the home page once. Stages 1–3 also take the services the home page
// lists (JSON-LD, nav); stage 4 then fetches only the sitemap, never the home page again.
describe("one home fetch across the reading stages", () => {
  it("readHomeStage: the profile plus the nav services, from robots + home only", async () => {
    const d = deps({ [`${H}/`]: NAV });
    const r = await readHomeStage("example-plumbing.test", d);
    expect(r.profile.status).toBe("ok");
    expect(r.services).toEqual({
      status: "ok",
      services: ["Drain cleaning", "Water heater repair", "Leak detection"],
      source: "nav",
    });
    expect(urls(d)).toEqual([`${H}/robots.txt`, `${H}/`]);
  });

  it("readHomeStage: no services on the home page leaves stage 4 to the sitemap (services null)", async () => {
    const r = await readHomeStage("example-plumbing.test", deps({ [`${H}/`]: NONE }));
    expect(r.profile.status).toBe("ok");
    expect(r.services).toBeNull();
  });

  it("readSitemapServices: robots + the sitemap, never the home page", async () => {
    const d = deps({
      [`${H}/robots.txt`]: `User-agent: *\nAllow: /\nSitemap: ${H}/sitemap_index.xml`,
      [`${H}/`]: NONE,
      [`${H}/sitemap_index.xml`]: SITEMAP,
    });
    expect(await readSitemapServices("example-plumbing.test", d)).toEqual({
      status: "ok",
      services: ["Drain cleaning", "Water heater repair"],
      source: "sitemap",
    });
    expect(urls(d)).toEqual([`${H}/robots.txt`, `${H}/sitemap_index.xml`]);
  });
});
