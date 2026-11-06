import { test, expect } from "@playwright/test";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";

// Step 12: the DFY client dashboard on Example data (/dev/client, 404 in production). Light only.
const STATES = ["success", "fixes", "partial", "no-run", "no-run-fixes", "removed", "loading", "error"] as const;

for (const state of STATES)
  for (const theme of ["dark", "light"] as const)
    test(`/dev/client ${state} (${theme}): one H1, axe clean, no side scroll`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/dev/client?state=${state}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
      await expectNoSideScroll(page);
      await expectAxeClean(page);
    });

test("read-only: no Status select, no competitor edits, no billing or prices", async ({ page }) => {
  for (const state of ["success", "fixes"]) {
    await page.goto(`/dev/client?state=${state}`);
    await expect(page.getByLabel("Status")).toHaveCount(0);
    // Portal (b): the check-off circles are status only for a client.
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Add|Not a competitor|Start for/ })).toHaveCount(0);
    expect(await page.locator("main").textContent()).not.toMatch(/\$\d/);
  }
  await expect(page.getByRole("heading", { name: "What to fix next" })).toBeVisible();
});

test("keyboard: every link and button on the client dashboard is reachable with Tab", async ({ page }) => {
  await page.goto("/dev/client?state=fixes");
  const focusable = await page.locator("main a[href], main button").count();
  const seen = new Set<string>();
  for (let i = 0; i < focusable + 15; i++) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el && el.closest("main") ? `${el.tagName}:${el.textContent?.trim()}:${el.getAttribute("href")}` : null;
    });
    if (id) seen.add(id);
  }
  expect(seen.size).toBe(focusable);
});
