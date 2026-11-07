import { test, expect, type Page } from "@playwright/test";

// DQ10 (design-quality audit): the Dashboard's loading skeleton was three equal 112px bars, so the page
// jumped when results arrived. Each skeleton block now sits where its success block lands (24px slack).
const box = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).first().boundingBox())!;
  return { y: b.y, h: b.height, x: b.x, w: b.width };
};
const SUCCESS = {
  hero: "main > div:first-of-type > :first-child",
  next: "main > div:first-of-type > section",
  chart: "main > section:nth-of-type(1)",
  table: "main > section:nth-of-type(2)",
};

test("/dev/app dashboard-loading is shaped like dashboard-success", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-success");
  const want: Record<string, Awaited<ReturnType<typeof box>>> = {};
  for (const [k, s] of Object.entries(SUCCESS)) want[k] = await box(page, s);
  await page.goto("/dev/app?state=dashboard-loading");
  for (const k of Object.keys(SUCCESS)) {
    const got = await box(page, `[data-skeleton=${k}]`);
    for (const d of ["y", "h", "x", "w"] as const)
      expect(Math.abs(got[d] - want[k][d]), `${k}.${d}`).toBeLessThanOrEqual(24);
  }
});

test("/dev/app dashboard-error says 'Try again' once, as the action", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-error");
  const alert = page.locator("main [role=alert]");
  await expect(alert).toContainText("We couldn't load your results.");
  expect((await alert.textContent())!.match(/Try again/g)).toHaveLength(1);
  await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
});
