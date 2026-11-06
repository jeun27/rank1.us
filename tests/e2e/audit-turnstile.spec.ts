import { test, expect } from "@playwright/test";
import { expectAxeClean, mockApi } from "./helpers/forms";

// Founder-approved (07:56 UTC): the real Turnstile script with Cloudflare's always-pass test site key
// (playwright.config.ts builds with it). The widget stays hidden until the email and domain are valid,
// then fades in; "Get my free audit" waits for the token (aria-disabled + a helper line).
test("hidden until valid, fades in, the button waits for the token; axe clean, 44px targets", async ({
  page,
}, info) => {
  const bodies = await mockApi(page, "/api/audit/request", 202, { status: "queued" });
  await page.goto("/dev/forms");
  const button = page.getByRole("button", { name: "Get my free audit" });
  const reveal = page.locator("[data-turnstile-reveal]");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Enter your email and website to continue")).toBeVisible();
  await expect(reveal).toHaveAttribute("data-revealed", "false");
  if (page.viewportSize()!.width < 768)
    for (const el of [page.getByLabel("Email"), page.getByLabel("Your domain"), button])
      expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expectAxeClean(page);
  await page
    .locator("section")
    .first()
    .screenshot({ path: `test-results/screenshots/turnstile-empty-${info.project.name}.png` });

  await page.getByLabel("Email").fill("owner@example.test");
  await expect(reveal).toHaveAttribute("data-revealed", "false");
  await page.getByLabel("Your domain").fill("ramenhouse.com");
  await expect(reveal).toHaveAttribute("data-revealed", "true");
  // The always-pass key hands out a token; then the helper goes and the button is active.
  await expect(button).not.toHaveAttribute("aria-disabled", { timeout: 15_000 });
  await expect(page.getByText("Check the box to continue")).toHaveCount(0);
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("");
  await expectAxeClean(page);
  await page
    .locator("section")
    .first()
    .screenshot({ path: `test-results/screenshots/turnstile-ready-${info.project.name}.png` });

  // Back to invalid: inactive again; fixing it brings the kept token back without a new check.
  await page.getByLabel("Your domain").fill("ramenhouse");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Enter your email and website to continue")).toBeVisible();
  await page.getByLabel("Your domain").fill("ramenhouse.com");
  await expect(button).not.toHaveAttribute("aria-disabled");
  await button.click();
  await expect(page.getByRole("status")).toContainText("owner@example.test");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]["cf-turnstile-response"]).toBeTruthy();
});

test("reduced motion: the reveal has no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/forms");
  const reveal = page.locator("[data-turnstile-reveal]");
  expect(await reveal.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("none");
});

test("Turnstile blocked: the fallback stays, the button works once the fields are valid", async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  const bodies = await mockApi(page, "/api/audit/request", 403, { error: "verification" });
  await page.goto("/dev/forms");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Your domain").fill("ramenhouse.com");
  const button = page.getByRole("button", { name: "Get my free audit" });
  await expect(button).not.toHaveAttribute("aria-disabled");
  await button.click();
  // The server still verifies the token: no token, so the form shows its error state as before.
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  expect(bodies).toHaveLength(1);
});
