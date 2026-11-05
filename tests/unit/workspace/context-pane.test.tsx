import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextPane } from "@/components/workspace/ContextPane";
import { buildWorkspace } from "@/lib/queries/workspace";
import { exampleWorkspaceRows } from "@/app/team/example-data";

const view = buildWorkspace(exampleWorkspaceRows());
const pane = () =>
  render(
    <ContextPane
      view={view}
      section="dashboard"
      selection={{ kind: "section", section: "dashboard" }}
      now={new Date("2026-11-05T12:00:00Z")}
      onSelect={() => {}}
    />,
  );

afterEach(() => vi.unstubAllGlobals());

describe("ContextPane clipboard", () => {
  it("says so when the browser blocks the clipboard, for both buttons", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    pane();
    await user.click(screen.getByRole("button", { name: "Copy context" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't copy. Allow clipboard access and try again.");
    const link = screen.getByRole("link", { name: "Open in Claude" });
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy. Allow clipboard access and try again.");
  });
});
