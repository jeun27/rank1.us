import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { newUser, openMagicLink } from "./helpers/auth";

const STATES = [
  "dashboard-empty",
  "dashboard-unpaid",
  "dashboard-first-check",
  "dashboard-success",
  "dashboard-partial",
  "dashboard-loading",
  "dashboard-error",
  "competitors-success",
  "competitors-empty",
  "questions-success",
  "questions-empty",
  "history-success",
  "history-empty",
  "history-error",
];

for (const state of STATES) {
  test(`/dev/app ${state}: one H1, axe clean, no side scroll`, async ({ page }, info) => {
    await page.goto(`/dev/app?state=${state}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page.screenshot({ path: `test-results/screenshots/app-${state}-${info.project.name}.png`, fullPage: true });
  });
}

test("questions drawer: keyboard opens it, Tab stays inside, Esc closes and focus returns", async ({ page }) => {
  await page.goto("/dev/app?state=questions-success");
  const row = page.getByRole("button", { name: /best ramen in Irvine/ });
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  for (const a of await dialog.locator('a[href^="https://"]').all())
    await expect(a).toHaveAttribute("rel", "noopener noreferrer");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("tap targets are at least 44px on every page", async ({ page }) => {
  for (const state of ["dashboard-success", "competitors-success", "questions-success", "history-success"]) {
    await page.goto(`/dev/app?state=${state}`);
    const small = await page
      .locator("main a:visible, main button:visible")
      .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent?.trim()));
    expect(small, state).toEqual([]);
  }
});

test("signed-in owner: the nav reaches every page, one H1 each, Dashboard empty without a business", async ({
  page,
}) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("shell");
  await openMagicLink(page, user.email);
  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.getByText("Nothing tracked yet. Add your domain and I'll find the questions.")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "App" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Billing" }).click();
  await page.waitForURL("**/app/billing");
  await expect(nav.getByRole("link", { name: "Billing" })).toHaveAttribute("aria-current", "page");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
