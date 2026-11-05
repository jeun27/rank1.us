import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { NEXT_COOKIE } from "@/lib/auth/next";

const { POST } = await import("@/app/auth/next/route");

const post = (body: unknown, url = "http://localhost:3000/auth/next", headers: Record<string, string> = {}) =>
  POST(
    new NextRequest(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "sec-fetch-site": "same-origin", ...headers },
    }),
  );

describe("POST /auth/next", () => {
  it.each([
    { "sec-fetch-site": "cross-site", origin: "https://evil.test" },
    { "sec-fetch-site": "same-site", origin: "https://www.localhost:3000" },
  ])("refuses a cross-site request (%o) and sets no cookie", async (h) => {
    const res = await post({ next: "/app/billing" }, undefined, h);
    expect(res.status).toBe(403);
    expect(res.cookies.get(NEXT_COOKIE)).toBeUndefined();
  });

  it("accepts a matching Origin when Sec-Fetch-Site is absent", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/auth/next", {
        method: "POST",
        body: JSON.stringify({ next: "/app" }),
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(res.status).toBe(204);
  });

  it("refuses a request with neither header", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/auth/next", { method: "POST", body: JSON.stringify({ next: "/app" }) }),
    );
    expect(res.status).toBe(403);
  });

  it("keeps a safe next in a short-lived httpOnly Lax cookie scoped to /auth", async () => {
    const res = await post({ next: "/app/billing" });
    expect(res.status).toBe(204);
    const c = res.cookies.get(NEXT_COOKIE)!;
    expect(c.value).toBe("/app/billing");
    expect(c).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/auth", maxAge: 600, secure: false });
  });

  it("marks it Secure over https", async () => {
    const res = await post({ next: "/app" }, "https://rank1.us/auth/next");
    expect(res.cookies.get(NEXT_COOKIE)?.secure).toBe(true);
  });

  it.each([{ next: "//evil.com" }, { next: "https://evil.com" }, { next: null }, {}, "junk"])(
    "clears the cookie for %o instead of storing it",
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(204);
      const c = res.cookies.get(NEXT_COOKIE)!;
      expect(c.value).toBe("");
      expect(c.maxAge).toBe(0);
    },
  );
});
