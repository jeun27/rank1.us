import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// X9a (UX plan S6, L5): below md the top bar is one row with the page name only, and the theme toggle
// lives in Account. A real switcher (several businesses, /team's client switcher) stays visible.
const crumbs = (page: Page) => page.getByRole("navigation", { name: "Breadcrumb" });
const phone = (page: Page) => page.viewportSize()!.width < 768;

test("/app: phones show only the page crumb; the theme toggle is in Account and persists", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-success");
  const bar = crumbs(page);
  await expect(bar.getByText("Dashboard", { exact: true })).toBeVisible();
  const header = page.getByRole("banner");
  if (!phone(page)) {
    await expect(bar.getByRole("link", { name: "Rank1" })).toBeVisible();
    await expect(bar.getByText("Example Ramen House")).toBeVisible();
    await expect(header.getByRole("button", { name: "Dark theme" })).toBeVisible();
    return;
  }
  await expect(bar.getByRole("link", { name: "Rank1" })).toBeHidden();
  await expect(bar.getByText("Example Ramen House")).toBeHidden();
  // One row: no leading "/" before the page crumb, and the header is a single 48px bar.
  const slash = await bar
    .getByText("Dashboard", { exact: true })
    .evaluate((e) => getComputedStyle(e.closest("li")!, "::before").display);
  expect(slash).toBe("none");
  expect(Math.round((await header.boundingBox())!.height)).toBe(48);
  await expect(header.getByRole("button", { name: "Dark theme" })).toBeHidden();
  // X2: Account is under More in the phone bottom bar.
  await page.locator("[data-bottom-nav]").getByText("More", { exact: true }).click();
  await page.getByText("Account", { exact: true }).locator("visible=true").click();
  // #145 review: in Account it is a switch that shows its state.
  const toggle = page.getByRole("switch", { name: "Dark theme" }).locator("visible=true");
  await expect(toggle).toHaveCount(1);
  const was = await page.locator("html").getAttribute("data-theme");
  await toggle.click();
  const now = was === "dark" ? "light" : "dark";
  await expect(page.locator("html")).toHaveAttribute("data-theme", now);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", now);
  // The page streams in: wait for its H1 so axe sees the whole page.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
});

test("/app with several businesses: the switcher stays on phones", async ({ page }) => {
  await page.goto("/dev/app?state=switcher-many");
  await expect(crumbs(page).getByRole("button").first()).toBeVisible();
});

test("/team: phones keep the client switcher; the toggle moves to Account", async ({ page }) => {
  test.skip(!phone(page), "phone layout");
  await page.goto("/dev/team");
  const bar = crumbs(page);
  await expect(bar.getByRole("link", { name: "Rank1" })).toBeHidden();
  await expect(bar.getByRole("button").first()).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "Dark theme" })).toBeHidden();
});

test("/client: phones move the toggle into Account", async ({ page }) => {
  test.skip(!phone(page), "phone layout");
  await page.goto("/dev/client");
  await expect(page.getByRole("banner").getByRole("button", { name: "Dark theme" })).toBeHidden();
  await page.getByText("Account", { exact: true }).first().click();
  await expect(page.getByRole("switch", { name: "Dark theme" }).locator("visible=true")).toHaveCount(1);
});
