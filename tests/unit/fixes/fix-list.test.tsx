import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FixList } from "@/components/fixes/FixList";
import { fixCopy } from "@/components/fixes/copy";
import { exampleFixes, exampleTidyUps, exampleUnchecked } from "@/components/fixes/example-data";

const base = { ranked: exampleFixes, tidyUps: exampleTidyUps, unchecked: [], noDomain: false, canWrite: true };

describe("FixList (UI.md 4b Fix list)", () => {
  it("empty: the 4b copy, with no 'Start a before/after test' (Step 17)", () => {
    render(<FixList ranked={[]} tidyUps={[]} unchecked={[]} noDomain={false} canWrite />);
    expect(screen.getByText("Nothing to fix yet. Run your first check.")).toBeInTheDocument();
    expect(screen.queryByText(/before\/after/)).not.toBeInTheDocument();
  });

  it("success: ranked cards in order with title and detail; affected answers only when known; no size", () => {
    render(<FixList {...base} onStatus={vi.fn()} />);
    const ranked = screen.getByRole("list", { name: "What to fix next" });
    const cards = within(ranked).getAllByRole("listitem");
    expect(cards.map((c) => within(c).getByRole("heading").textContent)).toEqual(exampleFixes.map((f) => f.title));
    expect(
      within(cards[2]).getByText("Your robots.txt blocks OAI-SearchBot from /menu. Check if you meant to."),
    ).toBeInTheDocument();
    expect(within(cards[1]).getByText(/12 affected answers/)).toBeInTheDocument();
    expect(within(cards[0]).queryByText(/affected answers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^(S|S-M|M|M-L|L)$/)).not.toBeInTheDocument();
  });

  it("H1 only under Tidy-ups, never in the ranked list", () => {
    render(<FixList {...base} onStatus={vi.fn()} />);
    const tidy = screen.getByRole("region", { name: "Tidy-ups" });
    expect(within(tidy).getByRole("heading", { name: exampleTidyUps[0].title })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "What to fix next" })).queryByText(exampleTidyUps[0].title),
    ).not.toBeInTheDocument();
  });

  it("writers get a labelled Status select; choosing calls onStatus with the fix id", async () => {
    const onStatus = vi.fn(async () => undefined);
    render(<FixList {...base} onStatus={onStatus} />);
    const selects = screen.getAllByLabelText("Status");
    expect(
      within(selects[0])
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["To do", "Doing", "Done"]);
    await userEvent.selectOptions(selects[1], "done");
    expect(onStatus).toHaveBeenCalledWith("f2", "done");
  });

  it("a failed status change shows the banner and puts the old value back", async () => {
    render(<FixList {...base} onStatus={async () => ({ error: "42501" })} />);
    const select = screen.getAllByLabelText("Status")[0];
    await userEvent.selectOptions(select, "doing");
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save that. Try again.");
    expect(select).toHaveValue("todo");
  });

  it("read-only (clients): a status label, no control", () => {
    render(<FixList {...base} canWrite={false} />);
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(screen.getAllByText("To do").length).toBeGreaterThan(0);
  });

  it("partial: unchecked rows say 'We couldn’t check this yet.'; no domain adds the 4b note once", () => {
    render(<FixList ranked={[]} tidyUps={[]} unchecked={exampleUnchecked} noDomain canWrite />);
    expect(screen.getAllByText("We couldn’t check this yet.")).toHaveLength(2);
    expect(screen.getAllByText("Listing and site checks need your website URL")).toHaveLength(1);
    expect(screen.queryByText("Nothing to fix yet. Run your first check.")).not.toBeInTheDocument();
  });

  it("uses only strings that are in docs/COPY.md", () => {
    const md = readFileSync("docs/COPY.md", "utf8");
    const strings = Object.values(fixCopy).flatMap((v) =>
      typeof v === "object" ? Object.values(v) : typeof v === "function" ? [] : [v],
    );
    for (const s of strings) expect(md, s).toContain(s);
  });
});
