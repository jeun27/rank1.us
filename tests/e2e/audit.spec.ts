import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const STATES = ["progress", "progress-error", "results", "partial", "failed", "free-progress", "free-results"];

test("an unknown audit token is a 404, sent with no referrer and not indexed", async ({ page }) => {
  const res = await page.goto("/audit/not-a-real-token");
  expect(res?.status()).toBe(404);
  expect(res?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

for (const state of STATES) {
  test(`/dev/audit ${state}: one H1, axe clean, no side scroll`, async ({ page }, info) => {
    await page.goto(`/dev/audit?state=${state}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      state.startsWith("free") ? "Your free audit" : "Audit results",
    );
    await expect(page.getByText("Powered by Rank1")).toHaveCount(state.startsWith("free") ? 1 : 0);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page.screenshot({ path: `test-results/screenshots/audit-${state}-${info.project.name}.png`, fullPage: true });
  });
}

test("results: keyboard reaches both downloads, and cited links carry no referrer", async ({ page }) => {
  await page.goto("/dev/audit?state=free-results");
  const csv = page.getByRole("link", { name: "Download CSV" });
  for (let i = 0; i < 40 && !(await csv.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(csv).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Download PNG" })).toBeFocused();
  for (const a of await page.locator('main a[href^="https://"]').all())
    await expect(a).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByRole("link", { name: "Start for $99/mo" })).toHaveAttribute(
    "href",
    "/signin?next=%2Fapp%2Fbilling",
  );
});

test("tap targets are at least 44px on the results page", async ({ page }) => {
  // v3 (lead, O2): 44px below md (UI.md); from md up the dense 32px controls apply (checked in dev-ui.spec).
  test.skip(page.viewportSize()!.width >= 768, "44px tap targets apply below md");
  await page.goto("/dev/audit?state=free-results");
  const small = await page
    .locator("main a:visible, main button:visible")
    .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent?.trim()));
  expect(small).toEqual([]);
});
