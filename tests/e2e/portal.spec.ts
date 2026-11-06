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
  const primary = page.getByRole("button", { name: "Add my business" });
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
