import { test, expect } from "@playwright/test";

test("every /dev/ui section with example numbers is labeled Example data", async ({ page }) => {
  await page.goto("/dev/ui");
  for (const name of ["Card", "Badge", "Table", "StatNumber", "LoadingState", "Freshness"]) {
    const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name, exact: true }) });
    await expect(section.getByText("Example data").first()).toBeVisible();
  }
});
