import { test, expect } from "@playwright/test";

test("every /dev/ui section with example numbers is labeled Example data", async ({ page }) => {
  await page.goto("/dev/ui");
  for (const name of ["Card", "Badge", "Table", "StatNumber", "LoadingState", "Freshness"]) {
    const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name, exact: true }) });
    await expect(section.getByText("Example data").first()).toBeVisible();
  }
});

test("the Card demo is Example Ramen House with its leaderboard StatNumber, not hand-typed landing copy", async ({ page }) => {
  await page.goto("/dev/ui");
  const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Card", exact: true }) });
  await expect(section.getByRole("heading", { level: 3, name: "Example Ramen House" })).toBeVisible();
  await expect(section.getByText("30%", { exact: true })).toBeVisible();
  await expect(section.getByText("named in 75 of 250 answers", { exact: true })).toBeVisible();
  await expect(page.getByText("34% of 160 answers")).toHaveCount(0);
});
