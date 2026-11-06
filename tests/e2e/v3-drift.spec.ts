import { test, expect, type Page } from "@playwright/test";

// v3 component drift (lead, 2026-11-06; found by the GAS prototype agent): C1-C5 against docs/UI.md.
const THEMES = ["light", "dark"] as const;
const isMobile = (page: Page) => page.viewportSize()!.width < 768;
const open = async (page: Page, path: string, theme: (typeof THEMES)[number]) => {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
};
const section = (page: Page, name: string) =>
  page.locator("section", { has: page.getByRole("heading", { level: 2, name, exact: true }) });
const css = (page: Page, sel: string, props: string[]) =>
  page
    .locator(sel)
    .first()
    .evaluate((el, ps) => Object.fromEntries(ps.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])), props);

// C5 (bug from #93): at 375 the breadcrumb wrapped onto 3 lines. It stays on one line; a long business name
// ends in an ellipsis in the crumb (the switcher's list keeps the full names).
for (const state of ["dashboard-success", "switcher-one", "switcher-many"])
  test(`C5 ${state}: the /app breadcrumb is one line, the business crumb ellipsizes`, async ({ page }) => {
    await page.goto(`/dev/app?state=${state}`);
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    const items = crumbs.getByRole("listitem");
    await expect(items).toHaveCount(3);
    const boxes = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    const mid = (b: DOMRect) => b.top + b.height / 2;
    for (const b of boxes) expect(Math.abs(mid(b) - mid(boxes[0]))).toBeLessThanOrEqual(1);
    // One header row: the breadcrumb and the theme toggle share it.
    const bar = (await page.getByRole("banner").boundingBox())!;
    expect(bar.height).toBeLessThanOrEqual(isMobile(page) ? 52 : 48);
    // The name span truncates (text-overflow: ellipsis on a clipped box).
    const name = crumbs.locator("[data-crumb-name]");
    expect(await css(page, '[aria-label="Breadcrumb"] [data-crumb-name]', ["text-overflow", "overflow"])).toEqual({
      "text-overflow": "ellipsis",
      overflow: "hidden",
    });
    await expect(name).toHaveText("Example Ramen House");
  });

test("C5: a long business name ends in an ellipsis at 375 and stays whole in the switcher list", async ({ page }) => {
  test.skip(!isMobile(page), "the crumb only runs out of room on phones");
  await page.goto("/dev/app?state=switcher-many");
  const name = page.getByRole("navigation", { name: "Breadcrumb" }).locator("[data-crumb-name]");
  await name.evaluate((el) => (el.textContent = "Example Ramen House and Izakaya of Irvine"));
  expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const items = await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("listitem")
    .evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)),
    );
  expect(new Set(items).size).toBe(1);
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("button").first().click();
  await expect(page.getByTestId("switcher-panel").getByText("Example Ramen House", { exact: true })).toBeVisible();
});

// C3: UI.md type table: UI body 13/19, caption 12/16, tag 11/1 at every breakpoint. R2: fields stay 16px
// below md so iPhone Safari doesn't zoom on focus.
test("C3: app text is 13/19 and captions 12/16 at every width; fields are 16px below md", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-success");
  const link = page.getByRole("navigation", { name: "App" }).getByRole("link").first();
  expect(await link.evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).lineHeight])).toEqual([
    "13px",
    "19px",
  ]);
  await page.goto("/dev/ui");
  const caption = page.getByText("Add the ending, like ramenhouse.com").first();
  expect(await caption.evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).lineHeight])).toEqual([
    "12px",
    "16px",
  ]);
  const input = section(page, "DomainField").getByRole("textbox").first();
  expect(await input.evaluate((e) => getComputedStyle(e).fontSize)).toBe(isMobile(page) ? "16px" : "13px");
});

test("C1: Badge is a 4px tag, 20h, Inter 500 11px; ProgressBar is a 6px overlay track with an accent fill", async ({
  page,
}) => {
  await open(page, "/dev/ui", "dark");
  const badge = section(page, "Badge").locator("span", { hasText: /\S/ }).first();
  expect(
    await badge.evaluate((e) => {
      const c = getComputedStyle(e);
      return [
        c.borderTopLeftRadius,
        Math.round(e.getBoundingClientRect().height),
        c.fontSize,
        c.fontWeight,
        c.borderTopWidth,
      ];
    }),
  ).toEqual(["4px", 20, "11px", "500", "1px"]);
  const bar = section(page, "ProgressBar").getByRole("progressbar").first();
  const [h, radius, track, fill, fillBg] = await bar.evaluate((e) => {
    const f = e.firstElementChild as HTMLElement;
    return [
      Math.round(e.getBoundingClientRect().height),
      getComputedStyle(e).borderTopLeftRadius,
      e.getBoundingClientRect().width,
      f.getBoundingClientRect().width,
      getComputedStyle(f).backgroundColor,
    ];
  });
  expect(h).toBe(6);
  expect(radius).toBe("9999px");
  expect(fill / (track as number)).toBeGreaterThan(0);
  expect(fillBg).toBe("rgb(39, 158, 242)");
});

test("C2: the error banner is errorBg with a 1px 30% error hairline and a 48px Jelly; info is infoBg", async ({
  page,
}) => {
  await open(page, "/dev/ui", "dark");
  const error = section(page, "Banner").getByRole("alert").first();
  expect(
    await error.evaluate((e) => {
      const c = getComputedStyle(e);
      return [c.backgroundColor, c.borderTopWidth, c.borderTopColor, c.borderTopLeftRadius];
    }),
  ).toEqual(["rgb(51, 25, 26)", "1px", "color(srgb 0.941176 0.541176 0.494118 / 0.3)", "8px"]);
  expect(await error.locator("img").evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(48);
  const info = section(page, "Banner").getByRole("status").first();
  expect(await info.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(20, 38, 59)");
});

test("C4: the FixList Status select is a 6px control (44px below md, 32px from md)", async ({ page }) => {
  await page.goto("/dev/app?state=fixes-success");
  const select = page.getByLabel("Status").first();
  expect(
    await select.evaluate((e) => [
      getComputedStyle(e).borderTopLeftRadius,
      Math.round(e.getBoundingClientRect().height),
    ]),
  ).toEqual(["6px", isMobile(page) ? 44 : 32]);
});

// Visuals in both themes: the /app shell (breadcrumb), the /dev/ui components and the Fix list.
for (const theme of THEMES)
  test(`visuals ${theme}`, async ({ page }, info) => {
    const shot = (name: string) => `test-results/screenshots/drift-${name}-${theme}-${info.project.name}.png`;
    await open(page, "/dev/app?state=switcher-many", theme);
    await page.screenshot({ path: shot("breadcrumb") });
    await open(page, "/dev/app?state=fixes-success", theme);
    await page.screenshot({ path: shot("fixes") });
    await open(page, "/dev/app?state=dashboard-error", theme);
    await page.screenshot({ path: shot("banner") });
    await open(page, "/dev/ui", theme);
    for (const name of ["Badge", "Banner", "ProgressBar"])
      await section(page, name).screenshot({ path: shot(name.toLowerCase()) });
  });
