import { test, expect } from "@playwright/test";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";

// Step 16: /app/report on Example data (/dev/app, 404 in production).
for (const state of [
  "report-empty",
  "report-success",
  "report-partial",
  "report-failed",
  "report-loading",
  "report-error",
] as const)
  for (const theme of ["dark", "light"] as const)
    test(`/dev/app ${state} (${theme}): one H1, axe clean, no side scroll`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/dev/app?state=${state}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoSideScroll(page);
      await expectAxeClean(page);
    });

test("keyboard reaches the settings, the test send and every download", async ({ page }) => {
  await page.goto("/dev/app?state=report-success");
  // focus() doesn't wait for visibility; the streamed content is hidden until React moves it into place.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // X10: Branding is folded once recipients are saved; Enter on its summary opens it.
  const branding = page.locator("summary", { hasText: "Branding" });
  await branding.focus();
  await page.keyboard.press("Enter");
  for (const name of ["Upload logo", "Brand color", "Recipients"]) {
    await expect(page.getByLabel(name)).toBeVisible();
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
  await page.locator("summary", { hasText: "Report preview" }).click();
  const iframe = page.getByTitle("Report preview");
  await expect(iframe).toBeVisible();
  const frame = await iframe.boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(frame!.width).toBeGreaterThan(main!.width * 0.8);
});

test("report-partial: 'Connect GA4' links to the Connections hub", async ({ page }) => {
  await page.goto("/dev/app?state=report-partial");
  await expect(page.getByRole("link", { name: "Connect GA4" })).toHaveAttribute("href", "/app/settings/connections");
});

// X10 + X28 (UX plan PR 21): the status line and history lead; Preview and Branding sit folded below them.
test("status line first, history next, Preview and Branding folded; opened Branding is axe clean", async ({ page }) => {
  await page.goto("/dev/app?state=report-success");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const line = page.getByText(/^Next report [A-Z][a-z]{2} \d{1,2} to \d+ recipients?\.$/);
  await expect(line).toBeVisible();
  const y = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!.y;
  const [preview, branding] = [
    page.locator("summary", { hasText: "Report preview" }),
    page.locator("summary", { hasText: "Branding" }),
  ];
  expect(await y(line)).toBeLessThan(await y(page.getByRole("table")));
  expect(await y(page.getByRole("table"))).toBeLessThan(await y(preview));
  expect(await y(preview)).toBeLessThan(await y(branding));
  await expect(page.getByTitle("Report preview")).toHaveCount(0);
  await expect(page.getByLabel("Recipients")).toBeHidden();
  for (const s of [preview, branding]) expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await branding.click();
  await expect(page.getByLabel("Recipients")).toBeVisible();
  await expectAxeClean(page);
});
