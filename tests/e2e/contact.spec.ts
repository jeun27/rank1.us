import { test, expect, type Page } from "@playwright/test";
import { DUMMY_TOKEN, expectAxeClean, expectNoSideScroll, mockApi, stubTurnstile } from "./helpers/forms";

test.beforeEach(async ({ page }) => stubTurnstile(page));

async function fill(scope: Page | ReturnType<Page["getByRole"]>) {
  await scope.getByLabel("Name").fill("Ana Example");
  await scope.getByLabel("Email").fill("visitor@example.test");
  await scope.getByLabel("Industry", { exact: true }).selectOption("Restaurant");
  await scope.getByLabel("Tier").selectOption("Other");
  await scope.getByLabel("Message").fill("Example data");
}

test("/contact: one H1, labeled fields, three tiers, 44px targets, axe clean", async ({ page }, info) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact us");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const tiers = await page.getByLabel("Tier").locator("option:not([disabled])").allTextContents();
  expect(tiers).toEqual(["Agency bundle", "Done-for-you (custom)", "Other"]);
  await expect(page.locator("body")).not.toContainText("$");
  for (const el of [page.getByLabel("Name"), page.getByLabel("Tier"), page.getByRole("button", { name: "Send" })]) {
    expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(DUMMY_TOKEN);
  await expectNoSideScroll(page);
  await expectAxeClean(page);
  await page.screenshot({ path: `test-results/screenshots/contact-${info.project.name}.png`, fullPage: true });
});

test("/contact: empty submit shows inline errors and sends nothing", async ({ page }) => {
  const bodies = await mockApi(page, "/api/contact", 200, { ok: true });
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send" }).click();
  for (const l of ["Name", "Email", "Industry", "Tier", "Message"])
    await expect(page.getByLabel(l, { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Industry", { exact: true })).toHaveAccessibleDescription("Pick your industry.");
  await expect(page.locator("p", { hasText: "Pick your industry." })).toBeVisible();
  await expect(page.getByLabel("Name")).toBeFocused();
  expect(bodies).toHaveLength(0);
  await expectAxeClean(page);
});

test("/contact: Sending… then success, with the Turnstile token posted", async ({ page }) => {
  let release!: () => void;
  const bodies = await mockApi(page, "/api/contact", 200, { ok: true }, new Promise<void>((r) => (release = r)));
  await page.goto("/contact");
  await fill(page);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  release();
  await expect(page.getByRole("status")).toHaveText("Thanks. We'll reply by email within 2 business days.");
  expect(bodies[0]).toMatchObject({
    name: "Ana Example",
    tier: "Other",
    "cf-turnstile-response": DUMMY_TOKEN,
    website: "",
  });
});

for (const [status, text] of [
  [429, "Too many tries. Try again in an hour."],
  [502, "That didn't send. Try again in a minute."],
] as const) {
  test(`/contact: ${status} shows its error`, async ({ page }, info) => {
    await mockApi(page, "/api/contact", status);
    await page.goto("/contact");
    await fill(page);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(text);
    await expectAxeClean(page);
    if (status === 502)
      await page.screenshot({
        path: `test-results/screenshots/contact-error-${info.project.name}.png`,
        fullPage: true,
      });
  });
}

test.describe("Contact us modal (from /privacy)", () => {
  test("opens, traps focus, closes on Esc and returns focus to the link", async ({ page }, info) => {
    await page.goto("/privacy");
    const link = page.getByRole("link", { name: "Contact us" });
    await expect(link).toHaveAttribute("href", "/contact");
    await link.click();
    const dialog = page.getByRole("dialog", { name: "Contact us" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/privacy$/);

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }

    const box = (await dialog.boundingBox())!;
    const vp = page.viewportSize()!;
    if (vp.width < 768) {
      expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
      expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);
    } else {
      expect(box.width).toBeLessThan(vp.width);
    }
    await expectAxeClean(page);
    await page.screenshot({ path: `test-results/screenshots/contact-modal-${info.project.name}.png` });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("submits with success inside the modal, and the close button works", async ({ page }) => {
    await mockApi(page, "/api/contact", 200, { ok: true });
    await page.goto("/privacy");
    await page.getByRole("link", { name: "Contact us" }).click();
    const dialog = page.getByRole("dialog", { name: "Contact us" });
    await fill(dialog);
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Thanks. We'll reply by email within 2 business days.");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "Contact us" })).toBeFocused();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("ContactUsLink falls back to /contact", async ({ page }) => {
    await page.goto("/privacy");
    await page.getByRole("link", { name: "Contact us" }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact us");
  });
});

// Industry (Jeun #22): required select; "Other" adds an optional text input. Same form on /contact and in the modal.
for (const where of ["/contact", "modal"] as const) {
  test(`${where}: Industry is required, Other shows "Your industry (optional)", axe clean`, async ({ page }, info) => {
    const bodies = await mockApi(page, "/api/contact", 200, { ok: true });
    if (where === "/contact") await page.goto("/contact");
    else {
      await page.goto("/privacy");
      await page.getByRole("link", { name: "Contact us" }).click();
    }
    const scope = where === "modal" ? page.getByRole("dialog", { name: "Contact us" }) : page.locator("main");
    const industry = scope.getByLabel("Industry", { exact: true });
    await expect(industry).toHaveAttribute("required", "");
    await expect(industry.locator("option").first()).toHaveText("Pick your industry.");
    expect(await industry.locator("option:not([disabled])").allTextContents()).toEqual([
      "Restaurant",
      "HVAC",
      "Plumbing",
      "Roofing",
      "Pest control",
      "Other",
    ]);
    await expect(scope).not.toContainText("$");
    expect((await industry.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await scope.getByLabel("Name").fill("Ana Example");
    await scope.getByLabel("Email").fill("visitor@example.test");
    await scope.getByLabel("Tier").selectOption("Other");
    await scope.getByLabel("Message").fill("Example data");
    await scope.getByRole("button", { name: "Send" }).click();
    await expect(industry).toHaveAttribute("aria-invalid", "true");
    await expect(industry).toHaveAccessibleDescription("Pick your industry.");
    expect(bodies).toHaveLength(0);

    const other = scope.getByLabel("Your industry (optional)");
    await expect(other).toHaveCount(0);
    await industry.selectOption("Other");
    await expect(other).toBeVisible();
    await expect(other).toHaveAttribute("maxlength", "60");
    await expectAxeClean(page);
    await page.screenshot({
      path: `test-results/screenshots/contact-industry-${where === "modal" ? "modal-" : ""}${info.project.name}.png`,
      fullPage: where !== "modal",
    });

    await other.fill("Pool service");
    await scope.getByRole("button", { name: "Send" }).click();
    await expect(scope.getByRole("status")).toHaveText("Thanks. We'll reply by email within 2 business days.");
    expect(bodies[0]).toMatchObject({ industry: "Other", industry_other: "Pool service" });
  });
}
