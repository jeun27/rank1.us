import { readFileSync } from "node:fs";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MentionsEvidence, MentionsSection } from "@/components/mentions/MentionsSection";
import { mentionsCopy as c } from "@/components/mentions/copy";
import type { MentionTarget, MentionTargets } from "@/lib/metrics/mentions";

// G7 (lead OK 2026-11-06): "Lists that name your rivals but not you" at the top of /app/sources. Add to fixes
// / Not relevant, optimistic; the save error sits inline on the row (role=status), not in a banner.
const t = (url: string, over: Partial<MentionTarget> = {}): MentionTarget => ({
  url,
  domain: new URL(url).hostname,
  title: `Example list ${url.slice(-1)}`,
  category: "News & blogs",
  rivals: ["Example Noodle Bar"],
  answers: 12,
  engines: ["chatgpt", "gemini"],
  ...over,
});
const targets: MentionTargets = {
  n: 240,
  candidates: [
    t("https://lists.example.test/a", {
      rivals: ["Example Noodle Bar", "Example Izakaya", "Example Udon Spot", "Example Pho Spot", "Example Taco"],
    }),
    t("https://lists.example.test/b", { title: null }),
  ],
  added: [t("https://lists.example.test/c")],
  dismissed: [t("https://lists.example.test/d")],
};
type Decide = (
  url: string,
  status: "added" | "dismissed" | null,
) => Promise<{ fixId: string | null } | { error: string }>;
const setup = (over: Partial<{ targets: MentionTargets | null; canDecide: boolean; decide: Decide }> = {}) => {
  const decide = vi.fn<Decide>(over.decide ?? (async () => ({ fixId: "fix-r17" })));
  render(
    <MentionsSection
      targets={over.targets === undefined ? targets : over.targets}
      canDecide={over.canDecide ?? true}
      fixId="fix-r17"
      decide={decide}
    />,
  );
  return { decide, user: userEvent.setup() };
};
const section = () => screen.getByRole("region", { name: c.title });
const row = (url: string) => document.querySelector(`[data-url="${url}"]`) as HTMLElement;
const group = (name: string) => screen.getByRole("list", { name });

describe("MentionsSection", () => {
  it("title, sub, and each candidate: the page link, Names up to 3 then +n, In k of n answers with engine names", () => {
    setup();
    expect(section()).toHaveTextContent(c.sub);
    const a = row("https://lists.example.test/a");
    const link = within(a).getByRole("link", { name: "Example list a" });
    expect(link).toHaveAttribute("href", "https://lists.example.test/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(a).toHaveTextContent("Names Example Noodle Bar, Example Izakaya, Example Udon Spot +2");
    expect(a).toHaveTextContent("In 12 of 240 answers · ChatGPT, Gemini");
    expect(
      within(row("https://lists.example.test/b")).getByRole("link", { name: "lists.example.test" }),
    ).toBeInTheDocument();
  });

  it("Add to fixes moves the row to Added at once, with View to the grouped fix; Remove clears it", async () => {
    const { decide, user } = setup();
    await user.click(within(row("https://lists.example.test/a")).getByRole("button", { name: c.add }));
    expect(decide).toHaveBeenCalledWith("https://lists.example.test/a", "added");
    const added = group(c.added);
    expect(within(added).getByText("Example list a")).toBeInTheDocument();
    expect(within(row("https://lists.example.test/a")).getByText(c.added)).toBeInTheDocument();
    expect(within(row("https://lists.example.test/a")).getByRole("link", { name: c.view })).toHaveAttribute(
      "href",
      "/app/fixes#fix-fix-r17",
    );
    await user.click(within(row("https://lists.example.test/c")).getByRole("button", { name: c.remove }));
    expect(decide).toHaveBeenLastCalledWith("https://lists.example.test/c", null);
    expect(within(group(c.title)).getByText("Example list c")).toBeInTheDocument();
  });

  it("Not relevant folds the row into the closed disclosure; Restore brings it back", async () => {
    const { decide, user } = setup();
    await user.click(within(row("https://lists.example.test/b")).getByRole("button", { name: c.notRelevant }));
    expect(decide).toHaveBeenCalledWith("https://lists.example.test/b", "dismissed");
    const details = screen.getByText(c.dismissedCount(2)).closest("details")!;
    expect(details).not.toHaveAttribute("open");
    await user.click(screen.getByText(c.dismissedCount(2)));
    await user.click(within(row("https://lists.example.test/d")).getByRole("button", { name: c.restore }));
    expect(decide).toHaveBeenLastCalledWith("https://lists.example.test/d", null);
    expect(within(group(c.title)).getByText("Example list d")).toBeInTheDocument();
  });

  it("a failed save reverts the row and says so inline, on the row (role=status)", async () => {
    let fail!: (v: { error: string }) => void;
    const { user } = setup({ decide: () => new Promise((r) => (fail = r)) });
    await user.click(within(row("https://lists.example.test/a")).getByRole("button", { name: c.add }));
    expect(within(group(c.added)).getByText("Example list a")).toBeInTheDocument();
    await act(async () => fail({ error: "save_failed" }));
    const a = row("https://lists.example.test/a");
    expect(within(group(c.title)).getByText("Example list a")).toBeInTheDocument();
    expect(within(a).getByRole("status")).toHaveTextContent("We couldn't save that. Try again.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("read-only: the lists, no actions", () => {
    setup({ canDecide: false });
    expect(within(section()).queryByRole("button")).toBeNull();
  });

  it("empty: before the first run, and after runs with no lists", () => {
    const { unmount } = (() => {
      const r = render(<MentionsSection targets={null} canDecide fixId={null} decide={vi.fn()} />);
      return r;
    })();
    expect(section()).toHaveTextContent("No lists like this yet. They show after your first run.");
    unmount();
    render(
      <MentionsSection
        targets={{ n: 240, candidates: [], added: [], dismissed: [] }}
        canDecide
        fixId={null}
        decide={vi.fn()}
      />,
    );
    expect(section()).toHaveTextContent("None in your last run. We check again on every run.");
  });
});

describe("MentionsEvidence (the R17 fix's evidence)", () => {
  it("at most 3 added pages, then +n more to /app/sources", () => {
    const added = ["1", "2", "3", "4", "5"].map((k) => t(`https://lists.example.test/${k}`));
    render(<MentionsEvidence added={added} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("link", { name: c.more(2) })).toHaveAttribute("href", "/app/sources");
  });

  it("3 or fewer: no more link", () => {
    render(<MentionsEvidence added={[t("https://lists.example.test/1")]} />);
    expect(screen.queryByRole("link", { name: /more/ })).toBeNull();
  });
});

describe("copy", () => {
  it("every G7 string is in COPY.md (UX section)", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [
      c.title,
      c.sub,
      c.add,
      c.notRelevant,
      c.added,
      c.view,
      c.remove,
      c.restore,
      c.emptyFirst,
      c.emptyNone,
      c.failed,
    ])
      expect(copy, s).toContain(`"${s}"`);
    for (const s of ['"Names {rivals}"', '"+{n}"', '"In {k} of {n} answers"', '"Not relevant ({n})"', '"+{n} more"'])
      expect(copy, s).toContain(s);
  });
});
