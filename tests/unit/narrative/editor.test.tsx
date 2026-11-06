import { readFileSync } from "node:fs";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WordsEditor } from "@/components/narrative/WordsEditor";
import { narrativeCopy as c } from "@/components/narrative/copy";

// G4 (lead OK 2026-11-06): /app/settings/narrative. Two chip lists with the RPC's limits (up to 8 each,
// 2-40 characters, not in both), errors inline on the field, counts "in {n} of {d} answers" / "not yet".
type Save = (w: { want: string[]; avoid: string[] }) => Promise<{ ok: true } | { error: string }>;
const setup = (over: Partial<{ want: string[]; avoid: string[]; save: Save; counts: boolean }> = {}) => {
  const save = vi.fn<Save>(over.save ?? (async () => ({ ok: true })));
  render(
    <WordsEditor
      words={{ want: over.want ?? ["fresh"], avoid: over.avoid ?? ["cheap"] }}
      result={
        over.counts === false
          ? null
          : {
              n: 48,
              tooFew: false,
              want: [{ word: "fresh", answers: 20 }],
              avoid: [{ word: "cheap", answers: 0 }],
              clashes: 0,
              snippet: null,
            }
      }
      save={save}
    />,
  );
  return { save, user: userEvent.setup() };
};
const list = (name: string) => screen.getByRole("group", { name });
const add = async (user: ReturnType<typeof userEvent.setup>, name: string, word: string) => {
  const g = list(name);
  await user.type(within(g).getByRole("textbox"), word);
  await user.click(within(g).getByRole("button", { name: c.add }));
};

describe("WordsEditor", () => {
  it("the two lists, the helper, counts with their base, and the never-come-up hint", () => {
    setup();
    expect(screen.getByText(c.helper)).toBeInTheDocument();
    expect(within(list(c.want)).getByText("fresh").closest("li")).toHaveTextContent("in 20 of 48 answers");
    expect(within(list(c.avoid)).getByText("cheap").closest("li")).toHaveTextContent(c.notYet);
    expect(screen.getByText(c.neverHint)).toBeInTheDocument();
  });

  it("add and remove words, then Save sends both lists", async () => {
    const { save, user } = setup();
    await add(user, c.want, "  Family Friendly ");
    expect(within(list(c.want)).getByText("family friendly")).toBeInTheDocument();
    await user.click(within(list(c.avoid)).getByRole("button", { name: c.remove("cheap") }));
    await user.click(screen.getByRole("button", { name: c.save }));
    expect(save).toHaveBeenCalledWith({ want: ["fresh", "family friendly"], avoid: [] });
    expect(await screen.findByRole("status")).toHaveTextContent(c.saved);
  });

  it("inline errors: a 9th word, the length, a word in the other list; a repeat is ignored", async () => {
    const { user } = setup({ want: ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"] });
    await add(user, c.want, "nine");
    expect(within(list(c.want)).getByRole("textbox")).toHaveAccessibleDescription(c.errMax);
    await add(user, c.avoid, "x");
    expect(within(list(c.avoid)).getByRole("textbox")).toHaveAccessibleDescription(c.errLength);
    await user.clear(within(list(c.avoid)).getByRole("textbox"));
    await add(user, c.avoid, "a".repeat(41));
    expect(within(list(c.avoid)).getByRole("textbox")).toHaveAccessibleDescription(c.errLength);
    await user.clear(within(list(c.avoid)).getByRole("textbox"));
    await add(user, c.avoid, "B2");
    expect(within(list(c.avoid)).getByRole("textbox")).toHaveAccessibleDescription(c.errBoth);
    await user.clear(within(list(c.avoid)).getByRole("textbox"));
    await add(user, c.avoid, "cheap");
    expect(within(list(c.avoid)).getAllByRole("listitem")).toHaveLength(1);
  });

  it("a failed save keeps the edits and says so inline", async () => {
    let done!: (v: { error: string }) => void;
    const { user } = setup({ save: () => new Promise((r) => (done = r)) });
    await add(user, c.want, "cozy");
    await user.click(screen.getByRole("button", { name: c.save }));
    await act(async () => done({ error: "save_failed" }));
    expect(screen.getByRole("status")).toHaveTextContent(c.failed);
    expect(within(list(c.want)).getByText("cozy")).toBeInTheDocument();
  });

  it("no run yet: no counts", () => {
    setup({ counts: false });
    expect(screen.queryByText(/of 48 answers/)).toBeNull();
  });
});

describe("copy", () => {
  it("every G4 string is in COPY.md", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [
      c.title,
      c.settingsTitle,
      c.want,
      c.avoid,
      c.helper,
      c.noClash,
      c.neverHint,
      c.noWords,
      c.addWords,
      c.wordMatch,
      c.edit,
      c.notYet,
      c.errMax,
      c.errLength,
      c.errBoth,
      c.saved,
    ])
      expect(copy, s).toContain(`"${s}"`);
    for (const s of [
      '"{n} of {d} answers use words you want to avoid: {words}"',
      '"in {n} of {d} answers"',
      '"Remove {word}"',
    ])
      expect(copy, s).toContain(s);
  });
});
