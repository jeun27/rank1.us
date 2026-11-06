import { hasWord } from "./narrative";

// G1 YouTube checklist, pure and read-only (lead, 2026-11-06). One keyword per business (its category
// term, e.g. "ramen"), matched like G4: whole word + s/es/er/est, case-insensitive.
// "Says the keyword" needs captions, which youtube.readonly can't read, so it is always "Can't check".
export const CHAPTERS_MIN_SEC = 300; // chapters only matter on videos of 5 minutes or more
const CHAPTER_MIN_GAP_SEC = 10;

export type CheckResult = "pass" | "fail" | "no_keyword";
export type VideoChecks = {
  title: CheckResult;
  description: CheckResult;
  chapters: "pass" | "fail" | "not_needed";
  saysKeyword: "cant_check";
};

// contentDetails.duration, e.g. "PT1H2M3S" or "P1DT1S" → seconds; null when it isn't one.
export function parseDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m || iso === "P" || iso.endsWith("T")) return null;
  const [d, h, min, s] = m.slice(1).map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

const toSec = (t: string) => t.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);

// YouTube's chapter rules (support.google.com/youtube/answer/9884579): the first timestamp is 0:00, at
// least three, in ascending order, each chapter at least 10 seconds.
export function hasChapters(description: string): boolean {
  const stamps = description
    .split(/\r?\n/)
    .map((line) => /^\s*\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s+\S/.exec(line)?.[1])
    .filter((t): t is string => !!t)
    .map(toSec);
  if (stamps.length < 3 || stamps[0] !== 0) return false;
  return stamps.every((t, i) => i === 0 || t - stamps[i - 1] >= CHAPTER_MIN_GAP_SEC);
}

export function checkVideo(
  video: { title: string; description: string; durationSec: number | null },
  keyword: string | null,
): VideoChecks {
  const firstLines = video.description.split(/\r?\n/).slice(0, 2).join("\n");
  const kw = (text: string): CheckResult => (!keyword ? "no_keyword" : hasWord(text, keyword) ? "pass" : "fail");
  return {
    title: kw(video.title),
    description: kw(firstLines),
    chapters:
      video.durationSec === null || video.durationSec < CHAPTERS_MIN_SEC
        ? "not_needed"
        : hasChapters(video.description)
          ? "pass"
          : "fail",
    saysKeyword: "cant_check",
  };
}
