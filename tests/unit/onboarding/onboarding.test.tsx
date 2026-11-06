import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Onboarding } from "@/app/app/onboarding/Onboarding";
import type { CompetitorSearch, OnboardingActions, OnboardingInput, SiteRead } from "@/app/app/onboarding/contract";
import { connectionsCopy as c } from "@/components/connections/copy";
import { VERTICALS } from "@/lib/queries/onboarding";
import { buildQuestions } from "@/lib/questions/templates";

const places = [
  { name: "Diamond Jamboree", kind: "landmark" as const },
  { name: "Irvine Spectrum Center", kind: "landmark" as const },
  { name: "UC Irvine", kind: "landmark" as const },
  { name: "Northwood", kind: "area" as const },
  { name: "Turtle Rock", kind: "area" as const },
  { name: "Woodbridge", kind: "area" as const },
];
const cuisines = ["ramen", "sushi", "pho"];
const five = [
  "Example Noodle Bar",
  "Example Izakaya",
  "Example Tonkotsu Co.",
  "Example Udon House",
  "Example Pho Spot",
].map((name, i) => ({ name, domain: `example-${i + 1}.test`, rating: 4 + i / 10, cid: `cid-${i + 1}` }));

function setup(
  over: Partial<{
    site: SiteRead;
    search: CompetitorSearch;
    finish: OnboardingActions["finish"];
    verticals: boolean;
  }> = {},
) {
  const actions: OnboardingActions = {
    readSite: vi.fn(
      async (): Promise<SiteRead> => over.site ?? { status: "ok", name: "Example Ramen House", cuisine: "ramen" },
    ),
    findCompetitors: vi.fn(async (): Promise<CompetitorSearch> => over.search ?? { status: "ok", items: five }),
    finish: vi.fn(over.finish ?? (async () => undefined)),
  };
  render(<Onboarding places={places} cuisines={cuisines} actions={actions} verticals={over.verticals} />);
  return { actions, user: userEvent.setup() };
}

async function stepOne(user: ReturnType<typeof userEvent.setup>, domain = "exampleramen.test") {
  await user.type(screen.getByLabelText("Your domain"), domain);
  await user.click(screen.getByRole("button", { name: "Next" }));
}

async function toStepTwo(s: ReturnType<typeof setup>) {
  await stepOne(s.user);
  await toStepTwoFromBusiness(s);
}

async function toStepTwoFromBusiness(s: ReturnType<typeof setup>) {
  await screen.findByLabelText("Business name");
  for (const name of [
    "Diamond Jamboree",
    "Irvine Spectrum Center",
    "UC Irvine",
    "Northwood",
    "Turtle Rock",
    "Woodbridge",
    "vegan",
    "vegetarian",
    "date night",
  ])
    await s.user.click(screen.getByRole("checkbox", { name }));
  await s.user.click(screen.getByRole("button", { name: "Next" }));
}

async function toStepThree(s: ReturnType<typeof setup>) {
  await toStepTwo(s);
  await screen.findByText("Step 2 of 3");
  await screen.findAllByRole("checkbox", { name: /Example/ });
  await s.user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Step 3 of 3");
}

describe("Onboarding 1: Business", () => {
  it("starts blank with Irvine, CA prefilled, and checks the domain ending first", async () => {
    const { actions, user } = setup();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    await stepOne(user, "exampleramen");
    expect(screen.getByText("Add the ending, like ramenhouse.com")).toBeInTheDocument();
    expect(actions.readSite).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Your domain"));
    await stepOne(user, "https://www.ExampleRamen.test/menu");
    expect(actions.readSite).toHaveBeenCalledWith("exampleramen.test");
    expect(await screen.findByLabelText("Business name")).toHaveValue("Example Ramen House");
    expect(screen.getByLabelText("Cuisine")).toHaveValue("ramen");
    expect(screen.getByLabelText("City")).toHaveValue("Irvine");
    expect(screen.getByLabelText("State")).toHaveValue("CA");
  });

  it("shows 'Reading your site…' while the site loads", async () => {
    const { actions, user } = setup();
    vi.mocked(actions.readSite).mockReturnValue(new Promise(() => {}));
    await stepOne(user);
    expect(screen.getByText("Reading your site…")).toBeInTheDocument();
  });

  it("unreadable site: asks for 3 things you sell", async () => {
    const { user } = setup({ site: { status: "unreadable" } });
    await stepOne(user);
    const group = await screen.findByRole("group", { name: "We couldn't read that site. Type 3 things you sell." });
    expect(within(group).getAllByRole("textbox")).toHaveLength(3);
    expect(screen.getByLabelText("Business name")).toHaveValue("");
  });

  it("site read but no cuisine: highlights the cuisine select, Next stays off until it's picked", async () => {
    const { user } = setup({ site: { status: "ok", name: "Example Ramen House" } });
    await stepOne(user);
    const cuisine = await screen.findByLabelText("Cuisine");
    expect(cuisine).toHaveAttribute("data-attention");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.selectOptions(cuisine, "ramen");
    expect(cuisine).not.toHaveAttribute("data-attention");
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});

// X24 (UX plan PR 26): a disabled Next names what's missing, tied with aria-describedby (approved strings).
describe("Onboarding: reason lines next to Next (X24)", () => {
  const next = () => screen.getByRole("button", { name: "Next" });

  it("step 1 names the first missing field: name, cuisine, city, state", async () => {
    const { user } = setup({ site: { status: "ok" } });
    await stepOne(user);
    await screen.findByLabelText("Business name");
    expect(next()).toBeDisabled();
    expect(next()).toHaveAccessibleDescription("Add your business name first.");
    await user.type(screen.getByLabelText("Business name"), "Example Ramen House");
    expect(next()).toHaveAccessibleDescription("Pick a cuisine first.");
    await user.selectOptions(screen.getByLabelText("Cuisine"), "ramen");
    expect(next()).toBeEnabled();
    expect(next()).not.toHaveAccessibleDescription();
    await user.clear(screen.getByLabelText("City"));
    expect(next()).toHaveAccessibleDescription("Add your city first.");
    await user.type(screen.getByLabelText("City"), "Irvine");
    await user.clear(screen.getByLabelText("State"));
    expect(next()).toBeDisabled();
    expect(next()).toHaveAccessibleDescription("Add your state first.");
    expect(screen.getByText("Add your state first.")).toBeVisible();
  });

  it("step 2: 'Finding places near you…' beside the disabled Next until the search is back", async () => {
    let done: (r: CompetitorSearch) => void = () => {};
    const s = setup();
    vi.mocked(s.actions.findCompetitors).mockReturnValue(new Promise((r) => (done = r)));
    await toStepTwo(s);
    await screen.findByText("Step 2 of 3");
    expect(next()).toBeDisabled();
    expect(next()).toHaveAccessibleDescription("Finding places near you…");
    done({ status: "ok", items: five });
    await screen.findAllByRole("checkbox", { name: /Example/ });
    expect(next()).toBeEnabled();
    expect(next()).not.toHaveAccessibleDescription();
  });

  it("D35: no pill shapes left in onboarding's own buttons and chips", async () => {
    const s = setup();
    await stepOne(s.user);
    await screen.findByLabelText("Business name");
    const pills = () =>
      [...document.querySelectorAll("label, button")].filter((e) => e.className.split(" ").includes("rounded-full"));
    expect(pills()).toEqual([]);
    await toStepTwoFromBusiness(s);
    await screen.findAllByRole("checkbox", { name: /Example/ });
    expect(pills()).toEqual([]);
  });
});

describe("Onboarding 2: Competitors", () => {
  it("looks up places for the cuisine and city, then shows 5 pre-ticked rows", async () => {
    const s = setup();
    vi.mocked(s.actions.findCompetitors).mockImplementationOnce(() => new Promise(() => {}));
    await toStepTwo(s);
    expect(await screen.findByText("Finding ramen places in Irvine…")).toBeInTheDocument();
    expect(s.actions.findCompetitors).toHaveBeenCalledWith({
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      domain: "exampleramen.test",
    });
  });

  it("5 found: every row ticked, with name, rating and domain", async () => {
    const s = setup();
    await toStepTwo(s);
    const boxes = await screen.findAllByRole("checkbox", { name: /Example/ });
    expect(boxes).toHaveLength(5);
    boxes.forEach((b) => expect(b).toBeChecked());
    expect(screen.getByText("example-1.test")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  it("fewer than 3 found: list plus the manual add prompt", async () => {
    const s = setup({ search: { status: "ok", items: five.slice(0, 2) } });
    await toStepTwo(s);
    expect(await screen.findAllByRole("checkbox", { name: /Example/ })).toHaveLength(2);
    expect(screen.getByText("Add competitors by name.")).toBeInTheDocument();
  });

  it("none found: the empty message", async () => {
    const s = setup({ search: { status: "ok", items: [] } });
    await toStepTwo(s);
    expect(
      await screen.findByText("No local ramen places found near Irvine. Add competitors by name."),
    ).toBeInTheDocument();
  });

  it.each(["error", "missing_keys"] as const)("%s: the error message and the manual form", async (status) => {
    const s = setup({ search: { status, items: [] } });
    await toStepTwo(s);
    expect(await screen.findByText("Couldn't load nearby places. Add competitors by name.")).toBeInTheDocument();
    await s.user.type(screen.getByLabelText("Name"), "Example Soba Stand");
    await s.user.type(screen.getByLabelText("Domain"), "examplesoba.test");
    await s.user.click(screen.getByRole("button", { name: "Add competitor" }));
    expect(screen.getByRole("checkbox", { name: "Example Soba Stand" })).toBeChecked();
    await s.user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByRole("checkbox", { name: "Example Soba Stand" })).not.toBeInTheDocument();
  });
});

describe("Onboarding 3: Questions + location", () => {
  const expected = buildQuestions(
    { cuisine: "ramen", city: "Irvine", state: "CA" },
    {
      landmarks: ["Diamond Jamboree", "Irvine Spectrum Center", "UC Irvine"],
      areas: ["Northwood", "Turtle Rock", "Woodbridge"],
      dietary: ["vegan", "vegetarian"],
      occasion: ["date night"],
    },
  );

  it("lists the template questions (25 max), tracked, city level, both forms editable", async () => {
    const s = setup();
    await toStepThree(s);
    expect(expected).toHaveLength(25);
    const shorts = screen.getAllByLabelText("Short form");
    expect(shorts.map((i) => (i as HTMLInputElement).value)).toEqual(expected.map((q) => q.short_text));
    expect(screen.getAllByLabelText("Long form")).toHaveLength(25);
    screen.getAllByRole("checkbox", { name: "Track" }).forEach((b) => expect(b).toBeChecked());
    screen.getAllByLabelText("Location level").forEach((l) => expect(l).toHaveValue("city"));
  });

  it("an edited question gets the 'Edited' tag", async () => {
    const s = setup();
    await toStepThree(s);
    expect(screen.queryByText("Edited")).not.toBeInTheDocument();
    await s.user.type(screen.getAllByLabelText("Short form")[0], " tonight");
    expect(screen.getAllByText("Edited")).toHaveLength(1);
  });

  it("city and state levels grey ChatGPT and Gemini with the tooltip copy; country doesn't", async () => {
    const s = setup();
    await toStepThree(s);
    const row = screen.getAllByRole("group", { name: /^\d+$/ })[0];
    const note = within(row).getByText("ChatGPT can't target a city yet, so we check it for the whole country.");
    expect(note).toBeInTheDocument();
    expect(
      within(row).getByText("Gemini can't target a city yet, so we check it for the whole country."),
    ).toBeInTheDocument();
    await s.user.selectOptions(within(row).getByLabelText("Location level"), "country");
    expect(within(row).queryByText(/can't target a city yet/)).not.toBeInTheDocument();
  });

  it("an empty tracked question blocks Finish setup with its number", async () => {
    const s = setup();
    await toStepThree(s);
    await s.user.clear(screen.getAllByLabelText("Short form")[6]);
    await s.user.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(screen.getByText("Couldn't save question 7: it's empty.")).toBeInTheDocument();
    expect(s.actions.finish).not.toHaveBeenCalled();
  });

  it("Finish setup sends exactly the ticked competitors and the tracked questions", async () => {
    const s = setup();
    await toStepTwo(s);
    const boxes = await screen.findAllByRole("checkbox", { name: /Example/ });
    await s.user.click(boxes[4]);
    await s.user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 3 of 3");
    await s.user.click(screen.getAllByRole("checkbox", { name: "Track" })[1]);
    await s.user.selectOptions(screen.getAllByLabelText("Location level")[0], "state");
    await s.user.click(screen.getByRole("button", { name: "Finish setup" }));
    const input = vi.mocked(s.actions.finish).mock.calls[0][0] as OnboardingInput;
    expect(input.business).toEqual({
      name: "Example Ramen House",
      domain: "exampleramen.test",
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    });
    expect(input.competitors).toEqual(
      five
        .slice(0, 4)
        .map((c) => ({ name: c.name, domain: c.domain, rating: c.rating, maps_cid: c.cid, source: "maps" })),
    );
    expect(input.questions).toHaveLength(25);
    expect(input.questions[0]).toEqual({
      short_text: expected[0].short_text,
      long_text: expected[0].long_text,
      active_form: "long",
      active: true,
      location_level: "state",
      country: "US",
      state: "CA",
      city: null,
      template_key: String(expected[0].template_sort),
    });
    expect(input.questions[1]).toMatchObject({ active: false, location_level: "city", city: "Irvine", state: "CA" });
  });

  it("a failed save shows the error banner and keeps the answers", async () => {
    const s = setup({ finish: async () => ({ error: "save_failed" }) });
    await toStepThree(s);
    await s.user.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your business. Try again.");
    expect(screen.getAllByLabelText("Short form")).toHaveLength(25);
  });

  it("Back returns to the previous step with its answers", async () => {
    const s = setup();
    await toStepThree(s);
    await s.user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: /Example/ })).toHaveLength(5);
    expect(s.actions.findCompetitors).toHaveBeenCalledTimes(1);
  });
});

// C-b (lead OK 2026-11-06, Q4): "What kind of business?" sits in step 1 only with ENABLE_CONNECTIONS on
// (the page passes verticals). Q5 (lead): questions come from the restaurant templates whatever the
// vertical, so a non-restaurant pick still gets the full set.
describe("Onboarding 1: the vertical (ENABLE_CONNECTIONS)", () => {
  it("off: no select, and no vertical sent", async () => {
    const s = setup();
    await stepOne(s.user);
    await screen.findByLabelText("Business name");
    expect(screen.queryByLabelText(c.card.industry)).toBeNull();
  });

  it("on: Restaurant by default; HVAC is sent as hvac, still with the full question set", async () => {
    const s = setup({ verticals: true });
    await stepOne(s.user);
    const select = await screen.findByLabelText(c.card.industry);
    expect(select).toHaveDisplayValue(c.card.verticals.restaurant);
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(VERTICALS.map((v) => c.card.verticals[v]));
    await s.user.selectOptions(select, c.card.verticals.hvac);
    await toStepTwoFromBusiness(s);
    await screen.findByText("Step 2 of 3");
    await screen.findAllByRole("checkbox", { name: /Example/ });
    await s.user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 3 of 3");
    await s.user.click(screen.getByRole("button", { name: "Finish setup" }));
    const input = vi.mocked(s.actions.finish).mock.calls[0][0] as OnboardingInput;
    expect(input.business.vertical).toBe("hvac");
    expect(input.questions).toHaveLength(25);
  });
});
