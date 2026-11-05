import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("/dev/ui shows every component and state, accessibly", async ({ page }, info) => {
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  for (const name of ["Button", "Card", "Badge", "Banner", "Table", "StatNumber", "EmptyState", "LoadingState", "Freshness"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.getByText("Example data").first()).toBeVisible();

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(247, 244, 238)");
  const h1Font = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(h1Font).toMatch(/Fraunces/i);
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFont).toMatch(/Public Sans/i);

  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW).toBeLessThanOrEqual(page.viewportSize()!.width);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

  await page.screenshot({ path: `test-results/screenshots/dev-ui-${info.project.name}.png`, fullPage: true });
});

test("tap targets are at least 44px tall", async ({ page }) => {
  await page.goto("/dev/ui");
  const heights = await page.locator("main button, main a").evaluateAll((els) =>
    els.map((e) => ({ text: e.textContent?.trim(), h: e.getBoundingClientRect().height })),
  );
  expect(heights.filter((x) => x.h < 44)).toEqual([]);
});
