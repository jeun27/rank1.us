import { test, expect } from "@playwright/test";

// UI.md:8 / D40 (QA gap): /client follows the saved theme (the same before-paint rule as /app and /team)
// and its header has the same "Dark theme" toggle, on the same prefs.
test("the /client header toggles the theme, saves it, and the saved choice wins before paint", async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/dev/client");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // X9a: from md the toggle is in the bar; on phones it's inside Account.
  const phone = page.viewportSize()!.width < 768;
  const openAccount = async () => phone && (await page.getByText("Account", { exact: true }).first().click());
  const visibleToggle = () =>
    page.getByRole("banner").getByRole("button", { name: "Dark theme" }).locator("visible=true");
  await openAccount();
  const toggle = visibleToggle();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({
    path: `test-results/screenshots/client-theme-light-${info.project.name}.png`,
    fullPage: true,
  });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // Saved: a reload (system still light) is dark from the first paint.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openAccount();
  await expect(visibleToggle()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: `test-results/screenshots/client-theme-dark-${info.project.name}.png`,
    fullPage: true,
  });
});
