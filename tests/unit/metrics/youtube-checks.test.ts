import { describe, expect, it } from "vitest";
import { CHAPTERS_MIN_SEC, checkVideo, hasChapters, parseDuration } from "@/lib/metrics/youtube-checks";

describe("parseDuration (ISO 8601, YouTube contentDetails.duration)", () => {
  it.each([
    ["PT4M59S", 299],
    ["PT5M", 300],
    ["PT1H2M3S", 3723],
    ["PT45S", 45],
    ["P1DT1S", 86401],
    ["", null],
    ["garbage", null],
  ])("%s → %s", (iso, sec) => expect(parseDuration(iso)).toBe(sec));
});

describe("hasChapters (YouTube's rules: first 0:00, ≥3 ascending, each ≥10 s)", () => {
  it("accepts valid chapters, in any common timestamp style", () => {
    expect(hasChapters("Tour\n0:00 Intro\n0:45 The broth\n2:10 Noodles")).toBe(true);
    expect(hasChapters("00:00 Intro\n01:00 Broth\n1:02:00 Wrap-up")).toBe(true);
  });

  it.each([
    ["the first isn't 0:00", "0:05 Intro\n0:45 Broth\n2:10 Noodles"],
    ["only two", "0:00 Intro\n0:45 Broth"],
    ["not ascending", "0:00 Intro\n2:10 Noodles\n0:45 Broth"],
    ["a chapter under 10 s", "0:00 Intro\n0:05 Broth\n2:10 Noodles"],
    ["none at all", "Come try our ramen!"],
  ])("rejects: %s", (_label, text) => expect(hasChapters(text)).toBe(false));
});

describe("checkVideo", () => {
  const video = (o: Partial<{ title: string; description: string; durationSec: number | null }> = {}) => ({
    id: "vid-1",
    title: "Best ramen in Irvine: a tour",
    description:
      "Our tonkotsu ramen, start to finish.\nFilmed in Irvine.\nMore below\n0:00 Intro\n0:45 Broth\n2:10 Noodles",
    durationSec: 420,
    ...o,
  });

  it("keyword in the title and in the first 2 description lines, and chapters on a 5+ minute video", () => {
    expect(checkVideo(video(), "ramen")).toEqual({
      title: "pass",
      description: "pass",
      chapters: "pass",
      saysKeyword: "cant_check",
    });
  });

  it("the description check reads only the first 2 lines; endings count (ramens), other words don't", () => {
    expect(checkVideo(video({ description: "Hello.\nWelcome!\nWe make ramen." }), "ramen").description).toBe("fail");
    expect(checkVideo(video({ title: "Two ramens, one night" }), "ramen").title).toBe("pass");
    expect(checkVideo(video({ title: "Ramenesque vibes" }), "ramen").title).toBe("fail");
  });

  it(`chapters: not needed under ${CHAPTERS_MIN_SEC / 60} minutes (or unknown length), fail on a long video without them`, () => {
    expect(checkVideo(video({ durationSec: CHAPTERS_MIN_SEC - 1 }), "ramen").chapters).toBe("not_needed");
    expect(checkVideo(video({ durationSec: null }), "ramen").chapters).toBe("not_needed");
    expect(checkVideo(video({ description: "No chapters here." }), "ramen").chapters).toBe("fail");
  });

  it("no keyword (no category term on the business) → the keyword checks can't run, chapters still can", () => {
    expect(checkVideo(video(), null)).toEqual({
      title: "no_keyword",
      description: "no_keyword",
      chapters: "pass",
      saysKeyword: "cant_check",
    });
  });
});
