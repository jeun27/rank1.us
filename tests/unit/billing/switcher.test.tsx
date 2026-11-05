import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BusinessSwitcher, type SwitcherBusiness } from "@/components/billing/BusinessSwitcher";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
afterEach(() => {
  push.mockReset();
  vi.useRealTimers();
});

const biz = (i: number, over: Partial<SwitcherBusiness> = {}): SwitcherBusiness => ({
  id: `b${i}`,
  name: i === 1 ? "Example Ramen House" : `Example Business ${i}`,
  city: "Irvine",
  visibility: { value: 0.34, numerator: 85, denominator: 250 },
  active: true,
  ...over,
});
const actions = (over = {}) => ({
  select: vi.fn(async () => undefined),
  add: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  seats: vi.fn(async () => 2),
  ...over,
});
const props = (n: number, over = {}) => ({
  businesses: Array.from({ length: n }, (_, i) => biz(i + 1)),
  currentId: "b1",
  seats: n,
  periodEnd: "2026-12-01T00:00:00Z",
  actions: actions(),
  ...over,
});

// UI.md 4b "Business switcher", exact strings.
describe("BusinessSwitcher", () => {
  it("one business: the name only, no menu", () => {
    render(<BusinessSwitcher {...props(1)} />);
    expect(screen.getByText("Example Ramen House")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Example Ramen House/ })).toBeNull();
  });

  it("two: 'Example Ramen House ▾' lists name, city, '34% · 250 answers', status; picking one selects it", async () => {
    const p = props(2, { businesses: [biz(1), biz(2, { active: false })] });
    render(<BusinessSwitcher {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Example Ramen House ▾" }));
    const list = screen.getByRole("list", { name: "Business switcher" });
    expect(within(list).getAllByText("34% · 250 answers")).toHaveLength(2);
    expect(within(list).getAllByText("Irvine")).toHaveLength(2);
    expect(within(list).getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Need 10+ businesses or done-for-you?", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact us." })).toHaveAttribute("href", "/contact");
    await userEvent.click(within(list).getByRole("button", { name: /^Example Business 2/ }));
    expect(p.actions.select).toHaveBeenCalledWith("b2");
  });

  it("search shows only with more than 8 businesses, and filters by name", async () => {
    const { unmount } = render(<BusinessSwitcher {...props(8)} />);
    await userEvent.click(screen.getByRole("button", { name: "Example Ramen House ▾" }));
    expect(screen.queryByLabelText("Search businesses")).toBeNull();
    unmount();
    render(<BusinessSwitcher {...props(9)} />);
    await userEvent.click(screen.getByRole("button", { name: "Example Ramen House ▾" }));
    await userEvent.type(screen.getByLabelText("Search businesses"), "Business 9");
    const list = screen.getByRole("list", { name: "Business switcher" });
    expect(within(list).getAllByRole("button", { name: /^Example Business 9/ })).toHaveLength(1);
    expect(within(list).queryByRole("button", { name: /^Example Ramen House/ })).toBeNull();
  });

  it("Add: the exact dialog, then 'Adding your business…' until the seat lands, then onboarding", async () => {
    const seats = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    const p = props(2, { actions: actions({ seats }) });
    render(<BusinessSwitcher {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Example Ramen House ▾" }));
    await userEvent.click(screen.getByRole("button", { name: "+ Add a business ($99/mo)" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Add a business? Your plan goes from 2 x $99 to 3 x $99 = $297/mo. Prorated today.",
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await userEvent.click(within(dialog).getByRole("button", { name: "Add business" }));
    expect(p.actions.add).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Adding your business…")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(4100));
    expect(push).toHaveBeenCalledWith("/app/onboarding");
  });

  it("Add poll times out at 30 s: keeps 'Adding your business…' with a manual retry, no error", async () => {
    const p = props(1, { businesses: [biz(1), biz(2)], seats: 2, actions: actions({ seats: vi.fn(async () => 2) }) });
    render(<BusinessSwitcher {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Example Ramen House ▾" }));
    await userEvent.click(screen.getByRole("button", { name: "+ Add a business ($99/mo)" }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add business" }));
    await act(async () => vi.advanceTimersByTimeAsync(31_000));
    expect(screen.getByText("Adding your business…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("Remove: 'More for {name}' → 'Remove business' → the exact dialog → remove; Cancel and Esc close it", async () => {
    const p = props(2);
    render(<BusinessSwitcher {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Example Ramen House ▾" }));
    await userEvent.click(screen.getByRole("button", { name: "More for Example Business 2" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove business" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Remove Example Business 2? Checks continue until Dec 1, 2026; then your plan drops to 1 x $99.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "More for Example Business 2" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove business" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "More for Example Business 2" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove business" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove business" }));
    expect(p.actions.remove).toHaveBeenCalledWith("b2");
  });
});

// Lead: an Add or Remove failure is a save ("We couldn't save that. Try again."), not a billing redirect.
describe("BusinessSwitcher failures", () => {
  it.each([
    ["add", "+ Add a business ($99/mo)", "Add business"],
    ["remove", "More for Example Business 2", "Remove business"],
  ] as const)("%s failure: 'We couldn't save that. Try again.'", async (kind, opener, confirm) => {
    const p = props(2, { actions: actions({ [kind]: vi.fn(async () => ({ error: "failed" })) }) });
    render(<BusinessSwitcher {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Example Ramen House ▾" }));
    await userEvent.click(screen.getByRole("button", { name: opener }));
    if (kind === "remove") await userEvent.click(screen.getByRole("menuitem", { name: "Remove business" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: confirm }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save that. Try again.");
    expect(screen.queryByText("We couldn't open billing. Try again in a minute.")).toBeNull();
  });
});
