import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientSwitcher } from "@/components/workspace/ClientSwitcher";
import type { TeamExtras } from "@/components/workspace/team";

// v3 D20 (lead, PR 2b): the /team client switcher sits in the breadcrumb. With JS it is a listbox; without
// JS the same GET form ("Client" select name=b + "Show") works. The head script adds .js to <html> before
// paint, and CSS picks one of the two, so the server renders both and nothing swaps after load.
const team = (over: Partial<TeamExtras> = {}) =>
  ({
    businesses: [
      { id: "b1", name: "Example Ramen House" },
      { id: "b2", name: "Example Taco Stand" },
      { id: "b3", name: "Example Pho Spot" },
    ],
    businessId: "b1",
    formAction: "/team",
    hidden: { view: "x" },
    ...over,
  }) as TeamExtras;

// The real rules from globals.css, so the test checks the CSS that ships.
const css = readFileSync("src/app/globals.css", "utf8")
  .split("\n")
  .filter((l) => /js-only/.test(l))
  .join("\n");

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove("js");
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("server markup: both paths, CSS picks one", () => {
  const mount = (js: boolean) => {
    expect(css).toContain("js-only");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    document.documentElement.classList.toggle("js", js);
    document.body.innerHTML = renderToString(<ClientSwitcher team={team()} onClients={() => {}} />);
    const form = document.querySelector("form")!;
    const shown = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).display === "none") return false;
      return true;
    };
    return {
      form,
      select: form.querySelector("select")!,
      show: form.querySelector('button[type="submit"]')!,
      trigger: form.querySelector('[aria-haspopup="listbox"]')!,
      shown,
    };
  };

  it("the GET form: method get, action, hidden params, select name b labelled Client, Show submits", () => {
    const { form, select, show } = mount(false);
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/team");
    expect(form.querySelector('input[type="hidden"][name="view"]')).toHaveAttribute("value", "x");
    expect(select.getAttribute("name")).toBe("b");
    expect(document.querySelector(`label[for="${select.id}"]`)?.textContent).toBe("Client");
    expect([...select.options].map((o) => [o.value, o.text, o.selected])).toEqual([
      ["b1", "Example Ramen House", true],
      ["b2", "Example Taco Stand", false],
      ["b3", "Example Pho Spot", false],
    ]);
    expect(show.textContent).toBe("Show");
  });

  it("without the js class: the form shows and the listbox trigger is hidden", () => {
    const m = mount(false);
    expect(m.shown(m.select)).toBe(true);
    expect(m.shown(m.show)).toBe(true);
    expect(m.shown(m.trigger)).toBe(false);
  });

  it("with the js class: the trigger shows and the form controls are hidden", () => {
    const m = mount(true);
    expect(m.shown(m.trigger)).toBe(true);
    expect(m.trigger.textContent).toContain("Example Ramen House");
    expect(m.shown(m.select)).toBe(false);
    expect(m.shown(m.show)).toBe(false);
  });
});

describe("listbox (JS)", () => {
  const setup = (over: Partial<TeamExtras> = {}, onClients = vi.fn()) => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    render(<ClientSwitcher team={team(over)} onClients={onClients} />);
    const trigger = screen.getByRole("button", { name: /Client/ });
    return { user: userEvent.setup(), trigger, submit, onClients };
  };

  it("the trigger is labelled Client + the current client, closed until pressed", () => {
    const { trigger } = setup();
    expect(trigger).toHaveAccessibleName("Client Example Ramen House");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("type", "button");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // DQ8/DQ9 (design-quality audit): one icon set and one accent. The caret is the drawn chevron, not a
  // "▾" text glyph, and the avatar is neutral (amber is a state colour).
  it("the caret is the drawn chevron icon and the avatar is neutral", () => {
    const { trigger } = setup();
    expect(trigger.textContent).not.toContain("▾");
    expect(trigger.querySelector('svg[data-icon="chevronDown"]')).not.toBeNull();
    expect(trigger.innerHTML).not.toMatch(/warnBg|warnText|amber/);
  });

  it("opens a listbox of clients only, current selected and active, focus in the list", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox", { name: "Client" });
    const options = within(list).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Example Ramen House",
      "Example Taco Stand",
      "Example Pho Spot",
    ]);
    expect(options.map((o) => o.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(list).toHaveFocus();
    expect(list).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(within(list).queryByRole("option", { name: "Clients" })).toBeNull();
  });

  it("arrows, Home and End move the active option (no wrap past the ends); Enter submits the GET form", async () => {
    const { user, trigger, submit } = setup();
    await user.click(trigger);
    const list = screen.getByRole("listbox");
    const options = within(list).getAllByRole("option");
    const active = () => list.getAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(options[1].id);
    await user.keyboard("{End}");
    expect(active()).toBe(options[2].id);
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(options[2].id);
    await user.keyboard("{Home}");
    expect(active()).toBe(options[0].id);
    await user.keyboard("{ArrowUp}");
    expect(active()).toBe(options[0].id);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(submit).toHaveBeenCalledTimes(1);
    const form = submit.mock.contexts[0] as HTMLFormElement;
    expect(Object.fromEntries(new FormData(form))).toEqual({ view: "x", b: "b2" });
  });

  // Scoped to the listbox: the no-JS <select> (hidden by CSS in the browser) has the same options.
  it("clicking an option submits it; the current client does nothing", async () => {
    const { user, trigger, submit } = setup();
    await user.click(trigger);
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Example Ramen House" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.click(trigger);
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Example Pho Spot" }));
    expect(Object.fromEntries(new FormData(submit.mock.contexts[0] as HTMLFormElement)).b).toBe("b3");
  });

  it("Escape closes and returns focus to the trigger", async () => {
    const { user, trigger, submit } = setup();
    await user.click(trigger);
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(submit).not.toHaveBeenCalled();
  });

  it("the last row is Clients: it opens the invites tab and closes the list", async () => {
    const { user, trigger, onClients } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Clients" }));
    expect(onClients).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("no Clients row without the invites tab (onClients not given)", async () => {
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ClientSwitcher team={team()} />);
    await user.click(screen.getByRole("button", { name: /Client/ }));
    expect(screen.queryByRole("button", { name: "Clients" })).toBeNull();
  });

  it("closes when focus leaves the switcher", async () => {
    const { user, trigger } = setup();
    render(<button type="button">elsewhere</button>);
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
