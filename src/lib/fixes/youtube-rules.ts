import type { VideoChecks } from "@/lib/metrics/youtube-checks";
import type { RuleKey, FixResult } from "./types";

// G1's grouped YouTube fixes (p4, migration 0035): one per rule, evidence = the videos that fail it
// ({id, title, url}). No videos = unchecked; short videos (chapters not_needed) never count for R21.
// Plural copy is the fix_rules row's; the one-video forms are data-pipeline's (COPY.md GAS).
export const YOUTUBE_RULES = ["R19", "R20", "R21"] as const satisfies readonly RuleKey[];
export const YOUTUBE_COPY = {
  R19: { one: "1 video needs your keyword in the title.", many: "{n} videos need your keyword in the title." },
  R20: {
    one: "1 video doesn't have your keyword in the first two lines of the description.",
    many: "{n} videos don't have your keyword in the first two lines of the description.",
  },
  R21: {
    one: "1 video 5 minutes or longer has no chapters.",
    many: "{n} videos 5 minutes or longer have no chapters.",
  },
} as const;
const FIELD = { R19: "title", R20: "description", R21: "chapters" } as const;

export type Checklist = {
  keyword: string | null;
  videos: { id: string; title: string; url: string; checks: VideoChecks }[];
};

// list: the business's checklist, null without a YouTube connection, or the connection's failure reason.
// No connection, or no keyword (lead, #146): no rows at all, so nothing noisy reaches the Fix list. The
// fix pass only asks when youtubeReady; these are the guards behind that.
export function youtubeFixes(rules: RuleKey[], list: Checklist | null | string): FixResult[] {
  if (list === null || (typeof list !== "string" && !list.keyword)) return [];
  return YOUTUBE_RULES.filter((k) => rules.includes(k)).map((rule_key): FixResult => {
    if (typeof list === "string") return { rule_key, result: "unchecked", evidence: { reason: list }, detail: null };
    if (!list.videos.length) return { rule_key, result: "unchecked", evidence: { reason: "no_videos" }, detail: null };
    const field = FIELD[rule_key];
    const failing = list.videos
      .filter((v) => v.checks[field] === "fail")
      .map((v) => ({ id: v.id, title: v.title, url: v.url }));
    if (!failing.length) return { rule_key, result: "ok", evidence: { videos: [] }, detail: null };
    const c = YOUTUBE_COPY[rule_key];
    return {
      rule_key,
      result: "fix",
      evidence: { videos: failing },
      detail: failing.length === 1 ? c.one : c.many.replace("{n}", String(failing.length)),
    };
  });
}
