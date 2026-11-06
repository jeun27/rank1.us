import { test, expect, type Page } from "@playwright/test";

// The portal look (founder 2026-11-06, lead OK with R1-R3): pure black surfaces, a white accent, gradient
// h1/h2 in the app areas, no glows outside the landing, underlined white links, the blue info pair for "You".
const open = async (page: Page, path: string, theme: "dark" | "light" = "dark") => {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
};
const style = (page: Page, sel: string, props: string[]) =>
  page
    .locator(sel)
    .first()
    .evaluate((el, ps) => Object.fromEntries(ps.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])), props);

test("dark /app: black page and rail, gradient H1 with tight tracking, white primary with black text", async ({
  page,
}) => {
  await open(page, "/dev/app?state=dashboard-empty");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(0, 0, 0)");
  expect(
    await page
      .getByRole("navigation", { name: "App" })
      .evaluate((n) => getComputedStyle(n.parentElement!).backgroundColor),
  ).toBe("rgb(0, 0, 0)");
  const h1 = await style(page, "main h1", ["background-clip", "color", "letter-spacing", "background-image"]);
  expect(h1["background-clip"]).toBe("text");
  expect(h1.color).toBe("rgba(0, 0, 0, 0)");
  expect(h1["background-image"]).toContain("linear-gradient");
  expect(parseFloat(h1["letter-spacing"])).toBeLessThan(0);
  // The empty state's primary is a link styled as the primary button.
  const primary = page.getByRole("link", { name: "Add my business" });
  expect(await primary.evaluate((b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).color])).toEqual([
    "rgb(255, 255, 255)",
    "rgb(0, 0, 0)",
  ]);
});

test("light /app keeps plain headings (the gradient is dark only)", async ({ page }) => {
  await open(page, "/dev/app?state=dashboard-empty", "light");
  const h1 = await style(page, "main h1", ["background-clip", "color"]);
  expect(h1["background-clip"]).not.toBe("text");
  expect(h1.color).not.toBe("rgba(0, 0, 0, 0)");
});

test("R1: links are white and underlined; R2: the You row keeps the blue info fill", async ({ page }) => {
  await open(page, "/dev/app?state=history-success");
  const link = page.locator("main a[href]").first();
  expect(await link.evaluate((a) => [getComputedStyle(a).color, getComputedStyle(a).textDecorationLine])).toEqual([
    "rgb(255, 255, 255)",
    "underline",
  ]);
  await open(page, "/dev/app?state=competitors-success");
  const you = page.getByText("You", { exact: true }).first();
  expect(await you.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(121, 192, 250)");
});

test("no glows in /app or /team; the landing keeps its hero glow", async ({ page }) => {
  for (const path of ["/dev/app?state=dashboard-success", "/dev/team"]) {
    await open(page, path);
    expect(
      await page.evaluate(
        () =>
          [...document.querySelectorAll("*")].filter((e) =>
            getComputedStyle(e).backgroundImage.includes("radial-gradient"),
          ).length,
      ),
      path,
    ).toBe(0);
  }
  await page.goto("/");
  await expect(page.locator("#hero [data-glow]").first()).toBeAttached();
});

test("R3: the business line on the visibility chart is the white accent", async ({ page }) => {
  await open(page, "/dev/app?state=dashboard-success");
  const line = page.locator("svg path[fill='none']").first();
  expect(await line.evaluate((p) => getComputedStyle(p).stroke)).toBe("rgb(255, 255, 255)");
});

// Visuals: each page waits for its H1 before the capture, so no shot is a blank shell.
for (const theme of ["dark", "light"] as const)
  test(`visuals ${theme}`, async ({ page }, info) => {
    const pages: [string, string][] = [
      ["dashboard", "/dev/app?state=dashboard-success"],
      ["competitors", "/dev/app?state=competitors-success"],
      ["fixes", "/dev/app?state=fixes-success"],
      ["history", "/dev/app?state=history-success"],
      ["team", "/dev/team"],
    ];
    for (const [name, path] of pages) {
      await open(page, path, theme);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.screenshot({ path: `test-results/screenshots/portal-${name}-${theme}-${info.project.name}.png` });
    }
    if (theme === "dark") {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.screenshot({ path: `test-results/screenshots/portal-landing-dark-${info.project.name}.png` });
    }
  });

// #104 (lead): the last pills become v3 shapes. Controls: 6px, 44px below md, 32px from md. Tags: the 4px Badge.
const shape = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e) => [getComputedStyle(e).borderTopLeftRadius, Math.round(e.getBoundingClientRect().height)]);

test("Sources: the location select and Show are 6px controls; the exact / fallback tags are 4px Badges", async ({
  page,
}) => {
  const control = page.viewportSize()!.width < 768 ? 44 : 32;
  await open(page, "/dev/app?state=sources-location");
  await expect(page.getByLabel("Location")).toBeVisible();
  expect(await shape(page, "main select[name=location]")).toEqual(["6px", control]);
  expect(
    await page
      .getByRole("button", { name: "Show", exact: true })
      .evaluate((e) => [getComputedStyle(e).borderTopLeftRadius, Math.round(e.getBoundingClientRect().height)]),
  ).toEqual(["6px", control]);
  for (const tag of await page.locator("[data-location-tag]").all())
    expect(
      await tag.evaluate((e) => [
        getComputedStyle(e).borderTopLeftRadius,
        Math.round(e.getBoundingClientRect().height),
      ]),
    ).toEqual(["4px", 20]);
  expect(await page.locator("[data-location-tag]").count()).toBeGreaterThan(0);
});

test("Questions: the answer panel's Close is a 6px control", async ({ page }) => {
  const control = page.viewportSize()!.width < 768 ? 44 : 32;
  await open(page, "/dev/app?state=questions-success");
  await page.locator("main").getByRole("button").first().click();
  const close = page.getByRole("button", { name: "Close", exact: true });
  await expect(close).toBeVisible();
  expect(
    await close.evaluate((e) => [
      getComputedStyle(e).borderTopLeftRadius,
      Math.round(e.getBoundingClientRect().height),
    ]),
  ).toEqual(["6px", control]);
});
