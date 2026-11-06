import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// C-b on Example data: the dashboard connect card (/app and /client), its all-set state (G3, per-audience
// copy) and the onboarding connect step. The real pages are behind ENABLE_CONNECTIONS (connections.spec).
const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
};

const CASES = [
  { path: "/dev/app?state=dashboard-card-connect", shot: "dashboard-connect", heading: "Connect your accounts" },
  { path: "/dev/app?state=dashboard-card-reauth", shot: null, heading: "Connect your accounts" },
  { path: "/dev/app?state=dashboard-card-readonly", shot: null, heading: "Connect your accounts" },
  {
    path: "/dev/app?state=dashboard-all-set",
    shot: "dashboard-all-set",
    heading: "You're all set. We'll take it from here.",
  },
  { path: "/dev/app?state=onboarding-connect", shot: "onboarding-connect", heading: "Connect your accounts" },
  {
    path: "/dev/app?state=onboarding-connect-done",
    shot: "onboarding-done",
    heading: "You're all set. We'll take it from here.",
  },
  { path: "/dev/client?state=connect", shot: "client-connect", heading: "Connect your accounts" },
  { path: "/dev/client?state=all-set", shot: "client-all-set", heading: "You're all set. We'll take it from here." },
];

for (const theme of ["dark", "light"] as const)
  for (const c of CASES)
    test(`${theme} ${c.path}: the card renders; axe clean`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(c.path);
      await expect(page.getByRole("region", { name: c.heading })).toBeVisible();
      await axeClean(page);
      if (c.shot)
        await page.screenshot({ path: `test-results/screenshots/connect-${c.shot}-${theme}-${info.project.name}.png` });
    });

test("Connect opens the consent sheet to Google; Esc closes it and focus returns", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-card-connect");
  const card = page.getByRole("region", { name: "Connect your accounts" });
  await expect(card.getByText("0 of 1 connected")).toBeVisible();
  const connect = card.getByRole("button", { name: "Connect Google Business Profile" });
  await connect.click();
  const dialog = page.getByRole("dialog", { name: "Google Business Profile" });
  await expect(dialog.getByRole("link", { name: "Continue to Google" })).toHaveAttribute(
    "href",
    /^\/api\/connections\/google\/start\?business=example-business&connector=gbp&return=%2Fapp$/,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(connect).toBeFocused();
});

test("reauth offers Reconnect; read-only shows the status and no buttons", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-card-reauth");
  await expect(page.getByRole("button", { name: "Reconnect Google Business Profile" })).toBeVisible();
  await page.goto("/dev/app?state=dashboard-card-readonly");
  const card = page.getByRole("region", { name: "Connect your accounts" });
  await expect(card.getByText("Needs reconnect")).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("the onboarding step: Skip for now and Go to your dashboard lead to /app", async ({ page }) => {
  await page.goto("/dev/app?state=onboarding-connect");
  await expect(page.getByRole("link", { name: "Skip for now" })).toHaveAttribute("href", "/app");
  await page.goto("/dev/app?state=onboarding-connect-done");
  await expect(page.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/app");
});

test("all set: self-serve links to the fix list; the DFY client's copy promises no timing", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-all-set");
  const self = page.getByRole("region", { name: "You're all set. We'll take it from here." });
  await expect(self).toContainText("Google Business Profile is connected. Your fix list and reports now use it.");
  await expect(self.getByRole("link", { name: "What to fix next" })).toHaveAttribute("href", "/app/fixes");
  await page.goto("/dev/client?state=all-set");
  await expect(page.getByRole("region", { name: "You're all set. We'll take it from here." })).toContainText(
    "The Rank1 team takes it from here, and every change shows in your change log.",
  );
});
