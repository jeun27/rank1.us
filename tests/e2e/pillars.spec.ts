import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// G5: the Fix list grouped by GAS pillar on /dev/app (Example data): P5 before P2, Tidy-ups last inside P2,
// "{done}/{total}" per group, and the P0 baseline line at the bottom.
for (const theme of ["dark", "light"] as const)
  test(`pillar groups ${theme}: order, counts, Tidy-ups in P2, the P0 baseline; axe clean`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=fixes-success");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const groups = page.locator("[data-pillar]");
    await expect(groups).toHaveCount(2);
    expect(await groups.evaluateAll((els) => els.map((e) => e.getAttribute("data-pillar")))).toEqual(["p5", "p2"]);
    await expect(groups.nth(0).getByRole("heading").first()).toHaveText("P5Technical access");
    await expect(groups.nth(1).getByTestId("group-count")).toHaveText("0/3");
    await expect(groups.nth(1).getByRole("region", { name: "Tidy-ups" })).toBeVisible();
    const baseline = page.locator("[data-baseline]");
    await expect(baseline).toContainText("Your baseline:");
    await expect(baseline.getByRole("link")).toHaveAttribute("href", "/app");
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({
      path: `test-results/screenshots/pillars-${theme}-${info.project.name}.png`,
      fullPage: true,
    });
  });
