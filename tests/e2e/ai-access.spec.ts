import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// G2 "Can AI see your site?" on Example data (lead OK 2026-11-06): the /audit panel below the leaderboard for
// every outcome, the evidence on the R14 fix in What to fix next, and the /app dashboard's quiet good line.
const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
};
const panel = (scope: Page | Locator) => scope.getByRole("region", { name: "Can AI see your site?" });

const CASES: [string, string | RegExp][] = [
  ["good", "AI can read your site."],
  ["search", "AI search can't read your site: OAI-SearchBot and PerplexityBot are blocked in robots.txt."],
  ["training", "AI search can read your site. You block 1 training crawler, which is your call."],
  ["js", "Your homepage shows almost no text without JavaScript, so ChatGPT can't read what you offer."],
  ["cloudflare", "Your site lets AI in, but Cloudflare may be blocking it."],
  ["edge", /^Your site may be blocking AI crawlers at the edge/],
  ["unreachable", "We couldn't reach exampleramen.test."],
];

for (const [k, line] of CASES)
  test(`/audit ${k}: the answer first, below the leaderboard; axe clean`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/dev/audit?state=free-ai-${k}`);
    const p = panel(page);
    await expect(p.locator("[data-tone]").first()).toHaveText(line);
    const below = await page
      .getByRole("heading", { name: "Competitors" })
      .evaluate(
        (h, el) => Boolean(h.compareDocumentPosition(el!) & Node.DOCUMENT_POSITION_FOLLOWING),
        await p.elementHandle(),
      );
    expect(below).toBe(true);
    if (k === "unreachable") await expect(p.getByRole("table")).toHaveCount(0);
    else await expect(p.getByRole("row")).toHaveCount(7);
    await axeClean(page);
    await p.screenshot({ path: `test-results/screenshots/ai-access-${k}-dark-${info.project.name}.png` });
  });

for (const theme of ["dark", "light"] as const) {
  test(`What to fix next ${theme}: the panel is the R14 fix's evidence; axe clean`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=fixes-ai-access");
    const p5 = page.getByRole("region", { name: "P5: Technical access" });
    await expect(panel(p5)).toBeVisible();
    await expect(p5.getByRole("heading", { level: 4, name: "Can AI see your site?" })).toBeVisible();
    await axeClean(page);
    await p5.screenshot({ path: `test-results/screenshots/ai-access-fixes-${theme}-${info.project.name}.png` });
  });

  test(`dashboard ${theme}: the quiet good line under the hero`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=dashboard-ai-good");
    await expect(page.getByText("AI can read your site · checked 2 h ago")).toBeVisible();
    await axeClean(page);
    await page.screenshot({ path: `test-results/screenshots/ai-access-dashboard-${theme}-${info.project.name}.png` });
  });
}
