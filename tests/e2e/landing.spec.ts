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
  // Reduced motion: the hero demo shows its settled card line (COPY.md), not a mid-run count-up frame.
  await page.emulateMedia({ reducedMotion: "reduce" });
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

// v3 (D34): the dark landing's primary fill is the accent, Jelly blue #279EF2.
test("at most one accent primary button in the viewport at any scroll position", async ({ page }) => {
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
          getComputedStyle(el).backgroundColor === "rgb(39, 158, 242)"
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
  // v3 (lead, O2): 44px below md (UI.md); from md up the dense 32px controls apply (checked in dev-ui.spec).
  test.skip(page.viewportSize()!.width >= 768, "44px tap targets apply below md");
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

// ---- v3 PR 3 (D37-D41, lead OK 2026-11-06) ----
const ACCENT = "rgb(39, 158, 242)";
const demo = (page: Page) => page.locator("[data-demo]");
const isMobile = (page: Page) => page.viewportSize()!.width < 768;

test("hero: one H1 read as one sentence, line 2 in the accent; H1 + CTA left, sub right (stacked < md)", async ({
  page,
}) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1, name: "Be the brand AI names first.", exact: true });
  await expect(h1).toHaveCount(1);
  expect(await h1.getByText("AI names first.").evaluate((el) => getComputedStyle(el).color)).toBe(ACCENT);
  expect(await h1.getByText("Be the brand").evaluate((el) => getComputedStyle(el).color)).not.toBe(ACCENT);
  const sub = page.locator("[data-hero-sub]");
  await expect(sub.locator("[data-engine-tag]")).toHaveText(["ChatGPT", "Gemini", "Google AI Overview", "Perplexity"]);
  const [h, b, cta] = [
    (await h1.boundingBox())!,
    (await sub.boundingBox())!,
    (await page.locator("#hero").getByRole("link", { name: "Get my free audit" }).boundingBox())!,
  ];
  if (isMobile(page)) expect(b.y).toBeGreaterThan(h.y + h.height - 1);
  else {
    expect(b.x).toBeGreaterThan(h.x + h.width / 2);
    expect(cta.x).toBeLessThan(b.x);
  }
  // 40h primary in the hero from md up (UI.md), 44 below md.
  expect(cta.height).toBe(isMobile(page) ? 44 : 40);
  // Decorative glows: aria-hidden, never in the a11y tree.
  const glows = page.locator("[data-glow]");
  expect(await glows.count()).toBeGreaterThanOrEqual(4);
  for (const g of await glows.all()) await expect(g).toHaveAttribute("aria-hidden", "true");
});

test("demo window: a 12px frame with the window shadow; Example data; the typed question in mono", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const d = demo(page);
  const css = await d.evaluate((el) => {
    const c = getComputedStyle(el);
    return { radius: c.borderTopLeftRadius, shadow: c.boxShadow, border: c.borderTopWidth };
  });
  // Tailwind lists its (empty) ring layers before the shadow token.
  expect(css).toMatchObject({ radius: "12px", border: "1px" });
  expect(css.shadow).toMatch(/rgba\(0, 0, 0, 0\.7\) 0px 30px 80px -20px$/);
  await expect(d.getByText("Example data")).toBeVisible();
  const q = d.locator("[data-demo-question]");
  await expect(q).toHaveText("best ramen in Irvine");
  expect(await q.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/JetBrains Mono/i);
  await expect(d.locator("[data-demo-bar]")).toHaveCount(4);
  await expect(d.locator("[data-demo-row]")).toHaveCount(4);
  // The n rule: the sample size sits under the leaderboard.
  const sample = d.locator("[data-demo-sample]");
  await expect(sample).toHaveText("From 160 answers");
  const [board, under] = [(await d.locator("ol").boundingBox())!, (await sample.boundingBox())!];
  expect(under.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
});

// The final state, as the server renders it: 34% of 160, You 2nd (past Example Udon House), bars full.
const expectFinal = async (page: Page) => {
  const d = demo(page);
  await expect(d).toHaveAttribute("data-demo-state", "final");
  await expect(d.locator("[data-demo-question]")).toHaveText("best ramen in Irvine");
  await expect(d.locator("[data-hero-text]")).toHaveText("named in 34% of 160 answers, +6 pts");
  await expect(d.locator("[data-demo-row]").nth(1)).toHaveAttribute("data-you", "");
  await expect(d.locator("[data-demo-row][data-you]")).toContainText("2");
  for (const bar of await d.locator("[data-demo-fill]").all())
    expect(await bar.evaluate((el) => getComputedStyle(el).visibility)).toBe("visible");
};

test("reduced motion: the demo shows its final state, no movement", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await demo(page).scrollIntoViewIfNeeded();
  await expectFinal(page);
  await page.waitForTimeout(800);
  await expectFinal(page);
  await demo(page).screenshot({ path: `test-results/screenshots/landing-demo-final-${info.project.name}.png` });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the landing renders and the demo is in its final state", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/(^|\s)js(\s|$)/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Be the brand AI names first.");
    await expectFinal(page);
    await expect(demo(page)).toBeVisible();
  });
});

test("motion on: the demo runs once when it scrolls into view, then ends on the final state", async ({
  page,
}, info) => {
  await page.goto("/");
  const d = demo(page);
  // Above the fold on desktop; on phones it starts when scrolled to.
  await d.scrollIntoViewIfNeeded();
  await expect(d).toHaveAttribute("data-demo-state", "running");
  // Mid-run: the question is part typed.
  await expect.poll(async () => (await d.locator("[data-demo-question]").textContent())!.length).toBeGreaterThan(3);
  expect((await d.locator("[data-demo-question]").textContent())!.length).toBeLessThan("best ramen in Irvine".length);
  await d.screenshot({ path: `test-results/screenshots/landing-demo-mid-${info.project.name}.png` });
  await expect(d).toHaveAttribute("data-demo-state", "final", { timeout: 8000 });
  await expectFinal(page);
  const ran = await d.innerText();
  // Once only: scrolling away and back doesn't replay it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await d.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(d).toHaveAttribute("data-demo-state", "final");
  // It ends on exactly the DOM the server renders (and reduced motion shows).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(await demo(page).innerText()).toBe(ran);
});

test("Jelly: 72px on the demo corner (hidden on phones); 96px in the final CTA (hidden on phones)", async ({
  page,
}) => {
  await page.goto("/");
  const hero = demo(page).locator("img[src*='jelly']");
  const cta = page.locator("#audit img[src*='jelly']");
  if (isMobile(page)) {
    await expect(hero).toBeHidden();
    await expect(cta).toBeHidden();
    return;
  }
  expect((await hero.boundingBox())!.width).toBe(72);
  expect((await cta.boundingBox())!.width).toBe(96);
  await expect(cta).toHaveAttribute("alt", "");
});

test("D38 frames: bento features, one bordered steps list, sticky comparison header, pricing and CTA frames", async ({
  page,
}) => {
  await page.goto("/");
  const box = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => {
        const c = getComputedStyle(el);
        return { border: c.borderTopWidth, radius: c.borderTopLeftRadius, gap: c.rowGap };
      });
  // Bento: one 12px frame with shared hairlines (no gaps between the cards).
  expect(await box("#features [data-bento]")).toEqual({ border: "1px", radius: "12px", gap: "normal" });
  await expect(page.locator("#features [data-bento] > li")).toHaveCount(3);
  // Steps: one bordered list.
  expect((await box("#how-it-works ol")).border).toBe("1px");
  await expect(page.locator("#how-it-works ol > li")).toHaveCount(3);
  // Comparison: sticky header; the pinned Rank1 column is blue-tinted.
  const th = page.locator("#comparison thead th").first();
  expect(await th.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  const rank1 = page.locator("#comparison").getByRole("columnheader", { name: "Rank1" });
  expect(await rank1.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(20, 38, 59)");
  // Pricing and the final CTA: 12px frames, each with a glow.
  expect((await box("#pricing [data-frame]")).radius).toBe("12px");
  await expect(page.locator("#pricing [data-glow]")).toHaveCount(1);
  expect(await box("#audit [data-frame]")).toMatchObject({ border: "1px", radius: "12px" });
  await expect(page.locator("#audit [data-glow]")).toHaveCount(1);
});
