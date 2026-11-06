import { test, expect } from "@playwright/test";

// G6: both files are served. The local run is not production, so robots.txt is the preview rule here; the
// production rules are unit-tested (tests/unit/site/robots-sitemap.test.ts).
test("robots.txt and sitemap.xml are served; every sitemap URL's path answers 200", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toMatch(/User-Agent: \*/i);
  const map = await request.get("/sitemap.xml");
  expect(map.status()).toBe(200);
  expect(map.headers()["content-type"]).toMatch(/xml/);
  const paths = [...(await map.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(paths).toEqual(["/", "/contact", "/privacy", "/terms"]);
  for (const p of paths) expect((await page.goto(p))?.status(), p).toBe(200);
});
