import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FixList } from "@/components/fixes/FixList";
import { exampleFixes } from "@/components/fixes/example-data";

// #149 review (WCAG 2.2.1 Timing adjustable): the "Marked … done" toast doesn't vanish while someone is
// using it (focus or hover pauses the 8 s timer), and it can be closed.
afterEach(() => vi.useRealTimers());
const setup = async () => {
  vi.useFakeTimers();
  render(
    <FixList
      ranked={exampleFixes}
      tidyUps={[]}
      done={[]}
      unchecked={[]}
      noDomain={false}
      canWrite
      onStatus={vi.fn()}
    />,
  );
  await act(async () => {
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
  });
  return screen.getByRole("status");
};
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

describe("the done toast", () => {
  it("stays while focused, then goes 8 s after focus leaves", async () => {
    const toast = await setup();
    await act(async () => within(toast).getByRole("button", { name: "Undo" }).focus());
    await wait(20_000);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await act(async () => screen.getAllByRole("checkbox")[0].focus());
    await wait(7_999);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await wait(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stays while hovered", async () => {
    const toast = await setup();
    fireEvent.mouseEnter(toast);
    await wait(20_000);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    await wait(8_000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("has a Close button that closes it", async () => {
    const toast = await setup();
    await act(async () => fireEvent.click(within(toast).getByRole("button", { name: "Close" })));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
