import { test, expect, type Page } from "@playwright/test";

// Founder fix (lead 17:09): one control shape. Every input, select, textarea, control button and pick chip
// uses the D35 control radius (6px), never a pill; a select hides the native arrow and draws our chevron
// inside a fixed right padding, so it never touches the curve. (Fields with a button inside nest their
// radius: nested-radii.spec.) Measured on the real CSS at 375 and 1280.
const CONTROL = 6;

type Shape = { what: string; radius: number };
const shapes = (page: Page) =>
  page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    };
    const name = (e: Element) =>
      `${e.tagName.toLowerCase()}${e.getAttribute("type") ? `[${e.getAttribute("type")}]` : ""} "${(
        e.getAttribute("aria-label") ??
        e.textContent ??
        ""
      )
        .trim()
        .slice(0, 30)}"`;
    const controls = [
      ...document.querySelectorAll(
        "input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea, button, label:has(> input[type=checkbox])",
      ),
    ].filter(
      (e) =>
        visible(e) &&
        // The field with a button inside owns the shape (nested-radii.spec); its input has no edge of its own.
        !e.closest("[data-field]") &&
        // A switch's track is a pill by definition (the theme toggle).
        !e.matches("[role=switch]") &&
        // Only boxes with an edge or a fill read as a control shape; text actions and icon buttons don't.
        (parseFloat(getComputedStyle(e).borderTopWidth) > 0 ||
          !["rgba(0, 0, 0, 0)", "transparent"].includes(getComputedStyle(e).backgroundColor)),
    );
    return controls.map((e) => ({ what: name(e), radius: parseFloat(getComputedStyle(e).borderTopLeftRadius) }));
  });

const chevrons = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("select")]
      .filter((s) => s.getBoundingClientRect().width > 0)
      .map((s) => {
        const icon = s.parentElement?.querySelector("[data-icon=chevronDown]");
        const sr = s.getBoundingClientRect();
        const ir = icon?.getBoundingClientRect();
        return {
          what: s.getAttribute("aria-label") ?? s.id,
          appearance: getComputedStyle(s).appearance,
          inset: ir ? Math.round(sr.right - ir.right) : -1,
          centred: ir ? Math.abs(ir.top + ir.height / 2 - (sr.top + sr.height / 2)) <= 1 : false,
          clear: ir ? Math.round(sr.right - ir.left) <= parseFloat(getComputedStyle(s).paddingRight) : false,
        };
      }),
  );

const PAGES: { where: string; path: string; prep?: (page: Page) => Promise<void> }[] = [
  { where: "/ (the free audit form)", path: "/" },
  { where: "/signin", path: "/signin" },
  { where: "/contact", path: "/contact" },
  { where: "/dev/ui", path: "/dev/ui" },
  { where: "onboarding (every state)", path: "/dev/onboarding" },
  {
    where: "onboarding step 3 with a row open (Location level)",
    path: "/dev/onboarding",
    prep: (page) =>
      page
        .locator('[data-state="3 success"]')
        .getByRole("group", { name: "1", exact: true })
        .locator("[aria-expanded]")
        .click(),
  },
  { where: "Sources (location select)", path: "/dev/app?state=sources-success" },
  { where: "Experiments form", path: "/dev/app?state=experiments-form" },
  {
    where: "Reports with Branding open",
    path: "/dev/app?state=report-success",
    prep: (page) => page.locator("summary", { hasText: "Branding" }).click(),
  },
  { where: "/dev/team", path: "/dev/team" },
];

for (const p of PAGES)
  test(`${p.where}: controls use the 6px control radius, selects draw a clear chevron`, async ({ page }) => {
    // "load", not networkidle: /contact's Turnstile widget keeps the network busy.
    await page.goto(p.path, { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await p.prep?.(page);
    const off = (await shapes(page)).filter((s: Shape) => s.radius > CONTROL);
    expect(off, "no pills or rounder-than-control controls").toEqual([]);
    for (const c of await chevrons(page)) {
      expect(c.appearance, `${c.what}: no native arrow`).toBe("none");
      expect(c.inset, `${c.what}: chevron ≥ 12px from the right edge`).toBeGreaterThanOrEqual(12);
      expect(c.centred, `${c.what}: chevron vertically centred`).toBe(true);
      expect(c.clear, `${c.what}: chevron inside the right padding`).toBe(true);
    }
  });
