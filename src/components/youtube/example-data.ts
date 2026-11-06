// G1 on Example data: an invented channel and videos (no real YouTube ids).
import type { YoutubeChecklist } from "@/lib/connections/service";

const v = (id: string, title: string, durationSec: number, checks: YoutubeChecklist["videos"][number]["checks"]) => ({
  id,
  title,
  description: `A quick look inside Example Ramen House.\nOpen late on weekends.`,
  url: `https://www.youtube.com/watch?v=example-${id}`,
  publishedAt: "2026-10-30T00:00:00Z",
  durationSec,
  checks,
});

export const exampleYoutube: YoutubeChecklist = {
  keyword: "ramen",
  channel: { id: "example-channel", title: "Example Ramen House" },
  videos: [
    v("1", "Our tonkotsu ramen, start to finish", 540, {
      title: "pass",
      description: "fail",
      chapters: "fail",
      saysKeyword: "cant_check",
    }),
    v("2", "A night at the counter", 95, {
      title: "fail",
      description: "fail",
      chapters: "not_needed",
      saysKeyword: "cant_check",
    }),
    v("3", "Ramen for two in Irvine", 360, {
      title: "pass",
      description: "pass",
      chapters: "pass",
      saysKeyword: "cant_check",
    }),
  ],
};
export const exampleYoutubeNoKeyword: YoutubeChecklist = {
  ...exampleYoutube,
  keyword: null,
  videos: exampleYoutube.videos.map((x) => ({
    ...x,
    checks: { ...x.checks, title: "no_keyword" as const, description: "no_keyword" as const },
  })),
};
