import { describe, expect, it } from "vitest";
import { checkCloudflare } from "@/lib/fixes/r16-cloudflare";
import { COPY } from "@/lib/fixes/types";

const allowed = [{ agent: "GPTBot", allowed: true, line: null }] as never;
const base = {
  domain: "example-ramen-house.test",
  crawlers: allowed,
  visibleWords: 300,
  statusNormal: 200,
  statusGptbot: 200,
  pagesChecked: 1,
};

describe("R16 Cloudflare hint", () => {
  it("fix: Cloudflare while robots.txt lets the AI crawlers in, with the lead's copy", () => {
    expect(checkCloudflare({ ...base, outcome: "cloudflare", cloudflare: true })).toEqual({
      rule_key: "R16",
      result: "fix",
      evidence: { cloudflare: true },
      detail: COPY.R16,
    });
  });

  it("ok without Cloudflare, or when robots.txt already blocks (R14 covers that)", () => {
    expect(checkCloudflare({ ...base, outcome: "good", cloudflare: false }).result).toBe("ok");
    const blocked = [{ agent: "GPTBot", allowed: false, line: "Disallow: /" }] as never;
    expect(checkCloudflare({ ...base, crawlers: blocked, outcome: "blocked", cloudflare: true }).result).toBe("ok");
  });

  it("unchecked when there's no site or it can't be reached", () => {
    expect(checkCloudflare(null)).toMatchObject({ result: "unchecked", evidence: { reason: "no_domain" } });
    expect(checkCloudflare({ ...base, outcome: "unreachable", cloudflare: false })).toMatchObject({
      result: "unchecked",
      evidence: { reason: "site_unreachable" },
    });
  });
});
