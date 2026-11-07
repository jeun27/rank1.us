import { test, expect } from "@playwright/test";

// DQ15 (O2, lead): the phone top bar keeps X9a (page name only) but shares one 16px edge with the page.
// The bar sat at 16px and the H1 at 20px, so the two left edges didn't line up.
for (const state of ["dashboard-success", "dashboard-error"])
  test(`/dev/app ${state}: below md the top bar and the H1 share one 16px left edge`, async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, "phones only");
    await page.goto(`/dev/app?state=${state}`);
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Dashboard", { exact: true });
    const h1 = page.getByRole("heading", { level: 1 });
    expect(Math.round((await crumb.boundingBox())!.x)).toBe(16);
    expect(Math.round((await h1.boundingBox())!.x)).toBe(16);
  });
