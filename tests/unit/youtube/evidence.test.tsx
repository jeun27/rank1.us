import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { YoutubeFixEvidence } from "@/components/youtube/YoutubeFixEvidence";
import { youtubeCopy as c } from "@/components/youtube/copy";

// #150 review: each YouTube fix shows only its own check, from the evidence the weekly pass stored (the
// failing videos: id, title, url). R19 title, R20 description, R21 chapters. No live YouTube read.
const videos = [
  { id: "a", title: "Our tonkotsu, start to finish", url: "https://www.youtube.com/watch?v=a" },
  { id: "b", title: "A night at the counter", url: "javascript:alert(1)" },
];
const setup = (rule: "R19" | "R20" | "R21", keyword: string | null = "ramen") =>
  render(<YoutubeFixEvidence rule={rule} videos={videos} keyword={keyword} business="Example Ramen House" />);
const item = (id: string) => document.querySelector(`[data-video="${id}"]`) as HTMLElement;

describe("YoutubeFixEvidence", () => {
  it("R19: the failing videos (safe new-tab links), the keyword, and the one captions line", () => {
    setup("R19");
    expect(screen.getByText(c.keyword("ramen"))).toBeInTheDocument();
    expect(within(item("a")).getByRole("link", { name: `${videos[0].title} (opens in a new tab)` })).toHaveAttribute(
      "href",
      videos[0].url,
    );
    expect(within(item("b")).queryByRole("link")).toBeNull();
    expect(item("b")).toHaveTextContent(videos[1].title);
    expect(screen.getByText(c.saysLine)).toBeInTheDocument();
  });

  it.each(["R20", "R21"] as const)("%s: no captions line (it's only under R19)", (rule) => {
    setup(rule);
    expect(screen.queryByText(c.saysLine)).toBeNull();
  });

  it("Suggest fix per video, its own check only: R19 the title template; Copy → Copied; Apply is Coming soon", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    setup("R19");
    await user.click(within(item("a")).getByRole("button", { name: c.suggest }));
    expect(item("a")).toHaveTextContent("ramen | Our tonkotsu, start to finish");
    expect(item("a")).not.toHaveTextContent("0:00 Intro");
    await user.click(within(item("a")).getByRole("button", { name: c.copy }));
    expect(writeText).toHaveBeenCalledWith("ramen | Our tonkotsu, start to finish");
    expect(within(item("a")).getByRole("button", { name: c.copied })).toBeInTheDocument();
    expect(within(item("a")).getByRole("button", { name: c.apply })).toBeDisabled();
    expect(item("a")).toHaveTextContent(c.comingSoon);
  });

  it("R20: the description line template; R21: 0:00 Intro (no keyword needed)", async () => {
    const user = userEvent.setup();
    const { unmount } = setup("R20");
    await user.click(within(item("a")).getByRole("button", { name: c.suggest }));
    expect(item("a")).toHaveTextContent(c.lineTemplate("ramen", "Example Ramen House"));
    unmount();
    setup("R21", null);
    await user.click(within(item("a")).getByRole("button", { name: c.suggest }));
    expect(item("a")).toHaveTextContent("0:00 Intro");
  });

  it("R19/R20 without a keyword: the videos, no Suggest fix", () => {
    setup("R19", null);
    expect(within(item("a")).queryByRole("button", { name: c.suggest })).toBeNull();
  });
});

describe("copy", () => {
  it("every G1 string is in COPY.md, and the removed full-checklist strings are gone from the code", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [c.saysLine, c.noKeyword, c.suggest, c.copy, c.copied, c.apply])
      expect(copy, s).toContain(`"${s}"`);
    expect(copy).toContain('"Keyword: {keyword}"');
    expect(copy).toContain('"{keyword} | {title}"');
    expect(copy).toContain('"{keyword} at {business}:"');
    expect(Object.keys(c)).not.toContain("noChannel");
    expect(Object.keys(c)).not.toContain("loadFailed");
  });
});
