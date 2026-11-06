import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// GAS UI/UX prototypes (Example data): every route and state, both themes, axe clean, no console errors,
// no side scroll. Screenshots land in docs/qa/gas-proto/ when GAS_SHOTS=1.
const PAGES: Record<string, string[]> = {
  "": [""],
  loop: ["audit", "connect", "ready", "fixes", "score", "report"].map((s) => `step=${s}`),
  fixes: [
    ...["success", "partial", "empty", "loading", "error"].map((s) => `state=${s}`),
    "state=success&view=team",
    "state=success&order=plain",
  ],
  "ai-access": ["good", "blocked", "js", "cloudflare", "unreachable", "none", "loading"].map((s) => `state=${s}`),
  ready: ["client-waiting", "client-ready", "team-notice", "attention"].map((s) => `state=${s}`),
  narrative: ["clash", "good", "few", "unset", "settings", "settings-empty"].map((s) => `state=${s}`),
  youtube: [
    "tile-saas",
    "tile-restaurant",
    "connecting",
    "connect-error",
    "checklist",
    "partial",
    "empty",
    "loading",
    "suggest",
    "suggest-v2",
  ].map((s) => `state=${s}`),
  mentions: ["success", "partial", "empty", "loading", "error"].map((s) => `state=${s}`),
};
const shots = process.env.GAS_SHOTS === "1";

for (const theme of ["dark", "light"] as const)
  for (const [route, queries] of Object.entries(PAGES))
    for (const query of queries) {
      const url = `/dev/gas${route ? `/${route}` : ""}${query ? `?${query}` : ""}`;
      test(`${url} (${theme}): one H1, axe clean, no console errors`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("pageerror", (e) => errors.push(e.message));
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(url);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.getByText("Example data").first()).toBeVisible();
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          page.viewportSize()!.width,
        );
        expect(errors).toEqual([]);
        // One shot per section: its first state, at 1280 in both themes and 375 in dark.
        if (shots && query === queries[0] && (info.project.name === "desktop" || theme === "dark"))
          await page.screenshot({
            path: `docs/qa/gas-proto/${route || "index"}-${info.project.name === "desktop" ? 1280 : 375}-${theme}.png`,
            fullPage: true,
          });
      });
    }

// Below md every interactive target is at least 44px tall (UI.md breakpoints).
test("tap targets are 44px on phones", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  for (const route of Object.keys(PAGES)) {
    await page.goto(`/dev/gas/${route}`);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("main a, main button, main select, main input")]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ el, h: el.getBoundingClientRect().height }))
        .filter(({ h }) => h > 0 && h < 44)
        .map(
          ({ el }) => `${el.tagName} ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}`,
        ),
    );
    expect(small, route).toEqual([]);
  }
});

// The DFY rule: an edit is never applied without the diff, then a confirm, then the change log.
test("team fix edit goes diff → confirm → apply → change log", async ({ page }) => {
  await page.goto("/dev/gas/fixes?view=team");
  await page.getByRole("button", { name: "Review edit" }).first().click();
  await expect(page.getByText("Before", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply this change" }).click();
  await page.getByRole("button", { name: "Yes, apply" }).click();
  await expect(page.getByText("Added to the change log.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Change log" }).getByText("Just now")).toBeVisible();
});
