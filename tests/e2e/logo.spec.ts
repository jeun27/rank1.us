import { test, expect } from "@playwright/test";

test("/dev/ui shows the Logo section: mark, app icon and lockup", async ({ page }, info) => {
  await page.goto("/dev/ui");
  const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Logo" }) });
  await expect(section).toBeVisible();

  for (const size of [24, 48, 96]) {
    const mark = section.locator(`img[src="/logo-mark.svg"][height="${size}"]`);
    await expect(mark).toBeVisible();
    expect(await mark.evaluate((el: HTMLImageElement) => el.naturalWidth > 0)).toBe(true);
  }
  for (const size of [32, 64, 180]) {
    const icon = section.locator(`img[src="/app-icon.svg"][height="${size}"]`);
    await expect(icon).toBeVisible();
    expect(await icon.evaluate((el: HTMLImageElement) => el.naturalWidth > 0)).toBe(true);
  }
  await expect(section.getByText("Rank1", { exact: true })).toBeVisible();

  await section.screenshot({ path: `test-results/screenshots/logo-${info.project.name}.png` });
});

test("the favicon and apple icon routes return 200, and the default favicon.ico is gone", async ({ page, request }) => {
  await page.goto("/");
  const icon = await page.locator('head link[rel="icon"]').getAttribute("href");
  expect(icon).toMatch(/^\/icon\.svg/);
  const iconRes = await request.get(icon!);
  expect(iconRes.status()).toBe(200);
  expect(iconRes.headers()["content-type"]).toContain("image/svg+xml");

  const apple = await page.locator('head link[rel="apple-touch-icon"]').getAttribute("href");
  const appleRes = await request.get(apple!);
  expect(appleRes.status()).toBe(200);
  expect(appleRes.headers()["content-type"]).toContain("image/png");

  expect((await request.get("/favicon.ico")).status()).toBe(404);
});
