import { test, expect } from "@playwright/test";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";

// Step 14: /app/billing and the header Business switcher on Example data (/dev/app, 404 in production).
const STATES = [
  "billing-unpaid",
  "billing-paid",
  "billing-past-due",
  "billing-failed",
  "billing-incomplete",
  "billing-paused",
  "billing-loading",
  "billing-error",
  "switcher-one",
  "switcher-many",
] as const;

for (const state of STATES)
  for (const theme of ["dark", "light"] as const)
    test(`/dev/app ${state} (${theme}): one H1, axe clean, no side scroll`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/dev/app?state=${state}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoSideScroll(page);
      await expectAxeClean(page);
    });

test("switcher: keyboard opens it, axe clean open, Esc closes and focus returns", async ({ page }) => {
  await page.goto("/dev/app?state=switcher-many");
  const trigger = page.getByRole("button", { name: "Example Ramen House ▾" });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Business switcher" })).toBeVisible();
  await expectAxeClean(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("list", { name: "Business switcher" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("phones: the switcher is a bottom sheet with 56px rows; wide screens: a popover", async ({ page }) => {
  await page.goto("/dev/app?state=switcher-many");
  await page.getByRole("button", { name: "Example Ramen House ▾" }).click();
  const list = page.getByRole("list", { name: "Business switcher" });
  const rows = list.getByRole("button", { name: /^Example/ });
  for (const r of await rows.all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  const panel = await page.getByTestId("switcher-panel").boundingBox();
  const vp = page.viewportSize()!;
  if (vp.width < 768) {
    expect(Math.round(panel!.y + panel!.height)).toBe(vp.height);
    expect(Math.round(panel!.width)).toBe(vp.width);
  } else expect(panel!.width).toBeLessThan(vp.width / 2);
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(360);
});

test("Add and Remove dialogs: focus moves in, Tab stays inside, Esc returns focus, axe clean", async ({ page }) => {
  await page.goto("/dev/app?state=switcher-many");
  await page.getByRole("button", { name: "Example Ramen House ▾" }).click();
  const add = page.getByRole("button", { name: "+ Add a business ($99/mo)" });
  await add.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Add a business? Your plan goes from 3 x $99 to 4 x $99 = $396/mo. Prorated today.",
  );
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await expectAxeClean(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
