import { describe, expect, it } from "vitest";
import { isProtected, landingPath, safeNext, signInPath } from "@/lib/auth/next";

describe("safeNext", () => {
  it.each(["/app", "/app/billing", "/client?x=1", "/team/q/1#a"])("keeps same-origin path %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });
  it.each([null, "", "app", "//evil.com", "/\\evil.com", "https://evil.com/app", "/%2F%2Fevil.com", " /app", "/\t/evil.com"])(
    "drops %s",
    (p) => {
      expect(safeNext(p)).toBeNull();
    },
  );
});

describe("isProtected", () => {
  it.each(["/app", "/app/", "/app/billing", "/team", "/team/x", "/client", "/client/a/b"])("guards %s", (p) => {
    expect(isProtected(p)).toBe(true);
  });
  it.each(["/", "/signin", "/auth/callback", "/apple", "/teams", "/clients", "/contact", "/api/audit"])(
    "leaves %s public",
    (p) => {
      expect(isProtected(p)).toBe(false);
    },
  );
});

describe("signInPath", () => {
  it("carries the path and query as next", () => {
    expect(signInPath("/app/billing", "?a=1")).toBe("/signin?next=%2Fapp%2Fbilling%3Fa%3D1");
  });
});

describe("landingPath", () => {
  it("routes each landing to its home", () => {
    expect(landingPath("team", null)).toBe("/team");
    expect(landingPath("dfy_client", null)).toBe("/client");
    expect(landingPath("onboarding", null)).toBe("/app/onboarding");
    expect(landingPath("dashboard", null)).toBe("/app");
  });
  it("honors next inside the user's own area", () => {
    expect(landingPath("onboarding", "/app/billing")).toBe("/app/billing");
    expect(landingPath("dashboard", "/app/billing")).toBe("/app/billing");
    expect(landingPath("team", "/team/questions")).toBe("/team/questions");
    expect(landingPath("dfy_client", "/client/report")).toBe("/client/report");
  });
  it("honors a public next", () => {
    expect(landingPath("dashboard", "/contact")).toBe("/contact");
  });
  it("ignores next in another role's area", () => {
    expect(landingPath("team", "/app/billing")).toBe("/team");
    expect(landingPath("dfy_client", "/team")).toBe("/client");
    expect(landingPath("dashboard", "/team")).toBe("/app");
    expect(landingPath("onboarding", "/client")).toBe("/app/onboarding");
  });
  it("ignores an unsafe next", () => {
    expect(landingPath("dashboard", "//evil.com")).toBe("/app");
  });
  it("never sends a signed-in user back to /signin or /auth", () => {
    expect(landingPath("dashboard", "/signin")).toBe("/app");
    expect(landingPath("dashboard", "/auth/callback")).toBe("/app");
  });
});
