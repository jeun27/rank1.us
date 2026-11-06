import { test, expect } from "@playwright/test";
import { DUMMY_TOKEN, expectAxeClean, expectNoSideScroll, mockApi, stubTurnstile } from "./helpers/forms";

// AuditRequestForm on the ink band in /dev/forms, until the landing page hosts it.
test.beforeEach(async ({ page }) => stubTurnstile(page));

const submit = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Get my free audit" }).click();

test("idle: labeled fields, accent final button, 44px targets on phones, axe clean", async ({ page }, info) => {
  await page.goto("/dev/forms");
  const button = page.getByRole("button", { name: "Get my free audit" });
  // v3 (D34): the final CTA uses the accent (light theme on /dev: jellyDeep #1A5FBF).
  expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(26, 95, 191)");
  // v3 (lead, O2): 44px below md.
  if (page.viewportSize()!.width < 768)
    for (const el of [page.getByLabel("Email"), page.getByLabel("Your domain"), button]) {
      expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  await expect(page.getByLabel("Your domain")).toHaveAttribute("placeholder", "yourbusiness.com");
  await expectNoSideScroll(page);
  await expectAxeClean(page);
  await page
    .locator("section")
    .first()
    .screenshot({ path: `test-results/screenshots/audit-form-${info.project.name}.png` });
});

test("error: domain without an ending shows the Final set string, readable on ink", async ({ page }, info) => {
  const bodies = await mockApi(page, "/api/audit/request", 202, { status: "queued" });
  await page.goto("/dev/forms");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Your domain").fill("ramenhouse");
  await submit(page);
  await expect(page.getByText("Add the ending, like ramenhouse.com")).toBeVisible();
  await expect(page.getByLabel("Your domain")).toBeFocused();
  expect(bodies).toHaveLength(0);
  await expectAxeClean(page);
  await page
    .locator("section")
    .first()
    .screenshot({ path: `test-results/screenshots/audit-form-error-${info.project.name}.png` });
});

test("submitting shows Checking…, then success with the email", async ({ page }) => {
  let release!: () => void;
  const bodies = await mockApi(
    page,
    "/api/audit/request",
    202,
    { status: "queued" },
    new Promise<void>((r) => (release = r)),
  );
  await page.goto("/dev/forms");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Your domain").fill("ramenhouse.com");
  await submit(page);
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
  release();
  await expect(page.getByRole("status")).toHaveText("Got it. We'll email your audit to owner@example.test.");
  expect(bodies[0]).toMatchObject({
    email: "owner@example.test",
    domain: "ramenhouse.com",
    "cf-turnstile-response": DUMMY_TOKEN,
    website: "",
  });
  await expectAxeClean(page);
});

for (const status of [429, 500]) {
  test(`server ${status}: error Banner, form stays usable`, async ({ page }) => {
    await mockApi(page, "/api/audit/request", status);
    await page.goto("/dev/forms");
    await page.getByLabel("Email").fill("owner@example.test");
    await page.getByLabel("Your domain").fill("ramenhouse.com");
    await submit(page);
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Get my free audit" })).toBeEnabled();
    await expectAxeClean(page);
  });
}
