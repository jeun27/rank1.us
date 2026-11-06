import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { admin, newUser, openMagicLink } from "./helpers/auth";
import { seedBusiness } from "./helpers/team";

// Step 11: /team on real data, read through RLS. Needs the local stack's service-role key to seed.
test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");

const isMobile = (page: Page) => page.viewportSize()!.width < 768;
// Phones switch panes with the tab bar. On desktop, Context starts closed (X16), so showing it presses the
// top-bar toggle.
const show = async (page: Page, pane: "Nav" | "Context" | "Document") => {
  if (isMobile(page)) return page.getByRole("tab", { name: pane, exact: true }).click();
  const toggle = page.getByRole("banner").getByRole("button", { name: "Context", exact: true });
  if (pane === "Context" && (await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
};
const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};

test("team sees a DFY client on real data, writes its fix status, and never a self-serve business", async ({
  page,
  context,
}) => {
  const tag = randomUUID().slice(0, 8);
  const dfyName = `Example DFY Ramen ${tag}`;
  const selfName = `Example Self-serve Noodles ${tag}`;
  const dfy = await seedBusiness("dfy", dfyName);
  const selfServe = await seedBusiness("self_serve", selfName);
  const fix = must(
    await admin()
      .from("fixes")
      .insert({
        business_id: dfy,
        rule_key: "R14",
        size: "S",
        title: "robots.txt allows AI search crawlers",
        detail: "Your robots.txt blocks OAI-SearchBot from /menu. Check if you meant to.",
      })
      .select("id")
      .single(),
  );

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openMagicLink(page, (await newUser("team-real", "team")).email);
  const res = await page.goto(`/team?b=${dfy}`);
  expect(res?.status()).toBe(200);

  // The Client switcher (in the breadcrumb, v3 D20) lists DFY clients only, with the selected one chosen.
  await expect(page.locator('select[name="b"]')).toHaveValue(dfy);
  await page.getByRole("button", { name: `Client ${dfyName}` }).click();
  const list = page.getByRole("listbox", { name: "Client" });
  await expect(list.getByRole("option", { name: dfyName })).toHaveAttribute("aria-selected", "true");
  await expect(list.getByRole("option", { name: selfName })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(page.getByText("Example data")).toHaveCount(0);
  await show(page, "Context");

  // Copy context is the stored-data brief for this client.
  await page.getByRole("button", { name: "Copy context" }).click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  expect(brief).toContain(dfyName);
  expect(brief).toContain("API-measured, directional");
  expect(brief).toContain("robots.txt allows AI search crawlers");

  // Fix list: the shared FixList; Done saves through set_fix_status.
  await show(page, "Nav");
  await page.locator("nav").getByRole("button", { name: "What to fix next", exact: true }).first().click();
  await show(page, "Document");
  const card = page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "robots.txt allows" });
  await expect(card).toBeVisible();
  // Let the pane and tab transitions finish, so color-contrast is measured at full opacity (as
  // team-workspace.spec's axeClean does). Flaked on [mobile] once while the Document sheet faded in.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await card.getByRole("checkbox").click();
  await expect
    .poll(async () => must(await admin().from("fixes").select("status").eq("id", fix.id).single()).status)
    .toBe("done");

  // A self-serve business or an unknown id is a real 404, not a page that streams a 200.
  expect((await page.goto(`/team?b=${selfServe}`))?.status()).toBe(404);
  expect((await page.goto(`/team?b=${randomUUID()}`))?.status()).toBe(404);
  expect((await page.goto("/team?b=not-a-uuid"))?.status()).toBe(404);
});

// Review on #60: latest = the newest complete/partial run of kind audit or weekly, as /app does.
test("a DFY client with only an audit run shows its numbers in the panes and the brief", async ({ page, context }) => {
  const tag = randomUUID().slice(0, 8);
  const name = `Example Audit-only Ramen ${tag}`;
  const dfy = await seedBusiness("dfy", name);
  const db = admin();
  const q = must(
    await db
      .from("questions")
      .insert({ business_id: dfy, short_text: "best ramen in Irvine", location_level: "city", city: "Irvine" })
      .select("id")
      .single(),
  );
  const run = must(
    await db
      .from("runs")
      .insert({
        business_id: dfy,
        kind: "audit",
        status: "complete",
        jobs_total: 2,
        jobs_ok: 2,
        started_at: "2026-11-05T12:00:00Z",
        finished_at: "2026-11-05T12:30:00Z",
      })
      .select("id")
      .single(),
  );
  const brands = (mentioned: boolean) => [{ name, kind: "business", mentioned, position: mentioned ? 1 : null }];
  must(
    await db.from("answers").insert(
      [true, false].map((m, i) => ({
        run_id: run.id,
        question_id: q.id,
        engine: "perplexity",
        run_index: i + 1,
        status: "ok",
        question_text_used: "best ramen in Irvine",
        mentioned: m,
        brands: brands(m),
        checked_at: "2026-11-05T12:20:00Z",
      })),
    ),
  );

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openMagicLink(page, (await newUser("team-audit", "team")).email);
  await page.goto(`/team?b=${dfy}`);
  await show(page, "Context");
  await expect(
    page
      .locator("aside")
      .getByText(/· 2 answers ·/)
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Copy context" }).click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  // The overall and Perplexity lines carry the audit's numbers; engines with no answers say so.
  expect(brief).toMatch(/^- Visibility: .*1 of 2 answers/m);
  expect(brief).toMatch(/^- Perplexity: .*1 of 2 answers/m);
  expect(brief).not.toContain("- Visibility: no answers yet");
});
