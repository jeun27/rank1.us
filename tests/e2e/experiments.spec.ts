import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { newUser, openMagicLink } from "./helpers/auth";

// Step 17 frontend: /app/experiments in the v3 shell. The gallery (/dev/app) has every UI.md 4b state.
const STATES = ["empty", "loading", "error", "partial", "success", "form"] as const;
const isMobile = (page: Page) => page.viewportSize()!.width < 768;

const axeClean = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

for (const theme of ["dark", "light"] as const)
  for (const state of STATES)
    test(`/dev/app experiments-${state} (${theme}): one H1, axe clean, no side scroll`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/dev/app?state=experiments-${state}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
        state === "form" ? "Start a test" : "Experiments",
      );
      if (state === "success") await expect(page.getByRole("table").first()).toBeVisible();
      if (state === "form") await expect(page.getByRole("group", { name: "Test questions" })).toBeVisible();
      await axeClean(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      await page.screenshot({
        path: `test-results/screenshots/experiments-${state}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    });

test("success: each card has Before / After as '% · n=', signed points, a Difference and 'Directional'", async ({
  page,
}) => {
  await page.goto("/dev/app?state=experiments-success");
  const card = page.getByRole("article").first();
  const cells = await card.getByRole("cell").allTextContents();
  for (const v of cells) expect(v).toMatch(/^(\d+% · n=\d+|[+−]?\d+ pts)$/);
  await expect(card.getByText("Directional")).toBeVisible();
  await expect(card.getByText("Difference")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/p-value|signific|confiden/i);
  // Phones: each group's numbers stack (percent over n), and the table still fits.
  if (isMobile(page)) {
    const n = card.getByRole("cell").first().locator("[data-n]");
    const pct = card.getByRole("cell").first().locator("[data-pct]");
    expect((await n.boundingBox())!.y).toBeGreaterThan((await pct.boundingBox())!.y);
  }
});

test("Fix list: 'Start a before/after test' links to the form for that fix", async ({ page }) => {
  await page.goto("/dev/app?state=fixes-success");
  const link = page.getByRole("link", { name: "Start a before/after test" }).first();
  await expect(link).toHaveAttribute("href", /^\/app\/experiments\/new\?fix=/);
  await page.goto("/dev/app?state=fixes-readonly");
  await expect(page.getByRole("link", { name: "Start a before/after test" })).toHaveCount(0);
});

test("form by keyboard: the rules show inline errors, one group per question", async ({ page }) => {
  await page.goto("/dev/app?state=experiments-form");
  await page.getByLabel("Name").fill("New menu page");
  await page.getByRole("button", { name: "Start a test" }).click();
  await expect(page.getByText("Pick at least 1 test question.")).toBeVisible();
  const test1 = page.getByRole("group", { name: "Test questions" }).getByRole("checkbox").first();
  await test1.focus();
  await page.keyboard.press("Space");
  await expect(test1).toBeChecked();
  await expect(page.getByRole("group", { name: "Control questions" }).getByRole("checkbox").first()).not.toBeChecked();
  await page.getByLabel("Link to the change").fill("ftp://example.test");
  await page.getByRole("button", { name: "Start a test" }).click();
  await expect(page.getByText("Use a link that starts with http:// or https://.")).toBeVisible();
});

// The UI gate on top of backend's RLS (lead): a dfy_client never reaches the experiments pages.
test("a dfy_client gets a real 404 on /app/experiments and /app/experiments/new", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("dfy-exp", "dfy_client");
  await openMagicLink(page, user.email);
  for (const path of ["/app/experiments", "/app/experiments/new", "/app/experiments/new?fix=x"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});

test("a self-serve user is not 404'd on /app/experiments", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const user = await newUser("self-exp");
  await openMagicLink(page, user.email);
  const res = await page.goto("/app/experiments");
  expect(res?.status()).toBe(200);
});
