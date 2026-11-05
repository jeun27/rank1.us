import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { NEXT_COOKIE } from "@/lib/auth/next";

const { POST } = await import("@/app/auth/next/route");

const post = (body: unknown, url = "http://localhost:3000/auth/next") =>
  POST(new NextRequest(url, { method: "POST", body: JSON.stringify(body) }));

describe("POST /auth/next", () => {
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
