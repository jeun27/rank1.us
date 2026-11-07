import { test, expect } from "@playwright/test";

// #189 review: when the newest point sits on the axis top (here 40%), the end label rose about 16px
// above the plot and into the "Visibility" heading. It must stay below the heading, in both themes.
for (const theme of ["dark", "light"] as const)
  test(`/dev/app chart end label at the axis top stays below its heading (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=dashboard-chart-top");
    const label = page.locator("[data-end-label]");
    await expect(label).toHaveText("40%");
    const heading = page.getByRole("heading", { name: "Visibility", exact: true });
    const h = (await heading.boundingBox())!;
    const l = (await label.boundingBox())!;
    expect(l.y).toBeGreaterThanOrEqual(h.y + h.height);
  });
