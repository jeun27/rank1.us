import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { YoutubeChecklistPanel } from "@/components/youtube/YoutubeChecklist";
import { youtubeCopy as c } from "@/components/youtube/copy";
import type { YoutubeChecklist } from "@/lib/connections/service";

// G1 (lead OK 2026-11-06): the Search-ready checklist, the evidence inside the P4 fixes R19–R21. Read-only:
// "Suggest fix" is a copy-only template; "Apply in YouTube" stays Coming soon. Never color alone.
const video = (
  id: string,
  over: Partial<YoutubeChecklist["videos"][number]> = {},
): YoutubeChecklist["videos"][number] => ({
  id,
  title: `Example video ${id}`,
  description: "First line about us\nSecond line\nThird",
  url: `https://www.youtube.com/watch?v=${id}`,
  publishedAt: "2026-11-01T00:00:00Z",
  durationSec: 420,
  checks: { title: "pass", description: "fail", chapters: "not_needed", saysKeyword: "cant_check" },
  ...over,
});
const list: YoutubeChecklist = {
  keyword: "ramen",
  channel: { id: "ch1", title: "Example Ramen House" },
  videos: [
    video("a"),
    video("b", { checks: { title: "fail", description: "pass", chapters: "fail", saysKeyword: "cant_check" } }),
  ],
};
const setup = (checklist: YoutubeChecklist | string = list) =>
  render(<YoutubeChecklistPanel checklist={checklist} business="Example Ramen House" />);
const item = (id: string) => document.querySelector(`[data-video="${id}"]`) as HTMLElement;

describe("YoutubeChecklistPanel", () => {
  it("the keyword, n videos, and per video the four checks as text (Yes / No / Not needed / Can't check)", () => {
    setup();
    const panel = screen.getByRole("region", { name: c.title });
    expect(panel).toHaveTextContent("Keyword: ramen");
    expect(panel).toHaveTextContent(c.videos(2));
    const a = item("a");
    expect(within(a).getByRole("link", { name: "Example video a (opens in a new tab)" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=a",
    );
    expect(within(a).getByText(c.titleCheck).closest("li")).toHaveTextContent(c.yes);
    expect(within(a).getByText(c.descriptionCheck).closest("li")).toHaveTextContent(c.no);
    expect(within(a).getByText(c.chaptersCheck).closest("li")).toHaveTextContent(c.notNeeded);
    expect(within(a).getByText(c.saysCheck).closest("li")).toHaveTextContent(c.cantCheck);
    expect(panel).toHaveTextContent(c.cantReason);
    expect(c.descriptionCheck).toBe("Keyword in the first two lines");
  });

  it("Suggest fix shows a copy-only template per failing check, Copy → Copied, Apply in YouTube is Coming soon", async () => {
    const user = userEvent.setup();
    // user-event installs its own clipboard; spy on it.
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    setup();
    await user.click(within(item("b")).getByRole("button", { name: c.suggest }));
    const b = item("b");
    expect(b).toHaveTextContent("ramen | Example video b");
    expect(b).toHaveTextContent("0:00 Intro");
    await user.click(within(b).getAllByRole("button", { name: c.copy })[0]);
    expect(writeText).toHaveBeenCalledWith("ramen | Example video b");
    expect(within(b).getByRole("button", { name: c.copied })).toBeInTheDocument();
    const apply = within(b).getByRole("button", { name: new RegExp(c.apply) });
    expect(apply).toBeDisabled();
    expect(b).toHaveTextContent(c.comingSoon);
    // A video passing everything that can be checked has no Suggest fix.
    const allGood = {
      ...list,
      videos: [
        video("c", { checks: { title: "pass", description: "pass", chapters: "pass", saysKeyword: "cant_check" } }),
      ],
    };
    setup(allGood);
    expect(within(item("c")).queryByRole("button", { name: c.suggest })).toBeNull();
  });

  it("the description template uses the business and the first line", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(within(item("a")).getByRole("button", { name: c.suggest }));
    expect(item("a")).toHaveTextContent("ramen at Example Ramen House: First line about us");
  });

  // Lead: with no keyword, the plain line alone; never a checklist full of "No keyword" cells.
  it("no keyword: only the plain line, no action, no video rows", () => {
    setup({
      ...list,
      keyword: null,
      videos: [
        video("a", {
          checks: { title: "no_keyword", description: "no_keyword", chapters: "fail", saysKeyword: "cant_check" },
        }),
      ],
    });
    expect(screen.getByText(c.noKeyword)).toBeInTheDocument();
    expect(item("a")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(c.noKeywordCell)).toBeNull();
  });

  it("no videos, and no channel", () => {
    const { unmount } = setup({ ...list, videos: [] });
    expect(screen.getByText(c.noVideos)).toBeInTheDocument();
    unmount();
    setup({ ...list, channel: null, videos: [] });
    expect(screen.getByText(c.noChannel)).toBeInTheDocument();
  });

  it.each(["needs_reauth", "revoked", "not_connected"])("%s: Reconnect YouTube in Settings", (f) => {
    setup(f);
    expect(screen.getByRole("link", { name: c.reconnect })).toHaveAttribute("href", "/app/settings/connections");
  });

  it.each(["refresh_failed", "google_error", "not_configured", "not_allowed"])("%s: the try-again line", (f) => {
    setup(f);
    expect(screen.getByText(c.loadFailed)).toBeInTheDocument();
  });

  it("a non-http video URL is plain text", () => {
    setup({ ...list, videos: [video("a", { url: "javascript:alert(1)" })] });
    expect(within(item("a")).queryByRole("link")).toBeNull();
  });
});

describe("copy", () => {
  it("every G1 string is in COPY.md", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [
      c.title,
      c.titleCheck,
      c.descriptionCheck,
      c.chaptersCheck,
      c.saysCheck,
      c.yes,
      c.no,
      c.notNeeded,
      c.cantCheck,
      c.cantReason,
      c.noKeyword,
      c.noVideos,
      c.suggest,
      c.copy,
      c.copied,
      c.apply,
    ])
      expect(copy, s).toContain(`"${s}"`);
    expect(copy).toContain('"Keyword: {keyword}"');
    expect(copy).toContain('"{keyword} | {title}"');
    expect(copy).toContain('"{keyword} at {business}: {line}"');
    expect(copy).toContain('"Connected · {n} videos checked"');
  });
});
