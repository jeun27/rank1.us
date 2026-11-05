import { describe, expect, it, vi } from "vitest";
import {
  MAX_BYTES,
  USER_AGENT,
  isPrivateAddress,
  matchCuisine,
  readSite,
  robotsAllows,
  siteHost,
  siteName,
} from "@/lib/onboarding/read-site";

// Synthetic sites: Example brands on example.test hosts only.
type Pages = Record<string, { status?: number; body?: string; type?: string; location?: string } | "hang" | "throw">;
function site(pages: Pages) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = String(input);
    const p = pages[url];
    if (p === "hang")
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      );
    if (p === "throw") throw new TypeError("fetch failed");
    if (!p) return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
    const headers: Record<string, string> = { "content-type": p.type ?? "text/html; charset=utf-8" };
    if (p.location) headers.location = p.location;
    return new Response(p.body ?? "", { status: p.status ?? 200, headers });
  });
  const lookup = vi.fn(async (host: string) => [{ address: host.includes("internal") ? "10.0.0.7" : "93.184.216.34" }]);
  return { fetch, lookup, timeoutMs: 50 };
}
const H = "https://example-ramen-house.test";
const home = `<html><head><title>Example Ramen House | Irvine, CA</title>
  <meta property="og:site_name" content="Example Ramen House &amp; Bar"><meta name="description" content="Tonkotsu ramen in Irvine."></head>
  <body><h1>Welcome</h1><script>var pizza = "pizza pizza pizza";</script><p>Our ramen and gyoza.</p></body></html>`;

describe("readSite", () => {
  it("reads the name (og:site_name) and the cuisine from home + /menu, with the Rank1 User-Agent", async () => {
    const d = site({
      [`${H}/`]: { body: home },
      [`${H}/menu`]: { body: "<p>Shoyu ramen, miso ramen, sushi roll</p>" },
    });
    expect(await readSite("example-ramen-house.test", d)).toEqual({
      status: "ok",
      name: "Example Ramen House & Bar",
      cuisine: "ramen",
    });
    const urls = d.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([`${H}/robots.txt`, `${H}/`, `${H}/menu`]);
    for (const c of d.fetch.mock.calls)
      expect((c[1]?.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
    expect(USER_AGENT).toMatch(/Rank1/);
  });

  it("accepts a URL or www form of the domain", async () => {
    const d = site({ [`${H}/`]: { body: home } });
    expect((await readSite("https://www.Example-Ramen-House.test/about", d)).status).toBe("ok");
  });

  it("falls back to the <title> before its separator when there is no og:site_name", async () => {
    expect(siteName("<title>Example Pho Spot – Irvine</title>")).toBe("Example Pho Spot");
    expect(siteName("<title>  Example Izakaya | Home </title>")).toBe("Example Izakaya");
    expect(siteName("<p>no title</p>")).toBeUndefined();
  });

  it("ok without name or cuisine when the page has neither", async () => {
    const d = site({ [`${H}/`]: { body: "<p>Hello</p>" } });
    expect(await readSite("example-ramen-house.test", d)).toEqual({ status: "ok" });
  });

  it("respects robots.txt: Disallow / → unreadable, nothing else fetched", async () => {
    const d = site({
      [`${H}/robots.txt`]: { body: "User-agent: *\nDisallow: /", type: "text/plain" },
      [`${H}/`]: { body: home },
    });
    expect(await readSite("example-ramen-house.test", d)).toEqual({ status: "unreadable" });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it("respects robots.txt: Disallow /menu → home only", async () => {
    const d = site({
      [`${H}/robots.txt`]: { body: "User-agent: *\nDisallow: /menu", type: "text/plain" },
      [`${H}/`]: { body: home },
    });
    expect((await readSite("example-ramen-house.test", d)).status).toBe("ok");
    expect(d.fetch.mock.calls.map((c) => String(c[0]))).not.toContain(`${H}/menu`);
  });

  it("robots rules: a Rank1 group wins over *, longest match wins, Allow wins ties", () => {
    const r = "User-agent: *\nAllow: /\n\nUser-agent: Rank1\nDisallow: /menu\nAllow: /menu/public";
    expect(robotsAllows(r, "/")).toBe(true);
    expect(robotsAllows(r, "/menu")).toBe(false);
    expect(robotsAllows(r, "/menu/public")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /m*", "/menu")).toBe(false);
    expect(robotsAllows("User-agent: OtherBot\nDisallow: /", "/")).toBe(true);
    expect(robotsAllows("", "/")).toBe(true);
  });

  it.each([
    ["HTTP 500", { status: 500, body: "x" }],
    ["a PDF", { body: "%PDF", type: "application/pdf" }],
  ])("home page %s → unreadable", async (_, page) => {
    expect(await readSite("example-ramen-house.test", site({ [`${H}/`]: page }))).toEqual({ status: "unreadable" });
  });

  it("timeout and network error → unreadable, never thrown", async () => {
    expect(await readSite("example-ramen-house.test", site({ [`${H}/`]: "hang" }))).toEqual({ status: "unreadable" });
    expect(
      await readSite("example-ramen-house.test", site({ [`${H}/robots.txt`]: "throw", [`${H}/`]: "throw" })),
    ).toEqual({
      status: "unreadable",
    });
  });

  it("follows same-site redirects (www, http→https) but not other hosts", async () => {
    const www = "https://www.example-ramen-house.test/";
    const d = site({ [`${H}/`]: { status: 301, location: www }, [www]: { body: home } });
    expect((await readSite("example-ramen-house.test", d)).name).toBe("Example Ramen House & Bar");
    const away = site({
      [`${H}/`]: { status: 302, location: "https://example-other.test/" },
      "https://example-other.test/": { body: home },
    });
    expect(await readSite("example-ramen-house.test", away)).toEqual({ status: "unreadable" });
    expect(away.fetch.mock.calls.map((c) => String(c[0]))).not.toContain("https://example-other.test/");
  });

  it.each([
    "127.0.0.1",
    "localhost",
    "169.254.169.254",
    "[::1]",
    "printer.local",
    "a",
    "",
    "http://10.0.0.1/",
    "example..test",
  ])("refuses %j without fetching", async (domain) => {
    const d = site({});
    expect(await readSite(domain, d)).toEqual({ status: "unreadable" });
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("refuses a host that resolves to a private address", async () => {
    const d = site({ "https://example-internal.test/": { body: home } });
    expect(await readSite("example-internal.test", d)).toEqual({ status: "unreadable" });
    expect(d.fetch).not.toHaveBeenCalled();
  });
});

describe("readSite body cap (1 MB)", () => {
  // An endless HTML stream in 64 KB chunks; counts how many chunks were pulled.
  function endless() {
    let pulls = 0;
    const chunk = new TextEncoder().encode(`<p>${"ramen ".repeat(10_900)}</p>`);
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulls++;
        c.enqueue(chunk);
      },
    });
    return { body, pulls: () => pulls, chunk: chunk.byteLength };
  }
  const fetchWith = (make: () => Response) => ({
    fetch: vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).endsWith("/robots.txt") ? new Response("", { status: 404 }) : make(),
    ),
    lookup: async () => [{ address: "93.184.216.34" }],
    timeoutMs: 2_000,
  });

  it("stops reading a stream once it passes 1 MB and counts the page as unreadable", async () => {
    const s = endless();
    const d = fetchWith(() => new Response(s.body, { headers: { "content-type": "text/html" } }));
    expect(await readSite("example-ramen-house.test", d)).toEqual({ status: "unreadable" });
    expect(s.pulls() * s.chunk).toBeGreaterThan(MAX_BYTES);
    expect(s.pulls() * s.chunk).toBeLessThan(MAX_BYTES + 4 * s.chunk);
  });

  it("refuses a Content-Length over 1 MB without reading the body", async () => {
    const s = endless();
    const d = fetchWith(
      () => new Response(s.body, { headers: { "content-type": "text/html", "content-length": String(MAX_BYTES + 1) } }),
    );
    expect(await readSite("example-ramen-house.test", d)).toEqual({ status: "unreadable" });
    expect(s.pulls()).toBeLessThanOrEqual(1);
  });

  it("reads a page just under the cap", async () => {
    const html = `<title>Example Ramen House</title><p>${"x".repeat(MAX_BYTES - 100)}</p>`;
    const d = fetchWith(() => new Response(html, { headers: { "content-type": "text/html" } }));
    expect(await readSite("example-ramen-house.test", d)).toEqual({
      status: "ok",
      name: "Example Ramen House",
      cuisine: "ramen",
    });
  });
});

describe("helpers", () => {
  it("siteHost keeps public hostnames only", () => {
    expect(siteHost("Example-Ramen-House.test")).toBe("example-ramen-house.test");
    expect(siteHost("192.168.1.1")).toBeNull();
  });

  it("isPrivateAddress covers loopback, private, link-local, CGNAT and v6 local", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.0.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8", "::ffff:808:808"])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("isPrivateAddress also covers hex v4-mapped, NAT64, 192.0.0.0/24, docs v6 and junk", () => {
    for (const ip of [
      "::ffff:7f00:1",
      "::ffff:a00:1",
      "0:0:0:0:0:ffff:c0a8:1",
      "64:ff9b::a00:1",
      "64:ff9b::808:808",
      "192.0.0.8",
      "2001:db8::1",
      "::",
      "[::1]",
      "fe80::1%eth0",
      "not-an-ip",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
  });

  it("matchCuisine counts whole words, ignores scripts upstream, and breaks ties by list order", () => {
    expect(matchCuisine("Korean BBQ and more Korean BBQ, plus BBQ")).toBe("BBQ");
    expect(matchCuisine("best Korean BBQ in town")).toBe("Korean BBQ");
    expect(matchCuisine("hot pot and sushi")).toBe("hot pot");
    expect(matchCuisine("teapots and pizzas")).toBeUndefined();
    expect(matchCuisine("")).toBeUndefined();
  });
});
