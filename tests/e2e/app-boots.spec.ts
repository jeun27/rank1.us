import { test, expect } from "@playwright/test";

test("the app serves the home page", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
});
