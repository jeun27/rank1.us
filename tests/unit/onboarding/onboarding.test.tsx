import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Onboarding } from "@/app/app/onboarding/Onboarding";
import type {
  CompetitorSearch,
  OnboardingActions,
  OnboardingInput,
  SiteProfile,
  SiteServices,
} from "@/app/app/onboarding/contract";
import { connectionsCopy as c } from "@/components/connections/copy";
import { VERTICALS } from "@/lib/queries/onboarding";
import { MAX_ACTIVE_QUESTIONS, buildQuestions } from "@/lib/questions/templates";

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
    site: Partial<SiteProfile> & Pick<SiteProfile, "status">;
    services: SiteServices;
    search: CompetitorSearch;
    finish: OnboardingActions["finish"];
    verticals: boolean;
  }> = {},
) {
  const actions: OnboardingActions = {
    // UI2: the two real reading stages. readHome = stages 1–3, readServices = stage 4.
    readHome: vi.fn(async (): Promise<SiteProfile> => ({
      areaServed: [],
      sameAs: [],
      sources: {},
      ...(over.site ?? { status: "ok", name: "Example Ramen House", cuisine: "ramen", sources: { name: "schema" } }),
    })),
    readServices: vi.fn(
      async (): Promise<SiteServices> =>
        over.services ?? { status: "ok", services: ["Tonkotsu", "Shoyu"], source: "nav" },
    ),
    findCompetitors: vi.fn(async (): Promise<CompetitorSearch> => over.search ?? { status: "ok", items: five }),
    finish: vi.fn(over.finish ?? (async () => undefined)),
  };
  render(<Onboarding places={places} cuisines={cuisines} actions={actions} verticals={over.verticals} />);
  return { actions, user: userEvent.setup() };
}

// UI1: the field's own "Read my site" (the phone bar repeats it below md; jsdom renders both).
const readMySite = () => screen.getAllByRole("button", { name: "Read my site" })[0];

async function stepOne(user: ReturnType<typeof userEvent.setup>, domain = "exampleramen.test") {
  await user.type(screen.getByLabelText("Your website"), domain);
  await user.click(readMySite());
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
  await screen.findByText("Step 3 of 4 · Competitors");
  await screen.findAllByRole("checkbox", { name: /Example/ });
  await s.user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Step 4 of 4 · Questions");
}

// OB2 (planner, lead-approved): one heading per step. The page's H1 is "Add your business"; step 1 adds no
// H2 of its own (it said "Business" again), steps 2 and 3 keep theirs. "Step n of 3" stays.
describe("Onboarding: one heading per step (OB2)", () => {
  it("steps 1 and 2 have no H2; Competitors and Questions keep theirs", async () => {
    const s = setup();
    expect(screen.getByText("Step 1 of 4 · Your site")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    await toStepTwo(s);
    await screen.findByText("Step 3 of 4 · Competitors");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Competitors");
    await screen.findAllByRole("checkbox", { name: /Example/ });
    await s.user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 4 of 4 · Questions");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Questions");
  });
});

// UI1 (onboarding v2, O1; README §10): the welcome step. Task on the left, an Example result on the right
// (stacked below the task on phones), "What happens next", and one primary, "Read my site". Strings are P2
// pending (the founder's copy pass), in onboarding/copy.ts's welcome block.
describe("Onboarding 1: Your site (UI1 welcome)", () => {
  it("the field, the two links under it and What happens next (steps 2 to 4)", () => {
    setup();
    expect(screen.getByLabelText("Your website")).toHaveAttribute("placeholder", "yoursite.com");
    expect(screen.getByText("About 5 minutes to set up.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No website? Fill it in yourself" })).toBeInTheDocument();
    const next = screen.getByRole("list", { name: "What happens next" });
    expect(
      within(next)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "2Your businessRank1 reads your site and fills in a card you can change.",
      "3CompetitorsPick 3 to 5 businesses to compare against.",
      `4QuestionsRank1 writes up to ${MAX_ACTIVE_QUESTIONS} questions people ask AI about businesses like yours.`,
    ]);
    // No eyebrow above the H1 (OC6): the step lives in the rail, and in the phone bar.
    expect(screen.getByText("Step 1 of 4 · Your site").closest("[data-step-bar]")).not.toBeNull();
  });

  it("one primary: the field's Read my site at md+, the phone bar's below md, never both", () => {
    setup();
    const [field, bar] = screen.getAllByRole("button", { name: "Read my site" });
    expect(field.className).toContain("bg-accent");
    expect(field.closest("[data-step-field]")!.className).toContain("max-md:[&_[data-field]_button]:hidden");
    expect(bar.closest("[data-step-bar]")!.className).toContain("md:hidden");
    const filled = screen.getAllByRole("button").filter((b) => b.className.includes("bg-accent"));
    expect(filled).toEqual([field, bar]);
  });

  it("the phone bar's Read my site submits the field", async () => {
    const { actions, user } = setup();
    await user.type(screen.getByLabelText("Your website"), "exampleramen.test");
    await user.click(screen.getAllByRole("button", { name: "Read my site" })[1]);
    expect(actions.readHome).toHaveBeenCalledWith("exampleramen.test");
    expect(await screen.findByText("Step 2 of 4 · Your business")).toBeInTheDocument();
  });

  // #203 review B1: with no website, Finish sends domain null (the RPC rejects "").
  it("No website? then Finish sends the business with domain null", async () => {
    const s = setup();
    await s.user.click(screen.getByRole("button", { name: "No website? Fill it in yourself" }));
    await s.user.type(await screen.findByLabelText("Business name"), "Example Ramen House");
    await s.user.selectOptions(screen.getByLabelText("Cuisine"), "ramen");
    await toStepTwoFromBusiness(s);
    await screen.findAllByRole("checkbox", { name: /Example/ });
    await s.user.click(screen.getByRole("button", { name: "Next" }));
    await s.user.click(await screen.findByRole("button", { name: "Finish setup" }));
    expect(vi.mocked(s.actions.finish).mock.calls[0][0].business.domain).toBeNull();
  });

  it("No website? opens an empty business card without reading anything", async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole("button", { name: "No website? Fill it in yourself" }));
    expect(await screen.findByLabelText("Business name")).toHaveValue("");
    expect(screen.getByText("Step 2 of 4 · Your business")).toBeInTheDocument();
    expect(actions.readHome).not.toHaveBeenCalled();
    expect(screen.queryByText(/We couldn't read that site/)).toBeNull();
  });

  it("the Example panel: labelled Example data, the You row says Your business, and every % has its n", () => {
    setup();
    const panel = screen.getByRole("figure", { name: "What you'll see after your first check" });
    expect(within(panel).getByText("Example data")).toBeInTheDocument();
    expect(within(panel).getByText("Every number shows how many answers it's based on.")).toBeInTheDocument();
    const rows = within(within(panel).getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      "Example Izakaya43% 70 of 160",
      "Your businessYou34% 55 of 160",
      "Example Udon House31% 50 of 160",
      "Example Pho Spot23% 38 of 160",
    ]);
    for (const [engine, n] of [
      ["ChatGPT", "16 of 40"],
      ["Gemini", "13 of 40"],
      ["Google AI Overview", "15 of 40"],
      ["Perplexity", "11 of 40"],
    ])
      expect(within(panel).getByText(engine).parentElement).toHaveTextContent(n);
    expect(within(panel).queryByText("Example Ramen House")).toBeNull();
    for (const t of within(panel).getAllByText(/\d+%/)) expect(t.textContent).toMatch(/\d+% \d+ of \d+/);
  });

  it("the Example panel only shows on step 1", async () => {
    const s = setup();
    await stepOne(s.user);
    await screen.findByLabelText("Business name");
    expect(screen.queryByText("Example data")).toBeNull();
  });
});

describe("Onboarding 2: Business", () => {
  it("starts blank with Irvine, CA prefilled, and checks the domain ending first", async () => {
    const { actions, user } = setup();
    expect(screen.getByText("Step 1 of 4 · Your site")).toBeInTheDocument();
    await stepOne(user, "exampleramen");
    expect(screen.getByText("Add the ending, like ramenhouse.com")).toBeInTheDocument();
    expect(actions.readHome).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Your website"));
    await stepOne(user, "https://www.ExampleRamen.test/menu");
    expect(actions.readHome).toHaveBeenCalledWith("exampleramen.test");
    expect(await screen.findByLabelText("Business name")).toHaveValue("Example Ramen House");
    expect(screen.getByLabelText("Cuisine")).toHaveValue("ramen");
    expect(screen.getByLabelText("City")).toHaveValue("Irvine");
    expect(screen.getByLabelText("State")).toHaveValue("CA");
  });

  // UI2 (O1, README §10): the right panel becomes the live reading log. It ticks only when a server action
  // really finishes: readHome = stages 1–3, then readServices = stage 4. Polite live region.
  it("the reading log ticks the real stages in order, then opens the card", async () => {
    const { actions, user } = setup({
      site: {
        status: "ok",
        name: "Example Ramen House",
        cuisine: "ramen",
        phone: "+1 949 555 0100",
        sources: { name: "schema", cuisine: "meta", phone: "schema" },
      },
    });
    let home!: (p: SiteProfile) => void;
    let services!: (s: SiteServices) => void;
    vi.mocked(actions.readHome).mockReturnValue(new Promise((r) => (home = r)));
    vi.mocked(actions.readServices).mockReturnValue(new Promise((r) => (services = r)));
    await stepOne(user);
    const log = screen.getByRole("group", { name: "Reading exampleramen.test" });
    expect(within(log).getByRole("list")).toHaveAttribute("aria-live", "polite");
    expect(within(log).getByText("0 of 4")).toBeInTheDocument();
    expect(within(log).queryByText("Opened exampleramen.test")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reading…" })[0]).toBeInTheDocument();
    expect(actions.readServices).not.toHaveBeenCalled();
    expect(screen.queryByText("Example data")).toBeNull();

    home({
      status: "ok",
      name: "Example Ramen House",
      cuisine: "ramen",
      phone: "+1 949 555 0100",
      areaServed: [],
      sameAs: [],
      sources: { name: "schema", cuisine: "meta", phone: "schema" },
    });
    expect(await within(log).findByText("3 of 4")).toBeInTheDocument();
    const rows = within(log).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "Opened exampleramen.test",
      "Business detailsFound name, phone in schema.org",
      "Title and descriptionFound in the page head",
      "ServicesReading your menu links…",
    ]);
    expect(rows.slice(0, 3).every((r) => r.querySelector("[data-icon=check]"))).toBe(true);
    expect(rows[3].querySelector("[data-stage-spinner]")).not.toBeNull();
    expect(actions.readServices).toHaveBeenCalledWith("exampleramen.test");

    services({ status: "ok", services: ["Tonkotsu", "Shoyu"], source: "nav" });
    expect(await screen.findByLabelText("Business name")).toHaveValue("Example Ramen House");
    expect(screen.getByText("Step 2 of 4 · Your business")).toBeInTheDocument();
  });

  // v0.8.2 QA F2: the finished log ("4 of 4", Services ticked) paints and is announced before the card opens.
  it("the finished log shows 4 of 4 before the card opens", async () => {
    const { actions, user } = setup();
    let services!: (s: SiteServices) => void;
    vi.mocked(actions.readServices).mockReturnValue(new Promise((r) => (services = r)));
    await stepOne(user);
    const log = screen.getByRole("group", { name: "Reading exampleramen.test" });
    await within(log).findByText("3 of 4");
    services({ status: "ok", services: ["Tonkotsu", "Shoyu"], source: "nav" });
    expect(await within(log).findByText("4 of 4")).toBeInTheDocument();
    expect(within(log).getByText("2 found in your menu")).toBeInTheDocument();
    expect(screen.queryByLabelText("Business name")).toBeNull();
    expect(await screen.findByLabelText("Business name")).toBeInTheDocument();
  });

  it("nothing in schema.org or the page head reads 'Not on your site'", async () => {
    const { actions, user } = setup({ site: { status: "ok", sources: {} } });
    vi.mocked(actions.readServices).mockReturnValue(new Promise(() => {}));
    await stepOne(user);
    const log = screen.getByRole("group", { name: "Reading exampleramen.test" });
    expect(await within(log).findByText("3 of 4")).toBeInTheDocument();
    expect(within(log).getAllByText("Not on your site")).toHaveLength(2);
  });

  it("reduced motion: the spinner is a static dot", async () => {
    const { actions, user } = setup();
    vi.mocked(actions.readServices).mockReturnValue(new Promise(() => {}));
    await stepOne(user);
    const spinner = await screen.findByTestId("stage-spinner");
    expect(spinner.querySelector("svg")!.getAttribute("class")).toContain("motion-reduce:hidden");
    expect(spinner.querySelector("[data-static-dot]")!.className).toContain("motion-reduce:block");
  });

  // Q8: an unreadable site goes straight to the empty card with one line. Services aren't read.
  it("unreadable site: the empty card with 'We couldn't read that site. Fill in your business below.'", async () => {
    const { actions, user } = setup({ site: { status: "unreadable" } });
    await stepOne(user);
    expect(await screen.findByText("We couldn't read that site. Fill in your business below.")).toBeInTheDocument();
    expect(screen.getByLabelText("Business name")).toHaveValue("");
    expect(actions.readServices).not.toHaveBeenCalled();
    expect(screen.queryByText(/Type 3 things you sell/)).toBeNull();
  });

  it("site read but no cuisine: highlights the cuisine select, Next stays off until it's picked", async () => {
    const { user } = setup({ site: { status: "ok", name: "Example Ramen House" } });
    await stepOne(user);
    const cuisine = await screen.findByLabelText("Cuisine");
    expect(cuisine).toHaveAttribute("data-attention");
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute("aria-disabled", "true");
    await user.selectOptions(cuisine, "ramen");
    expect(cuisine).not.toHaveAttribute("data-attention");
    expect(screen.getByRole("button", { name: "Next" })).not.toHaveAttribute("aria-disabled");
  });
});

// X24 (UX plan PR 26): a disabled Next names what's missing, tied with aria-describedby (approved strings).
describe("Onboarding: reason lines next to Next (X24)", () => {
  const next = () => screen.getByRole("button", { name: "Next" });

  // Founder rule (lead, #175): never a silent disabled button. Next stays focusable (aria-disabled, not
  // disabled), points at the reason, and pressing it early keeps focus and announces the reason.
  it("step 1 names the first missing field: name, cuisine, city, state", async () => {
    const { user } = setup({ site: { status: "ok" } });
    await stepOne(user);
    await screen.findByLabelText("Business name");
    expect(next()).toHaveAttribute("aria-disabled", "true");
    expect(next()).not.toBeDisabled();
    expect(next()).toHaveAccessibleDescription("Add your business name first.");
    await user.click(next());
    expect(next()).toHaveFocus();
    expect(screen.getByText("Step 2 of 4 · Your business")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Add your business name first.");
    await user.type(screen.getByLabelText("Business name"), "Example Ramen House");
    expect(next()).toHaveAccessibleDescription("Pick a cuisine first.");
    await user.selectOptions(screen.getByLabelText("Cuisine"), "ramen");
    expect(next()).not.toHaveAttribute("aria-disabled");
    expect(next()).not.toHaveAccessibleDescription();
    await user.clear(screen.getByLabelText("City"));
    expect(next()).toHaveAccessibleDescription("Add your city first.");
    await user.type(screen.getByLabelText("City"), "Irvine");
    await user.clear(screen.getByLabelText("State"));
    expect(next()).toHaveAttribute("aria-disabled", "true");
    expect(next()).toHaveAccessibleDescription("Add your state first.");
    expect(screen.getByText("Add your state first.")).toBeVisible();
  });

  it("step 2: 'Finding places near you…' beside Next until the search is back; an early press stays put", async () => {
    let done: (r: CompetitorSearch) => void = () => {};
    const s = setup();
    vi.mocked(s.actions.findCompetitors).mockReturnValue(new Promise((r) => (done = r)));
    await toStepTwo(s);
    await screen.findByText("Step 3 of 4 · Competitors");
    expect(next()).toHaveAttribute("aria-disabled", "true");
    expect(next()).toHaveAccessibleDescription("Finding places near you…");
    await s.user.click(next());
    expect(screen.getByText("Step 3 of 4 · Competitors")).toBeInTheDocument();
    expect(next()).toHaveFocus();
    // The loading state is a status region too: look for the one saying the reason.
    expect(await screen.findByText("Finding places near you…", { selector: "[role=status]" })).toBeInTheDocument();
    done({ status: "ok", items: five });
    await screen.findAllByRole("checkbox", { name: /Example/ });
    expect(next()).not.toHaveAttribute("aria-disabled");
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

// X23 (UX plan PR 26b): 25 one-line rows (Track, short form, location tag); tapping a row opens its editor
// (short, long, location), one at a time; a sticky "{n} of {total} questions tracked" bar holds Finish.
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
  const rows = () => screen.getAllByRole("group", { name: /^\d+$/ });
  const toggle = (i: number) =>
    within(rows()[i])
      .getAllByRole("button")
      .find((b) => b.hasAttribute("aria-expanded"))!;
  const openRow = async (s: ReturnType<typeof setup>, i: number) => {
    if (toggle(i).getAttribute("aria-expanded") !== "true") await s.user.click(toggle(i));
  };

  it("25 one-line rows: short form, Track (on), the City tag; no editor until a row is tapped", async () => {
    const s = setup();
    await toStepThree(s);
    expect(expected).toHaveLength(25);
    expect(rows()).toHaveLength(25);
    expect(rows().map((_, i) => toggle(i).textContent)).toEqual(expected.map((q) => q.short_text));
    screen.getAllByRole("checkbox", { name: /^Track: / }).forEach((b) => expect(b).toBeChecked());
    // S2 (#178): the location tag is neutral; info blue is for You only.
    rows().forEach((r) => expect(within(r).getByText("City", { selector: ":not(option)" })).toHaveClass("bg-raised"));
    // S1 (#178): each Track names its question, so 25 checkboxes aren't all just "Track".
    expect(screen.getAllByRole("checkbox", { name: /^Track: / }).map((b) => b.getAttribute("aria-label"))).toEqual(
      expected.map((q) => `Track: ${q.short_text}`),
    );
    expect(screen.queryAllByLabelText("Short form")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Long form")).toHaveLength(0);
  });

  it("tapping a row opens its editor with focus in Short form; one row open at a time", async () => {
    const s = setup();
    await toStepThree(s);
    await s.user.click(toggle(2));
    expect(toggle(2)).toHaveAttribute("aria-expanded", "true");
    expect(within(rows()[2]).getByLabelText("Short form")).toHaveFocus();
    expect(within(rows()[2]).getByLabelText("Long form")).toHaveValue(expected[2].long_text);
    expect(within(rows()[2]).getByLabelText("Location level")).toHaveValue("city");
    await s.user.click(toggle(5));
    expect(toggle(2)).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByLabelText("Short form")).toHaveLength(1);
    await s.user.click(toggle(5));
    expect(screen.queryAllByLabelText("Short form")).toHaveLength(0);
  });

  it("the sticky bar counts tracked questions against the plan limit", async () => {
    const s = setup();
    await toStepThree(s);
    expect(screen.getByText(`25 of ${MAX_ACTIVE_QUESTIONS} questions tracked`)).toBeInTheDocument();
    await s.user.click(screen.getAllByRole("checkbox", { name: /^Track: / })[3]);
    expect(screen.getByText(`24 of ${MAX_ACTIVE_QUESTIONS} questions tracked`)).toBeInTheDocument();
  });

  it("an edited question gets the 'Edited' tag on its line", async () => {
    const s = setup();
    await toStepThree(s);
    expect(screen.queryByText("Edited")).not.toBeInTheDocument();
    await openRow(s, 0);
    await s.user.type(screen.getByLabelText("Short form"), " tonight");
    expect(within(rows()[0]).getByText("Edited")).toBeInTheDocument();
    expect(toggle(0)).toHaveTextContent(`${expected[0].short_text} tonight`);
  });

  it("city and state levels grey ChatGPT and Gemini with the tooltip copy; country doesn't, and the tag follows", async () => {
    const s = setup();
    await toStepThree(s);
    await openRow(s, 0);
    const row = rows()[0];
    expect(
      within(row).getByText("ChatGPT can't target a city yet, so we check it for the whole country."),
    ).toBeInTheDocument();
    expect(
      within(row).getByText("Gemini can't target a city yet, so we check it for the whole country."),
    ).toBeInTheDocument();
    await s.user.selectOptions(within(row).getByLabelText("Location level"), "country");
    expect(within(row).queryByText(/can't target a city yet/)).not.toBeInTheDocument();
    // The line's tag (not the select's option) follows the level.
    expect(within(row).getByText("Country", { selector: ":not(option)" })).toBeInTheDocument();
  });

  it("an empty tracked question blocks Finish setup with its number, and opens that row", async () => {
    const s = setup();
    await toStepThree(s);
    await openRow(s, 6);
    await s.user.clear(screen.getByLabelText("Short form"));
    await openRow(s, 0);
    // S3 (#178): Finish is never disabled for a missing input; pressing it says what's wrong.
    const finish = screen.getByRole("button", { name: "Finish setup" });
    expect(finish).not.toBeDisabled();
    expect(finish).not.toHaveAttribute("aria-disabled");
    await s.user.click(finish);
    expect(screen.getByText("Couldn't save question 7: it's empty.")).toBeInTheDocument();
    expect(toggle(6)).toHaveAttribute("aria-expanded", "true");
    // An emptied line still names itself (axe button-name): the muted "Short form" label.
    expect(toggle(6)).toHaveAccessibleName("Short form");
    expect(s.actions.finish).not.toHaveBeenCalled();
  });

  it("Finish setup sends exactly the ticked competitors and the tracked questions", async () => {
    const s = setup();
    await toStepTwo(s);
    const boxes = await screen.findAllByRole("checkbox", { name: /Example/ });
    await s.user.click(boxes[4]);
    await s.user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 4 of 4 · Questions");
    await s.user.click(screen.getAllByRole("checkbox", { name: /^Track: / })[1]);
    await openRow(s, 0);
    await s.user.selectOptions(screen.getByLabelText("Location level"), "state");
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
      template_key: expected[0].key,
      template_short: expected[0].short_text,
      template_long: expected[0].long_text,
    });
    expect(input.question_picks).toEqual({
      landmarks: ["Diamond Jamboree", "Irvine Spectrum Center", "UC Irvine"],
      areas: ["Northwood", "Turtle Rock", "Woodbridge"],
      dietary: ["vegan", "vegetarian"],
      occasion: ["date night"],
    });
    expect(input.questions[1]).toMatchObject({ active: false, location_level: "city", city: "Irvine", state: "CA" });
  });

  it("a failed save shows the error banner and keeps the answers", async () => {
    const s = setup({ finish: async () => ({ error: "save_failed" }) });
    await toStepThree(s);
    await s.user.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your business. Try again.");
    expect(rows()).toHaveLength(25);
  });

  it("Back returns to the previous step with its answers", async () => {
    const s = setup();
    await toStepThree(s);
    await s.user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Step 3 of 4 · Competitors")).toBeInTheDocument();
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
    await screen.findByText("Step 3 of 4 · Competitors");
    await screen.findAllByRole("checkbox", { name: /Example/ });
    await s.user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 4 of 4 · Questions");
    await s.user.click(screen.getByRole("button", { name: "Finish setup" }));
    const input = vi.mocked(s.actions.finish).mock.calls[0][0] as OnboardingInput;
    expect(input.business.vertical).toBe("hvac");
    expect(input.questions).toHaveLength(25);
  });
});
