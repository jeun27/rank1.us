import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

// G6 (lead OK 2026-11-06): robots.txt allows every crawler, AI ones by name; disallows the private areas;
// previews disallow everything. sitemap.xml lists the public pages only.
const AI = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"];
const PRIVATE = ["/app", "/team", "/client", "/api", "/dev", "/admin", "/auth"];

afterEach(() => vi.unstubAllEnvs());
const prod = (site?: string) => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
};
const rulesOf = () => {
  const r = robots().rules;
  return Array.isArray(r) ? r : [r];
};

describe("robots.txt (production)", () => {
  it("allows / for everyone and for each named AI crawler, disallowing exactly the private areas", () => {
    prod("https://rank1.us");
    const rules = rulesOf();
    expect(rules.map((r) => r.userAgent)).toEqual(["*", ...AI]);
    for (const r of rules) {
      expect(r.allow).toBe("/");
      expect(r.disallow).toEqual(PRIVATE);
    }
  });

  it("/audit is not listed (its noindex covers it); the sitemap line uses the site origin", () => {
    prod("https://rank1.us");
    expect(rulesOf().flatMap((r) => [r.disallow].flat())).not.toContain("/audit");
    expect(robots().sitemap).toBe("https://rank1.us/sitemap.xml");
  });

  it.each([undefined, "", "http://rank1.us", "not a url"])("falls back to https://rank1.us for %s", (site) => {
    prod(site);
    expect(robots().sitemap).toBe("https://rank1.us/sitemap.xml");
  });
});

describe("robots.txt (previews)", () => {
  it.each(["preview", "development", undefined])("VERCEL_ENV=%s: Disallow / for everyone", (env) => {
    vi.stubEnv("VERCEL_ENV", env);
    expect(rulesOf()).toEqual([{ userAgent: "*", disallow: "/" }]);
  });
});

describe("sitemap.xml", () => {
  it("lists the public pages only, as absolute URLs on the site origin", () => {
    prod("https://rank1.us");
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual([
      "https://rank1.us/",
      "https://rank1.us/contact",
      "https://rank1.us/privacy",
      "https://rank1.us/terms",
    ]);
    for (const u of urls) expect(u).not.toMatch(/\/(app|team|client|dev|api|admin|auth|audit|signin)(\/|$)/);
  });
});
