import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("/dev/ui shows every component and state, accessibly", async ({ page }, info) => {
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  for (const name of [
    "Button",
    "DomainField",
    "AuroraButton",
    "Card",
    "Badge",
    "Banner",
    "Table",
    "StatNumber",
    "ProgressBar",
    "EmptyState",
    "LoadingState",
    "Freshness",
    "Final set",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByText("Example data").first()).toBeVisible();

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // v3 light (O2) page #F6F7F9: /dev follows the system, light in Playwright by default.
  expect(bg).toBe("rgb(246, 247, 249)");
  const h1Font = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(h1Font).toMatch(/Inter/i);
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFont).toMatch(/Inter/i);

  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW).toBeLessThanOrEqual(page.viewportSize()!.width);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

  await page.screenshot({ path: `test-results/screenshots/dev-ui-${info.project.name}.png`, fullPage: true });
});

test("tap targets are at least 44px tall", async ({ page }) => {
  // v3 (lead, O2): 44px below md (UI.md); from md up the dense 32px controls apply (checked in dev-ui.spec).
  test.skip(page.viewportSize()!.width >= 768, "44px tap targets apply below md");
  await page.goto("/dev/ui");
  const heights = await page
    .locator("main button, main a")
    .evaluateAll((els) => els.map((e) => ({ text: e.textContent?.trim(), h: e.getBoundingClientRect().height })));
  expect(heights.filter((x) => x.h < 44)).toEqual([]);
});

test("reduced motion stops every spinner and the Jelly squish", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/ui");
  const spinners = page.locator("[data-spinner]");
  expect(await spinners.count()).toBeGreaterThan(0);
  const anims = await page
    .locator("[data-spinner], img.animate-squish")
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
  expect(anims.length).toBeGreaterThan(await spinners.count());
  expect(anims.filter((a) => a !== "none")).toEqual([]);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const moving = await page
    .locator("[data-spinner]")
    .first()
    .evaluate((e) => getComputedStyle(e).animationName);
  expect(moving).not.toBe("none");
});

test("Final set: pill field focus ring, aurora ring, loading blue, progress fill", async ({ page }) => {
  await page.goto("/dev/ui");
  const set = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Final set", exact: true }) });

  const input = set.getByRole("textbox", { name: "Your domain" }).first();
  await input.focus();
  const wrap = input.locator("xpath=ancestor::*[@data-field]");
  expect(await wrap.evaluate((e) => [getComputedStyle(e).outlineColor, getComputedStyle(e).outlineWidth])).toEqual([
    "rgb(26, 95, 191)",
    "2px",
  ]);

  const aurora = set.getByRole("button", { name: "Opening Google…" });
  expect(await aurora.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain("linear-gradient");
  expect(await aurora.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("2px");

  const checking = set.getByRole("button", { name: "Checking…" });
  expect(await checking.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(24, 87, 159)");

  await expect(set.getByText("Add the ending, like ramenhouse.com")).toBeVisible();
  await expect(set.getByRole("button", { name: "Add business" })).toBeDisabled();

  const bar = set.getByRole("progressbar", { name: "120 of 250 answers" });
  const [track, fill] = await bar.evaluate((e) => [
    e.getBoundingClientRect().width,
    e.firstElementChild!.getBoundingClientRect().width,
  ]);
  // v3 (UI.md Loading + progress): no track border; the fill is the track's width scaled to the floored percent.
  expect(Math.abs(fill / track - 0.48)).toBeLessThan(0.01);
  await expect(set.getByText("48%", { exact: true })).toBeVisible();
});

test("the domain field keeps the placeholder readable: inline when wide, button below when narrow", async ({
  page,
}, info) => {
  await page.goto("/dev/ui");
  const section = page.locator("section", {
    has: page.getByRole("heading", { level: 2, name: "DomainField", exact: true }),
  });
  const input = section.getByRole("textbox", { name: "Your domain" }).first();
  const button = section.getByRole("button", { name: "Get my free audit" }).first();
  const [i, b] = [(await input.boundingBox())!, (await button.boundingBox())!];
  const fits = await input.evaluate((e: HTMLInputElement) => e.scrollWidth <= e.clientWidth);
  expect(fits).toBe(true);
  if (info.project.name === "mobile") expect(b.y).toBeGreaterThan(i.y + i.height - 1);
  else expect(Math.abs(b.y + b.height / 2 - (i.y + i.height / 2))).toBeLessThan(2);
});

test("Final set screenshot", async ({ page }, info) => {
  await page.goto("/dev/ui");
  const set = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Final set", exact: true }) });
  await set.screenshot({ path: `test-results/screenshots/final-set-${info.project.name}.png` });
});

// v3 (D35, lead O2): from md up, buttons are 32px tall and the final/hero size 40px.
test("desktop: buttons are 32px, the final CTA 40px", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 768, "dense controls apply from md up");
  await page.goto("/dev/ui");
  const checking = page.getByRole("button", { name: "Checking…" }).first();
  expect(Math.round((await checking.boundingBox())!.height)).toBe(32);
  await page.goto("/dev/forms");
  const final = page.getByRole("button", { name: "Get my free audit" });
  expect(Math.round((await final.boundingBox())!.height)).toBe(40);
});
