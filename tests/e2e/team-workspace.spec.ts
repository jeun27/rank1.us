import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { buildWorkspace } from "@/lib/queries/workspace";
import { buildBrief, CLAUDE_URL, contextFor } from "@/lib/workspace/context";
import { exampleWorkspaceRows } from "@/app/team/example-data";
import { newUser, openMagicLink } from "./helpers/auth";

// Every test here signs in a seeded team user, which needs the local stack's service-role key.
test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");

const NOW = new Date("2026-11-05T12:00:00Z");
const view = buildWorkspace(exampleWorkspaceRows());
const dashboardBrief = buildBrief(contextFor(view, { kind: "section", section: "dashboard" }), NOW);
const THEMES = ["light", "dark"] as const;
const BG = { light: "rgb(247, 244, 238)", dark: "rgb(11, 11, 12)" };

const isMobile = (page: Page) => page.viewportSize()!.width < 768;

// /team is for signed-in team users: sign one in through the emailed-link callback.
async function open(page: Page, theme: (typeof THEMES)[number]) {
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ colorScheme: theme });
  const user = await newUser("team", "team");
  await openMagicLink(page, user.email);
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

// Bottom tab bar on phones; every pane is on screen on desktop.
async function show(page: Page, pane: "Nav" | "Context" | "Document") {
  if (isMobile(page)) await page.getByRole("tab", { name: pane, exact: true }).click();
}

// The first match is the section nav; Recents can repeat a name below it.
const navTo = (page: Page, name: string) =>
  page.locator("nav").getByRole("button", { name, exact: true }).first().click();

const axeClean = async (page: Page) => {
  // Let the 150ms pane fade finish so contrast is measured at full opacity.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

for (const theme of THEMES) {
  test(`/team ${theme}: 3 landmarks, one H1, Example data, axe clean`, async ({ page }, info) => {
    await open(page, theme);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(BG[theme]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("nav")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("aside")).toHaveCount(1);
    await expect(page.getByText("Example data").first()).toBeAttached();

    if (isMobile(page)) {
      await expect(page.getByRole("tablist", { name: "Workspace" })).toBeVisible();
      for (const pane of ["Nav", "Context", "Document"] as const) {
        await show(page, pane);
        await axeClean(page);
      }
      await show(page, "Context");
    } else {
      await expect(page.locator("nav")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("aside")).toBeVisible();
      await axeClean(page);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page.screenshot({ path: `test-results/screenshots/team-${theme}-${info.project.name}.png` });

    // A question with its answers and cited sources, open in the document pane.
    await show(page, "Nav");
    await navTo(page, "Questions");
    await show(page, "Context");
    await page.locator("main").getByRole("button", { name: view.questions[0].text }).click();
    await show(page, "Document");
    await expect(page.getByRole("tabpanel").getByRole("heading", { name: view.questions[0].text })).toBeVisible();
    await axeClean(page);
    await page.screenshot({ path: `test-results/screenshots/team-${theme}-question-${info.project.name}.png` });
  });
}

test("/app is not the team workspace (reserved for owners); the team nav is dark in both themes", async ({ page }) => {
  await page.goto("/app");
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/signin?next=%2Fapp");
  for (const theme of THEMES) {
    await open(page, theme);
    await show(page, "Nav");
    const nav = page.locator("nav");
    await expect(nav).toHaveAttribute("data-theme", "dark");
    expect(await nav.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(BG.dark);
    expect(await nav.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(242, 239, 233)");
  }
});

test("Copy context writes the dashboard brief Markdown; Open in Claude copies it and opens ?q=", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, "light");
  await show(page, "Context");
  await page.getByRole("button", { name: "Copy context" }).click();
  await expect(page.getByRole("status")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dashboardBrief);

  await page.evaluate(() => navigator.clipboard.writeText(""));
  const link = page.getByRole("link", { name: "Open in Claude" });
  // Exactly https://claude.ai: no ?q= prefill and no data in the URL (Step 11).
  await expect(link).toHaveAttribute("href", CLAUDE_URL);
  await expect(link).toHaveAttribute("target", "_blank");
  await context.route("https://claude.ai/**", (r) => r.fulfill({ body: "ok" }));
  const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
  expect(popup.url()).toBe("https://claude.ai/");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dashboardBrief);
  await expect(page.getByRole("status")).toHaveText("Brief copied. Paste it in Claude if the box is empty.");
});

test("the prompt template is added to the brief; nothing calls a model", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  await open(page, "light");
  await show(page, "Context");
  await page.getByLabel("Prompt template").fill("Draft 3 fixes.");
  await page.getByRole("button", { name: "Copy context" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${dashboardBrief}\n## Prompt template\n\nDraft 3 fixes.\n`,
  );
  expect([...hosts].filter((h) => h !== new URL(page.url()).host)).toEqual([]);
});

test("document tabs: roving focus, Home/End, Delete closes, +, expand and split, Esc", async ({ page }) => {
  await open(page, "light");
  await show(page, "Nav");
  for (const name of ["Competitors", "Sources"]) {
    await navTo(page, name);
    await show(page, "Nav");
  }
  await show(page, "Document");
  const tabs = page.getByRole("tablist", { name: "Document" }).getByRole("tab");
  await expect(tabs).toHaveText(["Dashboard", "Competitors", "Sources"]);
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(2)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(0)).toHaveAttribute("tabindex", "-1");

  await tabs.nth(2).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(0)).toBeFocused();
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", (await tabs.nth(0).getAttribute("id"))!);
  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(2)).toBeFocused();
  await page.keyboard.press("Delete");
  await expect(tabs).toHaveText(["Dashboard", "Competitors"]);
  await expect(tabs.nth(1)).toBeFocused();

  // Close tab closes the active tab (Competitors).
  await page.getByRole("button", { name: "Close tab" }).click();
  await expect(tabs).toHaveText(["Dashboard"]);
  await page.getByRole("button", { name: "New tab" }).click();
  await expect(tabs).toHaveText(["Dashboard", "New tab"]);
  await page.getByRole("tabpanel").getByRole("button", { name: "History" }).click();
  await expect(tabs).toHaveText(["Dashboard", "History"]);

  if (!isMobile(page)) {
    const split = page.getByRole("button", { name: "Split" });
    await split.click();
    await expect(split).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("tabpanel")).toHaveCount(2);
    await split.click();
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
  }
  const expand = page.getByRole("button", { name: "Expand" });
  await expand.click();
  await expect(expand).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("nav")).toBeHidden();
  await expect(page.locator("main")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(expand).toHaveAttribute("aria-pressed", "false");
  if (!isMobile(page)) await expect(page.locator("main")).toBeVisible();
});

test("theme toggle, split ratio and sidebar collapse persist across reloads", async ({ page }) => {
  test.skip(isMobile(page), "the divider and the sidebar collapse are desktop only");
  await open(page, "light");
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const sep = page.getByRole("separator", { name: "Resize panes" });
  await expect(sep).toHaveAttribute("aria-valuenow", "50");
  await expect(sep).toHaveAttribute("aria-valuemin", "30");
  await expect(sep).toHaveAttribute("aria-valuemax", "70");
  await sep.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(sep).toHaveAttribute("aria-valuenow", "60");
  await page.keyboard.press("End");
  await expect(sep).toHaveAttribute("aria-valuenow", "70");
  await page.keyboard.press("ArrowLeft");
  await expect(sep).toHaveAttribute("aria-valuenow", "65");
  const share = async () => {
    const [m, a] = [await page.locator("main").boundingBox(), await page.locator("aside").boundingBox()];
    return Math.round((m!.width / (m!.width + a!.width)) * 100);
  };
  await expect.poll(share).toBe(65);

  const collapse = page.getByRole("button", { name: "Collapse sidebar" });
  await collapse.click();
  await expect(collapse).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await page.locator("nav").boundingBox())!.width).toBeLessThanOrEqual(64);

  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("separator", { name: "Resize panes" })).toHaveAttribute("aria-valuenow", "65");
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-expanded", "false");
  await axeClean(page);
});

test("tap targets are at least 44px", async ({ page }) => {
  await open(page, "light");
  for (const pane of ["Nav", "Context", "Document"] as const) {
    await show(page, pane);
    const small = await page.locator("button:visible, a:visible, [role=tab]:visible").evaluateAll((els) =>
      els
        .map((e) => ({ t: e.getAttribute("aria-label") ?? e.textContent?.trim(), r: e.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
    );
    expect(small).toEqual([]);
  }
});

test("reduced motion turns pane and tab transitions off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMagicLink(page, (await newUser("team", "team")).email);
  await expect(page).toHaveURL(/\/team$/);
  const durations = await page.locator("[data-motion]").evaluateAll((els) =>
    els.map((e) => {
      const cs = getComputedStyle(e);
      return `${cs.transitionProperty === "none" ? "none" : cs.transitionDuration} ${cs.animationName}`;
    }),
  );
  expect(durations.length).toBeGreaterThan(0);
  for (const d of durations) expect(d).toMatch(/^(none|0s(, 0s)*) none$/);
});

const norm = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
const COPY = norm(readFileSync("docs/COPY.md", "utf8").replace(/\\\|/g, "|"));

test("every visible string, aria-label and title is in docs/COPY.md (data excluded)", async ({ page }) => {
  await open(page, "light");
  const seen = new Set<string>();
  const collect = async () => {
    const found = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const el = n.parentElement!;
          if (n.textContent!.trim() && !el.closest("[data-computed]") && el.checkVisibility()) out.push(n.textContent!);
          return;
        }
        n.childNodes.forEach(walk);
      };
      walk(document.body);
      for (const el of document.querySelectorAll("[aria-label], [title]"))
        for (const a of ["aria-label", "title"])
          if (el.getAttribute(a) && !el.closest("[data-computed]")) out.push(el.getAttribute(a)!);
      return out;
    });
    found.forEach((t) => seen.add(norm(t)));
  };
  for (const name of [
    "Dashboard",
    "Questions",
    "Competitors",
    "Sources",
    "Fix list",
    "Experiments",
    "Reports",
    "History",
    "Settings",
  ]) {
    await show(page, "Nav");
    await navTo(page, name);
    await collect();
    await show(page, "Document");
    await collect();
  }
  await page.getByRole("button", { name: "New tab" }).click();
  await collect();
  expect(seen.size).toBeGreaterThan(30);
  // Whole words or phrases only, so a short label can't pass by sitting inside a longer word.
  const inCopy = (v: string) =>
    new RegExp(`(^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(COPY);
  expect([...seen].filter((v) => v && !inCopy(v))).toEqual([]);
});
