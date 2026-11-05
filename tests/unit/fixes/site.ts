import { vi } from "vitest";

// A synthetic Example site served by a fake fetch (no network). Keys are full URLs.
export type Pages = Record<string, { status?: number; body?: string; type?: string } | "throw">;
export const H = "https://example-ramen-house.test";

export function site(pages: Pages) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const p = pages[String(input)];
    if (p === "throw") throw new TypeError("fetch failed");
    if (!p) return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
    return new Response(p.body ?? "", {
      status: p.status ?? 200,
      headers: { "content-type": p.type ?? "text/html; charset=utf-8" },
    });
  });
  return { fetch, lookup: async () => [{ address: "93.184.216.34" }], timeoutMs: 50 };
}

export const menuHtml = (rows: [string, string][]) =>
  `<html><body><h1>Menu</h1><ul>${rows.map(([n, p]) => `<li><span>${n}</span> <span>${p}</span></li>`).join("")}</ul></body></html>`;

export const RAMEN: [string, string][] = [
  ["Tonkotsu Ramen", "$15"],
  ["Shoyu Ramen", "$14.50"],
  ["Spicy Miso Ramen", "$16"],
  ["Gyoza (6)", "$7"],
  ["Karaage", "$9"],
];

export const home = (extra = "") =>
  `<html><head><title>Example Ramen House</title>${extra}</head><body><nav><a href="/menu">Our Menu</a><a href="/about">About</a></nav><h1>Example Ramen House</h1></body></html>`;
