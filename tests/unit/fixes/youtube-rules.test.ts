import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { YOUTUBE_COPY, youtubeFixes } from "@/lib/fixes/youtube-rules";

const video = (id: string, checks: Partial<Record<"title" | "description" | "chapters", string>>) => ({
  id,
  title: `Example video ${id}`,
  description: "",
  url: `https://www.youtube.com/watch?v=${id}`,
  publishedAt: null,
  durationSec: 600,
  checks: { title: "pass", description: "pass", chapters: "pass", saysKeyword: "cant_check", ...checks } as never,
});
const list = (videos: ReturnType<typeof video>[], keyword: string | null = "ramen") => ({
  keyword,
  channel: { id: "UCexample", title: "Example Ramen House" },
  videos,
});
const ALL = ["R19", "R20", "R21"] as const;

describe("youtubeFixes (R19 title, R20 first two lines, R21 chapters)", () => {
  it("one grouped fix per rule with the failing videos as evidence, singular and plural copy", () => {
    const r = youtubeFixes(
      [...ALL],
      list([video("v1", { title: "fail", chapters: "fail" }), video("v2", { title: "fail" }), video("v3", {})]),
    );
    expect(r).toEqual([
      {
        rule_key: "R19",
        result: "fix",
        evidence: {
          videos: [
            { id: "v1", title: "Example video v1", url: "https://www.youtube.com/watch?v=v1" },
            { id: "v2", title: "Example video v2", url: "https://www.youtube.com/watch?v=v2" },
          ],
        },
        detail: "2 videos need your keyword in the title.",
      },
      { rule_key: "R20", result: "ok", evidence: { videos: [] }, detail: null },
      {
        rule_key: "R21",
        result: "fix",
        evidence: { videos: [{ id: "v1", title: "Example video v1", url: "https://www.youtube.com/watch?v=v1" }] },
        detail: "1 video 5 minutes or longer has no chapters.",
      },
    ]);
  });

  it("only the enabled rules are returned", () => {
    expect(youtubeFixes(["R20"], list([video("v1", { description: "fail" })])).map((x) => x.rule_key)).toEqual(["R20"]);
  });

  it("no keyword on the business → R19/R20 unchecked (never guessed); R21 still checks chapters", () => {
    const r = youtubeFixes(
      [...ALL],
      list([video("v1", { title: "no_keyword", description: "no_keyword", chapters: "fail" })], null),
    );
    expect(r.map((x) => [x.rule_key, x.result, (x.evidence as { reason?: string }).reason])).toEqual([
      ["R19", "unchecked", "no_keyword"],
      ["R20", "unchecked", "no_keyword"],
      ["R21", "fix", undefined],
    ]);
  });

  it("'not needed' chapters (short videos) are never a fix", () => {
    expect(youtubeFixes(["R21"], list([video("v1", { chapters: "not_needed" })]))[0].result).toBe("ok");
  });

  it("a channel with no videos → unchecked (no_videos), never ok", () => {
    expect(youtubeFixes([...ALL], list([])).map((x) => [x.result, (x.evidence as { reason?: string }).reason])).toEqual(
      [
        ["unchecked", "no_videos"],
        ["unchecked", "no_videos"],
        ["unchecked", "no_videos"],
      ],
    );
  });

  it("no YouTube connection, or one needing reauth → unchecked with the reason", () => {
    expect(youtubeFixes(["R19"], null)[0]).toMatchObject({
      result: "unchecked",
      evidence: { reason: "not_connected" },
    });
    expect(youtubeFixes(["R21"], "needs_reauth")[0]).toMatchObject({
      result: "unchecked",
      evidence: { reason: "needs_reauth" },
    });
  });

  it("the copy is COPY.md's (plural from migration 0035, singular forms are ours)", () => {
    const copy = readFileSync(`${process.cwd()}/docs/COPY.md`, "utf8");
    const sql = readFileSync(
      `${process.cwd()}/supabase/migrations/20261105000035_youtube_fix_rules.sql`,
      "utf8",
    ).replace(/''/g, "'");
    for (const k of ALL) {
      expect(copy).toContain(`"${YOUTUBE_COPY[k].many}"`);
      expect(copy).toContain(`"${YOUTUBE_COPY[k].one}"`);
      expect(sql).toContain(`'${YOUTUBE_COPY[k].many}'`);
    }
  });
});
