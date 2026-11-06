import { readFileSync } from "node:fs";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GbpEditor, type GbpEditorProps } from "@/components/workspace/GbpEditor";
import { gbpEditCopy as c } from "@/components/workspace/gbp-edit-copy";

// C-c PR 2 (lead OK 2026-11-06, D2): the team edits a DFY client's Business Profile, v1 only description,
// website and primary phone. Preview (the live diff) is the confirmation; Apply shows only after a non-empty
// diff, never in a modal; fields off the allowlist never render.
type Preview = GbpEditorProps["preview"];
type Apply = GbpEditorProps["apply"];
const locations = [
  { id: "locations/1", name: "Example Ramen House, Irvine" },
  { id: "locations/2", name: "Example Ramen House, Tustin" },
];
const diff = [{ field: "website_uri", before: "http://old.example.test", after: "https://exampleramen.test" }];
const setup = (over: Partial<{ preview: Preview; apply: Apply }> = {}) => {
  const preview = vi.fn<Preview>(over.preview ?? (async () => ({ changes: diff })));
  const apply = vi.fn<Apply>(over.apply ?? (async () => ({ applied: 1 })));
  render(<GbpEditor locations={locations} preview={preview} apply={apply} />);
  return { preview, apply, user: userEvent.setup() };
};

describe("GbpEditor", () => {
  it("only the three v1 fields render; nothing off the allowlist (hours, special hours, attributes)", () => {
    setup();
    for (const l of [c.description, c.website, c.phone]) expect(screen.getByLabelText(l)).toBeInTheDocument();
    expect(screen.queryByLabelText(/hours/i)).toBeNull();
    expect(screen.queryByLabelText(/attributes/i)).toBeNull();
    expect(screen.getByLabelText(c.location)).toHaveDisplayValue("Example Ramen House, Irvine");
  });

  it("no Apply before a preview; Preview sends only the filled fields for the chosen location", async () => {
    const { preview, user } = setup();
    expect(screen.queryByRole("button", { name: c.apply })).toBeNull();
    await user.selectOptions(screen.getByLabelText(c.location), "Example Ramen House, Tustin");
    await user.type(screen.getByLabelText(c.website), "https://exampleramen.test");
    await user.click(screen.getByRole("button", { name: c.preview }));
    expect(preview).toHaveBeenCalledWith("locations/2", { website_uri: "https://exampleramen.test" });
  });

  it("a non-empty diff: Before → After per field, then Apply applies exactly that diff", async () => {
    const { apply, user } = setup();
    await user.type(screen.getByLabelText(c.website), "https://exampleramen.test");
    await user.click(screen.getByRole("button", { name: c.preview }));
    const list = await screen.findByRole("list", { name: c.preview });
    expect(list).toHaveTextContent("Website");
    expect(list).toHaveTextContent(`${c.before}: http://old.example.test`);
    expect(list).toHaveTextContent(`${c.after}: https://exampleramen.test`);
    await user.click(screen.getByRole("button", { name: c.apply }));
    expect(apply).toHaveBeenCalledWith("locations/1", { website_uri: "https://exampleramen.test" }, diff);
    expect(await screen.findByRole("status")).toHaveTextContent(c.applied);
    expect(screen.queryByRole("button", { name: c.apply })).toBeNull();
  });

  it("an empty diff: No changes to apply., no Apply", async () => {
    const { user } = setup({ preview: async () => ({ changes: [] }) });
    await user.type(screen.getByLabelText(c.phone), "(949) 555-0100");
    await user.click(screen.getByRole("button", { name: c.preview }));
    expect(await screen.findByText(c.noChanges)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.apply })).toBeNull();
  });

  it("editing after a preview takes Apply away until a new preview", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(c.website), "https://exampleramen.test");
    await user.click(screen.getByRole("button", { name: c.preview }));
    await screen.findByRole("button", { name: c.apply });
    await user.type(screen.getByLabelText(c.description), "Tonkotsu.");
    expect(screen.queryByRole("button", { name: c.apply })).toBeNull();
  });

  it("stale: says Google changed it and shows the fresh preview", async () => {
    const fresh = [{ field: "website_uri", before: "https://new.example.test", after: "https://exampleramen.test" }];
    let n = 0;
    const { user } = setup({
      preview: async () => ({ changes: n++ ? fresh : diff }),
      apply: async () => ({ error: "stale" }),
    });
    await user.type(screen.getByLabelText(c.website), "https://exampleramen.test");
    await user.click(screen.getByRole("button", { name: c.preview }));
    await user.click(await screen.findByRole("button", { name: c.apply }));
    expect(await screen.findByText(c.stale)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: c.preview })).toHaveTextContent("https://new.example.test");
    expect(screen.getByRole("button", { name: c.apply })).toBeInTheDocument();
  });

  it("a failed apply: the failure line, the preview kept", async () => {
    let fail!: (v: { error: string }) => void;
    const { user } = setup({ apply: () => new Promise((r) => (fail = r)) });
    await user.type(screen.getByLabelText(c.website), "https://exampleramen.test");
    await user.click(screen.getByRole("button", { name: c.preview }));
    await user.click(await screen.findByRole("button", { name: c.apply }));
    await act(async () => fail({ error: "google_error" }));
    expect(screen.getByRole("status")).toHaveTextContent(c.failed);
    expect(within(screen.getByRole("list", { name: c.preview })).getByText(/Website/)).toBeInTheDocument();
  });

  it("nothing filled: Preview does nothing", async () => {
    const { preview, user } = setup();
    await user.click(screen.getByRole("button", { name: c.preview }));
    expect(preview).not.toHaveBeenCalled();
  });
});

describe("copy", () => {
  it("every C-c PR 2 string is in COPY.md", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    for (const s of [c.open, c.preview, c.apply, c.before, c.after, c.noChanges, c.stale, c.applied, c.failed])
      expect(copy, s).toContain(`"${s}"`);
  });
});
