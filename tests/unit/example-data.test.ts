import { describe, expect, it } from "vitest";
import {
  exampleLeaderboard,
  examplePartialRun,
  exampleProgress,
  partialRunLabel,
  pointsChange,
  progressLabel,
} from "@/app/dev/ui/example-data";

// Gallery strings must be built from example-data.ts, worded exactly as docs/COPY.md.
describe("/dev/ui example strings", () => {
  it("'+6 pts' is Example Ramen House now vs last week", () => {
    const you = exampleLeaderboard.find((r) => r.brand === "Example Ramen House")!;
    expect(pointsChange(you.now, you.lastWeek)).toBe("+6 pts");
    expect(pointsChange(you.lastWeek, you.now)).toBe("−6 pts");
    expect(pointsChange(you.now, you.now)).toBe("0 pts");
  });

  it("partial run badge comes from examplePartialRun (230 of 250)", () => {
    expect(examplePartialRun).toEqual({ jobsOk: 230, jobsTotal: 250 });
    expect(partialRunLabel(examplePartialRun)).toBe("Last run partial: 230 of 250 answers");
    expect(partialRunLabel({ jobsOk: 1, jobsTotal: 2 })).toBe("Last run partial: 1 of 2 answers");
  });

  it("loading message comes from exampleProgress (120 of 250)", () => {
    expect(exampleProgress).toEqual({ answersDone: 120, answersTotal: 250 });
    expect(progressLabel(exampleProgress)).toBe("Checking 4 AI engines… 120 of 250 answers");
    expect(progressLabel({ answersDone: 3, answersTotal: 9 })).toBe("Checking 4 AI engines… 3 of 9 answers");
  });
});
