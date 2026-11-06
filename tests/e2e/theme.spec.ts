import { test, expect } from "@playwright/test";

// v3 O1/O2: data-theme is set before first paint by the root layout's script, so there's no flash.
test("first visit with prefers-color-scheme: light → light /app pages; dark → dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  // The value at DOMContentLoaded is what the first paint used (the script runs in <head>, before <body>).
  await page.goto("/dev/app?state=dashboard-success", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dev/app?state=dashboard-success", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("a saved choice wins over the system setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("rank1.workspace", JSON.stringify({ theme: "light" })));
  await page.goto("/dev/team", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("public pages are always dark, even with a light system and a saved light choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("rank1.workspace", JSON.stringify({ theme: "light" })));
  for (const path of ["/", "/signin", "/privacy"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html"), path).toHaveAttribute("data-theme", "dark");
  }
});

test("the theme script is in the server HTML head, before the body", async ({ request }) => {
  const html = await (await request.get("/dev/app?state=dashboard-success")).text();
  const head = html.slice(0, html.indexOf("<body"));
  expect(head).toContain("dataset.theme");
});

test("v3 fonts: Inter for text, JetBrains Mono available for data", async ({ page }) => {
  await page.goto("/dev/app?state=dashboard-success");
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toMatch(/Inter/);
  const mono = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-mono"));
  expect(mono).toMatch(/JetBrains/);
});

// #92 review: data-theme follows client-side navigation too, with the same rule as the head script.
test("a saved light theme never leaks onto public pages through client-side links", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("rank1.workspace", JSON.stringify({ theme: "light" })));
  await page.goto("/dev/team");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: "Nav", exact: true }).click();
  await page.getByRole("link", { name: "Help" }).click();
  await page.waitForURL("**/contact");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goBack();
  await page.waitForURL("**/dev/team");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

// #92 review, the logo path: a saved light theme on /app → the rail logo → the landing is dark → back is light.
for (const [where, link] of [
  ["the rail logo", "App"],
  ["the breadcrumb Rank1", "Breadcrumb"],
] as const)
  test(`light on /app → ${where} → the landing is dark → back to /app is light`, async ({ page }) => {
    test.skip(where === "the rail logo" && page.viewportSize()!.width < 768, "the rail logo shows from md up");
    // X9a: phones show the page crumb only, so the Rank1 crumb is md+ too.
    test.skip(where === "the breadcrumb Rank1" && page.viewportSize()!.width < 768, "the Rank1 crumb shows from md up");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("rank1.workspace", JSON.stringify({ theme: "light" })));
    await page.goto("/dev/app?state=dashboard-success");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("navigation", { name: link }).getByRole("link", { name: "Rank1" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.goBack();
    await page.waitForURL("**/dev/app**");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

// #92 review, the header logo (AppHeader on /client): needs the local stack to sign a client in.
test("light on /client → the header logo → the landing is dark → back to /client is light", async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
  const { newUser, openMagicLink } = await import("./helpers/auth");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("rank1.workspace", JSON.stringify({ theme: "light" })));
  await openMagicLink(page, (await newUser("theme-client", "dfy_client")).email);
  await page.waitForURL("**/client");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("banner").getByRole("link", { name: "Rank1" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goBack();
  await page.waitForURL("**/client");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
