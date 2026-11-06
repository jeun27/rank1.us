// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { checkAiAccess, crawlerResults, GPTBOT_UA, JS_EMPTY_WORDS, visibleWords } from "@/lib/site/ai-access";

const PUBLIC = async () => [{ address: "93.184.216.34" }];
const HTML = `<html><head><title>Example Ramen House</title><script>var x = "${"js ".repeat(200)}"</script></head>
<body><h1>Example Ramen House</h1><p>${"Tonkotsu ramen with chashu pork and soft egg. ".repeat(12)}</p></body></html>`;

// A fetch-shaped fake site: robots.txt, the homepage for our UA, and the homepage for the GPTBot UA.
function site(o: {
  robots?: string | number;
  home?: string;
  homeStatus?: number;
  gptbotStatus?: number;
  gptbotBody?: string;
  headers?: Record<string, string>;
}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const ua = (init?.headers as Record<string, string>)["User-Agent"];
    if (url.pathname === "/robots.txt")
      return typeof o.robots === "number"
        ? new Response("", { status: o.robots })
        : new Response(o.robots ?? "", { status: 200, headers: { "content-type": "text/plain" } });
    const gpt = ua === GPTBOT_UA;
    return new Response(gpt ? (o.gptbotBody ?? o.home ?? HTML) : (o.home ?? HTML), {
      status: gpt ? (o.gptbotStatus ?? 200) : (o.homeStatus ?? 200),
      headers: { "content-type": "text/html", ...o.headers },
    });
  });
}
const run = (fetch: typeof globalThis.fetch, domain = "example-ramen.test") =>
  checkAiAccess(domain, { transport: (u, init) => fetch(u, init), lookup: PUBLIC });

describe("crawlerResults", () => {
  it("all 6 crawlers on '/', with the deciding robots.txt line", () => {
    const robots = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nDisallow: /admin";
    expect(crawlerResults(robots)).toEqual([
      { agent: "GPTBot", allowed: false, line: "Disallow: /" },
      { agent: "OAI-SearchBot", allowed: true, line: "Allow: /" },
      { agent: "ChatGPT-User", allowed: true, line: "Allow: /" },
      { agent: "ClaudeBot", allowed: true, line: "Allow: /" },
      { agent: "PerplexityBot", allowed: true, line: "Allow: /" },
      { agent: "Google-Extended", allowed: true, line: "Allow: /" },
    ]);
  });

  it("a missing robots.txt allows everyone, with no line", () => {
    expect(crawlerResults("").every((c) => c.allowed && c.line === null)).toBe(true);
  });
});

describe("visibleWords", () => {
  it("counts words a reader sees: no scripts, styles or tags", () => {
    expect(visibleWords("<p>Hello <b>ramen</b> world</p><script>a b c d</script><style>x{}</style>")).toBe(3);
    expect(visibleWords('<div id="root"></div><script src="/app.js"></script>')).toBe(0);
  });
});

describe("checkAiAccess", () => {
  it("good: robots allows all, the page has text, GPTBot gets the same answer, no Cloudflare", async () => {
    const r = await run(site({ robots: "User-agent: *\nAllow: /" }));
    expect(r).toMatchObject({
      domain: "example-ramen.test",
      outcome: "good",
      statusNormal: 200,
      statusGptbot: 200,
      cloudflare: false,
      pagesChecked: 1,
    });
    expect(r.crawlers).toHaveLength(6);
    expect(r.visibleWords).toBeGreaterThan(JS_EMPTY_WORDS);
  });

  it("blocked: any crawler disallowed on '/'", async () => {
    expect((await run(site({ robots: "User-agent: ClaudeBot\nDisallow: /" }))).outcome).toBe("blocked");
  });

  it.each([403, 429, 503])(
    "a GPTBot-UA %i while our UA gets 200 is only a soft edge hint, never 'blocked' (bot managers block unverified GPTBot UAs)",
    async (status) => {
      const r = await run(site({ gptbotStatus: status }));
      expect(r).toMatchObject({ outcome: "cloudflare", statusNormal: 200, statusGptbot: status, cloudflare: false });
    },
  );

  it("a challenge page for the GPTBot UA is the same soft hint", async () => {
    const r = await run(site({ gptbotBody: "<title>Just a moment...</title><div id=cf-chl-widget></div>" }));
    expect(r.outcome).toBe("cloudflare");
  });

  it("'blocked' comes from robots.txt only", async () => {
    expect((await run(site({ robots: "User-agent: *\nAllow: /", gptbotStatus: 403 }))).outcome).not.toBe("blocked");
    expect((await run(site({ robots: "User-agent: GPTBot\nDisallow: /" }))).outcome).toBe("blocked");
  });

  it("the GPTBot-UA request says it's a Rank1 test, and goes to the homepage only, once", async () => {
    expect(GPTBOT_UA).toBe(
      "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot) Rank1-AccessCheck/1.0 (+https://rank1.us)",
    );
    const fetch = site({});
    await run(fetch);
    const asBot = fetch.mock.calls.filter((c) => (c[1]?.headers as Record<string, string>)["User-Agent"] === GPTBOT_UA);
    expect(asBot.map((c) => new URL(String(c[0])).pathname)).toEqual(["/"]);
  });

  it("one 15 s deadline for the whole check: once it's spent, no further request is made", async () => {
    let t = 1_000_000;
    const slow = vi.fn<typeof fetch>(async (input, init) => {
      t += 8_000; // each request "takes" 8 s
      return site({})(input, init);
    });
    const r = await checkAiAccess("example-ramen.test", {
      transport: (u, init) => slow(u, init),
      lookup: PUBLIC,
      now: () => t,
    });
    expect(slow).toHaveBeenCalledTimes(2); // robots (8 s) + home (16 s) → no GPTBot request
    expect(r).toMatchObject({ statusGptbot: null, pagesChecked: 1 });
  });

  it(`js_empty: under ${JS_EMPTY_WORDS} visible words without JavaScript`, async () => {
    const r = await run(
      site({ home: '<html><body><div id="root"></div><script src="/app.js"></script></body></html>' }),
    );
    expect(r).toMatchObject({ outcome: "js_empty", visibleWords: 0 });
  });

  it("cloudflare: a hint from cf-ray or server: cloudflare when nothing else is wrong", async () => {
    expect((await run(site({ headers: { "cf-ray": "8f0000000000-LAX" } }))).outcome).toBe("cloudflare");
    expect((await run(site({ headers: { server: "cloudflare" } }))).cloudflare).toBe(true);
    // A robots.txt block outranks the hint.
    expect(
      (await run(site({ robots: "User-agent: ClaudeBot\nDisallow: /", headers: { server: "cloudflare" } }))).outcome,
    ).toBe("blocked");
  });

  it("unreachable: the homepage fails, or the domain is refused by the guard", async () => {
    expect((await run(site({ homeStatus: 500, gptbotStatus: 500 }))).outcome).toBe("unreachable");
    const r = await checkAiAccess("example-ramen.test", { lookup: async () => [{ address: "10.0.0.1" }] });
    expect(r).toMatchObject({
      outcome: "unreachable",
      pagesChecked: 0,
      statusNormal: null,
      errorCode: "blocked_address",
    });
    expect((await run(site({ homeStatus: 500, gptbotStatus: 500 }))).errorCode).toBe("http_500");
  });

  it("makes at most 3 requests: robots.txt, the homepage, the homepage as GPTBot", async () => {
    const fetch = site({});
    await run(fetch);
    expect(fetch).toHaveBeenCalledTimes(3);
    const uas = fetch.mock.calls.map((c) => (c[1]?.headers as Record<string, string>)["User-Agent"]);
    expect(uas.filter((u) => u === GPTBOT_UA)).toHaveLength(1);
  });

  it("a robots.txt that fails to load reports every crawler as allowed (nothing to show), not blocked", async () => {
    const r = await run(site({ robots: 500 }));
    expect(r.crawlers.every((c) => c.allowed)).toBe(true);
  });

  it("an invalid domain is unreachable with no request", async () => {
    const fetch = site({});
    expect(await run(fetch, "localhost")).toMatchObject({ outcome: "unreachable", errorCode: "bad_domain" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
