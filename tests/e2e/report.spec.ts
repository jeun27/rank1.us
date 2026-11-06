import { test, expect } from "@playwright/test";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";

// Step 16: /app/report on Example data (/dev/app, 404 in production).
for (const state of ["report-empty", "report-success", "report-failed", "report-loading", "report-error"] as const)
  test(`/dev/app ${state}: one H1, axe clean, no side scroll`, async ({ page }) => {
    await page.goto(`/dev/app?state=${state}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expectNoSideScroll(page);
    await expectAxeClean(page);
  });

test("keyboard reaches the settings, the test send and every download", async ({ page }) => {
  await page.goto("/dev/app?state=report-success");
  for (const name of ["Upload logo", "Brand color", "Recipients"]) {
    await page.getByLabel(name).focus();
    await expect(page.getByLabel(name)).toBeFocused();
  }
  for (const b of await page.getByRole("button", { name: /Save|Send test to me/ }).all()) {
    await b.focus();
    await expect(b).toBeFocused();
  }
  for (const a of await page.getByRole("link", { name: /Download/ }).all()) {
    await a.focus();
    await expect(a).toBeFocused();
  }
});

test("the preview scales to the width", async ({ page }) => {
  await page.goto("/dev/app?state=report-success");
  const iframe = page.getByTitle("Report preview");
  await expect(iframe).toBeVisible();
  const frame = await iframe.boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(frame!.width).toBeGreaterThan(main!.width * 0.8);
});
