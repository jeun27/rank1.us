import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SECTIONS = ["hero", "how-it-works", "features", "screenshots", "comparison", "pricing", "faq", "audit"];

// Lowercase, straight quotes, single spaces, no trailing period (FAQ answers add one: lead, 2026-11-05).
const norm = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
const COPY = norm(readFileSync("docs/COPY.md", "utf8").replace(/\\\|/g, "|"));

const sticky = (page: Page) => page.locator("[data-sticky-cta]");
const scrollTo = async (page: Page, id: string) => {
  await page.locator(`#${id}`).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(150);
};

test("landing: one H1, 9 sections in order (social proof hidden), axe clean", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Be the brand AI names first.");
  const ids = await page.locator("main > section").evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(SECTIONS);
  await expect(page.locator("#social-proof")).toHaveCount(0);
  await expect(page.getByText("Built for businesses that want AI to name them.")).toHaveCount(0);
  await expect(page.getByText("[PLACEHOLDER")).toHaveCount(0);

  const levels = await page.locator("h1, h2, h3, h4").evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
  levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1]).toBeLessThanOrEqual(1));

  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  await expect(page).toHaveTitle("Rank1 - Be the brand AI names first.");

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  await page.screenshot({ path: `test-results/screenshots/landing-${info.project.name}.png`, fullPage: true });
});

test("every visible string is in docs/COPY.md (fixture data excluded)", async ({ page }) => {
  await page.goto("/");
  // Open every FAQ and tab so hidden copy is checked too.
  for (const d of await page.locator("details").all())
    await d.evaluate((el) => ((el as HTMLDetailsElement).open = true));
  const lines: string[] = [];
  for (const tab of await page.getByRole("tab").all()) {
    await tab.click();
    lines.push(
      ...(await page.evaluate(() => {
        const out: string[] = [];
        const walk = (n: Node) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const el = n as HTMLElement;
            if (el.hasAttribute("data-computed") || getComputedStyle(el).display === "none") return;
            if (el.matches("h1,h2,h3,p,li,summary,a,button,th,td,blockquote,span,caption") && el.innerText.trim()) {
              const own = [...el.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent!.trim());
              if (own) out.push(...el.innerText.split("\n"));
            }
          }
          n.childNodes.forEach(walk);
        };
        walk(document.body);
        return out;
      })),
    );
  }
  // Guard against a walker that silently collects nothing.
  expect(lines.length).toBeGreaterThan(60);
  const missing = [...new Set(lines.map(norm).filter(Boolean))].filter((l) => !COPY.includes(l));
  expect(missing).toEqual([]);
});

test('every aria-label, title and alt is in docs/COPY.md (alt="" is fine)', async ({ page }) => {
  await page.goto("/");
  const attrs = await page.evaluate(() =>
    [...document.querySelectorAll("[aria-label], [title], [alt]")].flatMap((el) =>
      ["aria-label", "title", "alt"].filter((a) => el.hasAttribute(a)).map((a) => ({ a, v: el.getAttribute(a)! })),
    ),
  );
  expect(attrs.length).toBeGreaterThan(0);
  // Whole words or phrases only, so a short label like "Main" can't pass by sitting inside "domain".
  const inCopy = (v: string) =>
    new RegExp(`(^|[^a-z0-9])${norm(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(COPY);
  const missing = attrs.filter(({ v }) => v.trim() !== "" && !inCopy(v)).map(({ a, v }) => `${a}="${v}"`);
  expect(missing).toEqual([]);
});

test("hero numbers come from the example fixture", async ({ page }) => {
  await page.goto("/");
  // 55 of 160 = 34% (floor); 45 of 160 last week = 28%, so +6 pts.
  await expect(page.locator("[data-hero-text]")).toHaveText("named in 34% of 160 answers, +6 pts");
  await expect(page.locator("[data-hero-card]").getByText("Example data")).toBeVisible();
});

test("screenshot tablist: arrow keys, Home/End, one visible panel", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveText(["Dashboard", "Monthly report", "Audit CSV"]);
  await expect(page.getByRole("tablist", { name: "What you see on Monday." })).toBeVisible();
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel")).toContainText("Engine");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.first()).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#screenshots").getByText("Example data").first()).toBeVisible();
  const border = await page.getByRole("tablist").evaluate((el) => getComputedStyle(el.parentElement!).borderTopWidth);
  expect(border).toBe("1px");
});

test("sticky bar: below md only, after the hero, hidden over #pricing and #audit", async ({ page }, info) => {
  await page.goto("/");
  await expect(sticky(page)).toBeHidden();
  await scrollTo(page, "features");
  if (info.project.name === "desktop") {
    await expect(sticky(page)).toBeHidden();
    return;
  }
  await expect(sticky(page)).toBeVisible();
  await expect(sticky(page).getByRole("link", { name: "Get my free audit" })).toHaveAttribute("href", "#audit");
  await scrollTo(page, "pricing");
  await expect(sticky(page)).toBeHidden();
  await scrollTo(page, "screenshots");
  await expect(sticky(page)).toBeVisible();
  await scrollTo(page, "audit");
  await expect(sticky(page)).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(sticky(page)).toBeHidden();
});

test("at most one jellyDeep primary button in the viewport at any scroll position", async ({ page }) => {
  await page.goto("/");
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = page.viewportSize()!.height / 3;
  for (let y = 0; y < height; y += step) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(100);
    const n = await page.evaluate(() => {
      const vh = window.innerHeight;
      return [...document.querySelectorAll<HTMLElement>("a, button")].filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          el.offsetParent !== null &&
          r.bottom > 0 &&
          r.top < vh &&
          getComputedStyle(el).backgroundColor === "rgb(26, 95, 191)"
        );
      }).length;
    });
    expect(n, `scrollY ${y}`).toBeLessThanOrEqual(1);
  }
});

test("the footer's last link stays clickable above the sticky bar", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const last = page.locator("footer a").last();
  await expect(last).toHaveText("Terms");
  const hit = await last.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el === top || el.contains(top);
  });
  expect(hit).toBe(true);
  // Even with the bar forced visible, it never overlaps the footer.
  await sticky(page).evaluate((el) => el.removeAttribute("hidden"));
  const bar = await sticky(page).boundingBox();
  const link = await last.boundingBox();
  if (bar && (await sticky(page).isVisible())) expect(link!.y + link!.height).toBeLessThanOrEqual(bar.y);
});

test("comparison: Rank1 column pinned; the only horizontal scroll on the page", async ({ page }, info) => {
  await page.goto("/");
  const pageW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageW).toBeLessThanOrEqual(page.viewportSize()!.width);

  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
      .map((el) => (el.hasAttribute("data-scroll-exempt") ? "comparison" : el.outerHTML.slice(0, 80))),
  );
  expect(scrollers).toEqual(info.project.name === "mobile" ? ["comparison"] : []);

  const wrap = page.locator("[data-scroll-exempt]");
  const rank1 = wrap.getByRole("columnheader", { name: "Rank1" });
  const rightEdge = async () => {
    const w = (await wrap.boundingBox())!;
    const c = (await rank1.boundingBox())!;
    return Math.abs(w.x + w.width - (c.x + c.width));
  };
  expect(await rightEdge()).toBeLessThanOrEqual(1);
  await wrap.evaluate((el) => (el.scrollLeft = 120));
  expect(await rightEdge()).toBeLessThanOrEqual(1);
  await expect(wrap.getByRole("columnheader")).toHaveText(["Manual checks", "Enterprise AI trackers", "Rank1"]);
  await expect(wrap.getByRole("rowheader")).toHaveCount(5);
});

test("tap targets are at least 44px tall", async ({ page }) => {
  await page.goto("/");
  const small = await page
    .locator("a:visible, button:visible, summary:visible")
    .evaluateAll((els) =>
      els.map((e) => ({ text: e.textContent?.trim(), h: e.getBoundingClientRect().height })).filter((x) => x.h < 44),
    );
  expect(small).toEqual([]);
});

test("links point at the right places", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("#hero");
  await expect(hero.getByRole("link", { name: "Get my free audit" })).toHaveAttribute("href", "#audit");
  await expect(hero.getByRole("link", { name: "See pricing" })).toHaveAttribute("href", "#pricing");
  await expect(page.locator("#pricing").getByRole("link", { name: "Start for $99/mo" })).toHaveAttribute(
    "href",
    "/signin?next=/app/billing",
  );
  await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/signin");
  await expect(page.locator("#pricing").getByRole("link", { name: "Get my free audit first" })).toHaveAttribute(
    "href",
    "#audit",
  );
  await expect(page.locator("#comparison").getByRole("link", { name: "Start with a free audit" })).toHaveAttribute(
    "href",
    "#audit",
  );
  await expect(page.locator("#audit form")).toHaveCount(1);
  for (const link of await page.getByRole("link", { name: "Contact us" }).all())
    await expect(link).toHaveAttribute("href", "/contact");
  const footer = page.locator("footer").getByRole("link");
  await expect(footer).toHaveText(["Pricing", "FAQ", "Contact us", "Privacy", "Terms"]);
  await expect(page.locator("body")).not.toContainText("@");
});

test("#audit holds the real audit form on the ink band; a mocked 202 shows success", async ({ page }) => {
  // No live calls: the API route is mocked at the network boundary.
  let body: Record<string, string> | null = null;
  await page.route("**/api/audit/request", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  const audit = page.locator("#audit");
  await expect(audit.getByLabel("Email")).toBeVisible();
  await expect(audit.getByLabel("Your domain")).toBeVisible();
  const submit = audit.getByRole("button", { name: "Get my free audit" });
  // v3 (D34, O1 dark): the final CTA uses the accent, Jelly blue.
  expect(await submit.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(39, 158, 242)");
  await audit.getByLabel("Email").fill("owner@example.test");
  await audit.getByLabel("Your domain").fill("ramenhouse.com");
  await submit.click();
  await expect(audit.getByRole("status")).toHaveText("Got it. We'll email your audit to owner@example.test.");
  expect(body).toMatchObject({ email: "owner@example.test", domain: "ramenhouse.com" });
});

test("Contact us in the header, pricing and footer opens the Contact us dialog", async ({ page }) => {
  await page.goto("/");
  for (const where of ["header", "#pricing", "footer"]) {
    await page.locator(where).getByRole("link", { name: "Contact us" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Contact us" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  await expect(page).toHaveURL(/\/$/);
});
