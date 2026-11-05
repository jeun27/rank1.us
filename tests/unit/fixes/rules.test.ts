import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COPY, evaluateFixes, type FixResult } from "@/lib/fixes";
import { checkRobots } from "@/lib/fixes/r14-robots";
import { dishNames } from "@/lib/fixes/r11-dishes";
import { fixRules } from "../../../scripts/seed/fix-rules";
import { H, RAMEN, home, menuHtml, site } from "./site";

const run = (pages: Parameters<typeof site>[0], domain: string | null = "example-ramen-house.test") =>
  evaluateFixes({ domain }, site(pages));
const rule = (rs: FixResult[], k: string) => rs.find((r) => r.rule_key === k)!;
const LD = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

describe("copy", () => {
  it("templates are the SCHEMA.md §5b customer copy, verbatim", () => {
    const byKey = Object.fromEntries(fixRules().map((r) => [r.key, r.customer_copy]));
    for (const [k, v] of Object.entries(COPY)) expect(v, k).toBe(byKey[k]);
  });
});

describe("evaluateFixes", () => {
  it("returns R10, R11, R14, H1 in order; a good site is ok on all four", async () => {
    const rs = await run({
      [`${H}/robots.txt`]: { body: "User-agent: *\nAllow: /", type: "text/plain" },
      [`${H}/`]: {
        body: home(LD({ "@context": "https://schema.org", "@type": "Restaurant", name: "Example Ramen House" })),
      },
      [`${H}/menu`]: {
        body: menuHtml(RAMEN).replace(
          "<h1>Menu</h1>",
          "<h1>Menu</h1><h2>Tonkotsu Ramen</h2><h2>Shoyu Ramen</h2><h3>Spicy Miso Ramen</h3><h3>Gyoza (6)</h3><h3>Karaage</h3>",
        ),
      },
    });
    expect(rs.map((r) => [r.rule_key, r.result])).toEqual([
      ["R10", "ok"],
      ["R11", "ok"],
      ["R14", "ok"],
      ["H1", "ok"],
    ]);
    expect(rs.every((r) => r.detail === null)).toBe(true);
  });

  it("no domain → all four unchecked (no_domain), nothing fetched", async () => {
    const rs = await evaluateFixes({ domain: null });
    expect(rs.map((r) => [r.rule_key, r.result, r.evidence.reason])).toEqual([
      ["R10", "unchecked", "no_domain"],
      ["R11", "unchecked", "no_domain"],
      ["R14", "unchecked", "no_domain"],
      ["H1", "unchecked", "no_domain"],
    ]);
  });

  it("an unreachable site → R10, R11, H1 unchecked (site_unreachable); R14 unchecked when robots errored", async () => {
    const rs = await run({ [`${H}/robots.txt`]: "throw", [`${H}/`]: "throw" });
    expect(rs.map((r) => [r.rule_key, r.result, r.evidence.reason])).toEqual([
      ["R10", "unchecked", "site_unreachable"],
      ["R11", "unchecked", "site_unreachable"],
      ["R14", "unchecked", "robots_unreachable"],
      ["H1", "unchecked", "site_unreachable"],
    ]);
  });

  it("robots disallowing Rank1 → page rules unchecked (robots_disallowed), R14 still read", async () => {
    const rs = await run({
      [`${H}/robots.txt`]: { body: "User-agent: *\nDisallow: /", type: "text/plain" },
      [`${H}/`]: { body: home() },
    });
    expect(rule(rs, "R10").evidence.reason).toBe("robots_disallowed");
    expect(rule(rs, "H1").evidence.reason).toBe("robots_disallowed");
    expect(rule(rs, "R14")).toMatchObject({
      result: "fix",
      detail: "Your robots.txt blocks OAI-SearchBot, PerplexityBot from /, /menu. Check if you meant to.",
    });
  });

  it("never calls a paid API: every request goes to the business host", async () => {
    const s = site({ [`${H}/`]: { body: home() }, [`${H}/menu`]: { body: menuHtml(RAMEN) } });
    await evaluateFixes({ domain: "example-ramen-house.test" }, s);
    expect(s.fetch.mock.calls.every((c) => new URL(String(c[0])).hostname === "example-ramen-house.test")).toBe(true);
  });
});

describe("R10 menu", () => {
  it.each([
    [
      "a PDF link (judged by the href, not downloaded)",
      { [`${H}/`]: { body: home().replace('href="/menu"', 'href="/files/menu.pdf"') } },
      "PDF",
      "pdf",
    ],
    [
      "a PDF served at /menu",
      { [`${H}/`]: { body: home() }, [`${H}/menu`]: { body: "%PDF-1.7", type: "application/pdf" } },
      "PDF",
      "pdf",
    ],
    [
      "an image link",
      { [`${H}/`]: { body: home().replace('href="/menu"', 'href="/img/menu.jpg"') } },
      "image",
      "image",
    ],
    [
      "an HTML page of images",
      {
        [`${H}/`]: { body: home() },
        [`${H}/menu`]: { body: '<h1>Menu</h1><img src="1.jpg"><img src="2.jpg"><img src="3.jpg">' },
      },
      "image",
      "image",
    ],
  ])("%s → fix with the copy filled", async (_, pages, word, kind) => {
    const r = rule(await run(pages), "R10");
    expect(r).toMatchObject({
      result: "fix",
      detail: `Your menu is a ${word}; there's no menu page with the dishes as text.`,
      evidence: { kind },
    });
  });

  it("an HTML menu with ≥5 prices → ok", async () => {
    expect(
      rule(await run({ [`${H}/`]: { body: home() }, [`${H}/menu`]: { body: menuHtml(RAMEN) } }), "R10"),
    ).toMatchObject({ result: "ok", evidence: { kind: "html", prices: 5 } });
  });

  it("no menu page → unchecked menu_not_found; an unclear page → unchecked menu_ambiguous", async () => {
    expect(rule(await run({ [`${H}/`]: { body: "<h1>Hi</h1>" } }), "R10").evidence).toMatchObject({
      reason: "menu_not_found",
      kind: "none",
    });
    const amb = rule(
      await run({ [`${H}/`]: { body: home() }, [`${H}/menu`]: { body: "<p>Ramen $12, call us</p>" } }),
      "R10",
    );
    expect(amb).toMatchObject({ result: "unchecked", evidence: { reason: "menu_ambiguous" } });
  });

  it("follows a 'menu' link by text, then falls back to /menu", async () => {
    const pages = { [`${H}/`]: { body: '<a href="/food">See the menu</a>' }, [`${H}/food`]: { body: menuHtml(RAMEN) } };
    expect(rule(await run(pages), "R10")).toMatchObject({ result: "ok", evidence: { menu_url: `${H}/food` } });
  });
});

describe("R11 dishes", () => {
  it("lists up to 5 dishes with no heading or FAQ of their own", async () => {
    const rows: [string, string][] = [...RAMEN, ["Chashu Bowl", "$11"], ["Edamame", "$5"]];
    const r = rule(await run({ [`${H}/`]: { body: home() }, [`${H}/menu`]: { body: menuHtml(rows) } }), "R11");
    expect(r).toMatchObject({
      result: "fix",
      detail:
        "These dishes have no section or page of their own: Tonkotsu Ramen, Shoyu Ramen, Spicy Miso Ramen, Gyoza (6), Karaage.",
    });
    expect(r.evidence).toMatchObject({ dishes_checked: 7, pages_checked: expect.any(Number) });
    expect((r.evidence.uncovered as string[]).length).toBe(7);
  });

  it("a dish named in a heading or FAQ on any crawled page counts, case and diacritics aside", async () => {
    const r = rule(
      await run({
        [`${H}/`]: { body: home() },
        [`${H}/menu`]: { body: menuHtml(RAMEN) },
        [`${H}/about`]: {
          body: '<h2>TONKOTSU RAMEN</h2><details><summary>Is the shoyu ramen vegan?</summary>No.</details><div class="faq-list">Our Spicy Misó Ramen…</div><a href="/faq">FAQ</a>',
        },
        [`${H}/faq`]: {
          body: LD({
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Do you make gyoza (6)?",
                acceptedAnswer: { "@type": "Answer", text: "Yes, and karaage." },
              },
            ],
          }),
        },
      }),
      "R11",
    );
    expect(r).toMatchObject({ result: "ok", evidence: { uncovered: [] } });
  });

  it("crawls at most max_pages and obeys robots for crawled pages", async () => {
    const many = Array.from({ length: 40 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join("");
    const s = site({
      [`${H}/robots.txt`]: { body: "User-agent: *\nDisallow: /p1", type: "text/plain" },
      [`${H}/`]: { body: home() + many },
      [`${H}/menu`]: { body: menuHtml(RAMEN) },
    });
    const rs = await evaluateFixes({ domain: "example-ramen-house.test" }, { ...s, maxPages: 20 });
    expect(rule(rs, "R11").evidence.pages_checked).toBe(20);
    const urls = s.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => /\/p1\d?$/.test(u))).toEqual([]);
    expect(urls.length).toBeLessThanOrEqual(23);
  });

  it("without an HTML menu → unchecked no_html_menu", async () => {
    expect(
      rule(await run({ [`${H}/`]: { body: home().replace('href="/menu"', 'href="/m.pdf"') } }), "R11").evidence.reason,
    ).toBe("no_html_menu");
  });

  it("dishNames: text before the first price, deduped, letters required", () => {
    expect(
      dishNames(
        menuHtml([
          ["Tonkotsu Ramen –", "$15"],
          ["tonkotsu ramen", "$16"],
          ["12", "$3"],
          ["Gyoza:", "7.00"],
        ]),
      ),
    ).toEqual(["Tonkotsu Ramen", "Gyoza"]);
  });
});

describe("R14 robots", () => {
  it.each([
    ["User-agent: OAI-SearchBot\nDisallow: /", "OAI-SearchBot", "/, /menu"],
    ["User-agent: PerplexityBot\nDisallow: /menu", "PerplexityBot", "/menu"],
    ["User-agent: *\nDisallow: /menu", "OAI-SearchBot, PerplexityBot", "/menu"],
  ])("%j → fix naming the blocked bots and paths", (text, bots, paths) => {
    expect(checkRobots({ status: "ok", text })).toMatchObject({
      result: "fix",
      detail: `Your robots.txt blocks ${bots} from ${paths}. Check if you meant to.`,
    });
  });

  it("GPTBot and Google-Extended blocks are info only, never a fix", () => {
    const r = checkRobots({
      status: "ok",
      text: "User-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /",
    });
    expect(r.result).toBe("ok");
    expect(r.evidence.info).toEqual([
      { bot: "GPTBot", paths: ["/", "/menu"] },
      { bot: "Google-Extended", paths: ["/", "/menu"] },
    ]);
  });

  it("a search bot's own Allow group beats a * Disallow", () => {
    expect(
      checkRobots({
        status: "ok",
        text: "User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /",
      }).result,
    ).toBe("ok");
  });

  it("missing robots.txt → ok; unreachable → unchecked", () => {
    expect(checkRobots({ status: "missing", text: "" }).result).toBe("ok");
    expect(checkRobots({ status: "error", text: "" })).toMatchObject({
      result: "unchecked",
      evidence: { reason: "robots_unreachable" },
    });
  });
});

describe("H1 schema", () => {
  it.each([
    ["Restaurant", LD({ "@type": "Restaurant" })],
    [
      "a FoodEstablishment subtype in @graph",
      LD({ "@graph": [{ "@type": "WebSite" }, { "@type": ["LocalBusiness", "CafeOrCoffeeShop"] }] }),
    ],
    ["hasMenu on a LocalBusiness", LD({ "@type": "LocalBusiness", hasMenu: "https://example-ramen-house.test/menu" })],
  ])("%s → ok", async (_, ld) => {
    expect(rule(await run({ [`${H}/`]: { body: home(ld) } }), "H1").result).toBe("ok");
  });

  it("Menu JSON-LD on the menu page → ok", async () => {
    const rs = await run({
      [`${H}/`]: { body: home() },
      [`${H}/menu`]: { body: menuHtml(RAMEN) + LD({ "@type": "Menu" }) },
    });
    expect(rule(rs, "H1")).toMatchObject({ result: "ok", evidence: { types_found: ["Menu"] } });
  });

  it("none, other types or broken JSON-LD → fix with the exact tidy-up copy", async () => {
    const rs = await run({
      [`${H}/`]: { body: home(LD({ "@type": "WebSite" }) + '<script type="application/ld+json">{broken</script>') },
    });
    expect(rule(rs, "H1")).toMatchObject({
      result: "fix",
      detail:
        "Tidy-up: your site has no Restaurant/Menu structured data. This is housekeeping, not an AI visibility fix.",
    });
  });
});
