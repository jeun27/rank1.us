import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// X2 (UX plan PR 16): on phones the main pages sit in a bottom bar in the thumb zone (Dashboard · What to
// fix next · Competitors · More); "More" holds the rest and Account. md+ keeps the rail.
const phone = (page: Page) => page.viewportSize()!.width < 768;
const bar = (page: Page) => page.getByRole("navigation", { name: "App" }).locator("[data-bottom-nav]");

test("phones: 4 targets at the bottom, the current page marked, no sideways row", async ({ page }) => {
  await page.goto("/dev/app?state=fixes-success");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (!phone(page)) {
    await expect(bar(page)).toBeHidden();
    await expect(page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Billing" })).toBeVisible();
    return;
  }
  const items = bar(page).locator(":scope > li");
  await expect(items).toHaveCount(4);
  await expect(bar(page).getByRole("link")).toHaveText(["Dashboard", "What to fix next", "Competitors"]);
  const box = (await bar(page).boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
  for (const h of await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
    expect(h).toBeGreaterThanOrEqual(44);
  // The old sideways row is gone: no other nav link shows above the content.
  await expect(page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Billing" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("phones: More opens the rest of the pages and Account, and Escape closes it", async ({ page }) => {
  test.skip(!phone(page), "phone layout");
  await page.goto("/dev/app?state=dashboard-success");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const more = bar(page).getByText("More", { exact: true });
  await more.click();
  const sheet = page.locator("[data-more-sheet]");
  for (const name of ["Questions", "Sources", "Experiments", "Reports", "History", "Billing"])
    await expect(sheet.getByRole("link", { name })).toBeVisible();
  await expect(sheet.getByText("Account", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  // The page pads for the bar: scrolled to the end, the last block ends above it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = (await page.locator("main > *").last().boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual((await bar(page).boundingBox())!.y + 1);
});
