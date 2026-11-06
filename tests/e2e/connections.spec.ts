import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectionsFlag } from "./helpers/connections-flag";

// Connections C-a: the Settings → Connections hub. The gallery (/dev/app) shows it on Example data whatever
// the flag; the real pages stay 404 until ENABLE_CONNECTIONS=true.
const STATES = [
  "restaurant",
  "saas",
  "connected",
  "outcome-connected",
  "outcome-denied",
  "outcome-error",
  "readonly",
  "loading",
  "error",
] as const;

const axeClean = async (page: Page) => {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

for (const theme of ["dark", "light"] as const)
  for (const state of STATES)
    test(`/dev/app connections-${state} (${theme}): one H1, axe clean, no side scroll`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/dev/app?state=connections-${state}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      if (!["loading", "error"].includes(state)) await expect(page.getByRole("article").first()).toBeVisible();
      await axeClean(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      await page.screenshot({
        path: `test-results/screenshots/connections-${state}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    });

test("consent sheet by keyboard: opens from Connect, focus inside, Esc closes back to the button", async ({
  page,
}, info) => {
  await page.goto("/dev/app?state=connections-restaurant");
  const connect = page
    .getByRole("article", { name: "Google Business Profile" })
    .getByRole("button", { name: "Connect" });
  await connect.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Google Business Profile" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("business.manage");
  await expect(dialog.getByRole("link", { name: "Continue to Google" })).toHaveAttribute(
    "href",
    /^\/api\/connections\/google\/start\?business=.+&connector=gbp&return=%2Fapp%2Fsettings%2Fconnections$/,
  );
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await axeClean(page);
  await page.screenshot({ path: `test-results/screenshots/connections-consent-${info.project.name}.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(connect).toBeFocused();
});

test("Coming soon: Notify me, then 'We'll let you know.'", async ({ page }) => {
  await page.goto("/dev/app?state=connections-restaurant");
  const yelp = page.getByRole("article", { name: "Yelp" });
  await expect(yelp.getByRole("button", { name: "Connect" })).toHaveCount(0);
  await yelp.getByRole("button", { name: "Notify me" }).click();
  await expect(yelp.getByRole("status")).toHaveText("We'll let you know.");
});

test("Disconnect asks first, with the one-grant warning", async ({ page }) => {
  await page.goto("/dev/app?state=connections-connected");
  await page
    .getByRole("article", { name: "Google Business Profile" })
    .getByRole("button", { name: "Disconnect" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("This also disconnects Search Console and Analytics");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// The target's own flag, not the runner's env (Preview deployments run with it on). A network error or an
// unexpected status fails the test (see connectionsFlag); only a clear "on" skips.
const flagOn = async (request: APIRequestContext) =>
  connectionsFlag((await request.get("/api/connections/google/start", { maxRedirects: 0 })).status()) === "on";

test("ENABLE_CONNECTIONS off: the Settings and Connections pages are a real 404", async ({ page, request }) => {
  test.skip(await flagOn(request), "the flag is on for this deployment");
  for (const path of ["/app/settings", "/app/settings/connections", "/client/settings/connections"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});
