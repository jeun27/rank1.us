"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PillField } from "@/components/forms/PillField";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { DomainField } from "@/components/ui/DomainField";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/Select";
import {
  MAX_ACTIVE_QUESTIONS,
  buildQuestions,
  type Business as TemplateBusiness,
  type Picks,
} from "@/lib/questions/templates";
import { normalizeDomain } from "@/lib/spam/validate";
import type {
  CompetitorSearch,
  LocalPlace,
  OnboardingActions,
  OnboardingInput,
  SiteProfile,
  SiteServices,
} from "./contract";
import { BusinessCard, kindOf, serviceAreaOf, verticalOf, type CardBusiness } from "./BusinessCard";
import { card as cardCopy, copy, reading, welcome as w } from "./copy";
import { ExamplePanel } from "./ExamplePanel";
import { QuestionPreview } from "./QuestionPreview";
import { ReadingLog } from "./ReadingLog";

// DIETARY / OCCASIONS moved to BusinessCard (UI3); re-exported for existing importers.
export { DIETARY, OCCASIONS } from "./BusinessCard";
const LEVELS = ["country", "state", "city"] as const;
type Level = (typeof LEVELS)[number];

// UI3: the business is the card's fields (BusinessCard).
export type Business = CardBusiness;
export type Competitor = {
  name: string;
  domain: string | null;
  rating: number | null;
  cid: string | null;
  checked: boolean;
};
export type Question = {
  short: string;
  long: string;
  template: { short: string; long: string; key: string };
  active: boolean;
  level: Level;
};
export type Draft = {
  // UI1: 1 Your site, 2 Your business, 3 Competitors, 4 Questions.
  step: 1 | 2 | 3 | 4;
  // manual: "No website? Fill it in yourself" (nothing read).
  site: "idle" | "loading" | "ok" | "unreadable" | "manual";
  siteCuisine: boolean;
  business: Business;
  picks: Picks;
  search: { key: string; result: CompetitorSearch | null } | null;
  competitors: Competitor[];
  manual: Competitor[];
  questions: { key: string; rows: Question[] } | null;
};

export const emptyDraft: Draft = {
  step: 1,
  site: "idle",
  siteCuisine: false,
  business: {
    domain: "",
    name: "",
    kind: "",
    category: "",
    cuisine: "",
    // UI3: no Irvine default (the landmark bug's source); the site or the owner fills the city.
    city: "",
    state: "",
    address: "",
    phone: "",
    serviceArea: "",
    services: [],
    servicesFound: 0,
    sources: {},
  },
  picks: { landmarks: [], areas: [], dietary: [], occasion: [] },
  search: null,
  competitors: [],
  manual: [],
  questions: null,
};

// D35: 6px controls, like the rest of the app (no Field Notes pills).
const ghost =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-fieldBorder bg-white px-5 text-ui font-semibold text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";
const select =
  "h-11 w-full rounded-control border bg-paper px-3 text-ui text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep md:h-9";

// What the competitor lookup searches for: the cuisine, or what a non-restaurant does.
const searchTerm = (b: Business) => (b.kind === "restaurant" ? b.cuisine : b.category || b.cuisine);
const searchKey = (b: Business) => [searchTerm(b), b.city, b.state, b.domain].join("|");
// UI3: the templates' view of the card, shared by the preview and step 4 so they always agree.
export const templateBusiness = (b: Business): TemplateBusiness => ({
  vertical: verticalOf(b),
  cuisine: b.kind === "restaurant" ? b.cuisine : null,
  city: b.city.trim(),
  state: b.state.trim(),
  category: b.category || null,
  services: b.services,
});
const questionKey = (b: Business, p: Picks) => JSON.stringify([templateBusiness(b), p]);

export function Onboarding({
  cuisines,
  actions,
  initial = emptyDraft,
  syncUrl = true,
}: {
  cuisines: readonly string[];
  actions: OnboardingActions;
  initial?: Draft;
  syncUrl?: boolean;
}) {
  const [d, setD] = useState<Draft>(initial);
  const reached = useRef(initial.step);
  // Focus the card's first field when it opens from step 1 (not on a resumed or gallery render).
  const focusCard = useRef(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  // The step lives in ?step= so the browser Back button walks the steps.
  const go = (step: Draft["step"]) => {
    reached.current = Math.max(reached.current, step) as Draft["step"];
    set({ step });
    if (syncUrl) history.pushState(null, "", `?step=${step}`);
    window.scrollTo?.({ top: 0 });
  };
  useEffect(() => {
    if (!syncUrl) return;
    const onPop = () => {
      const n = Number(new URLSearchParams(location.search).get("step")) || 1;
      setD((x) => ({ ...x, step: Math.min(n, reached.current) as Draft["step"] }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [syncUrl]);

  return (
    <div className={`flex flex-col gap-6 ${d.step > 2 ? "max-w-2xl" : ""}`}>
      {/* OB2: one H1 at the app title size. UI3: step 2's is "Check your business". */}
      <h1 className="heading-gradient font-display text-title font-semibold tracking-[-0.02em]">
        {d.step === 2 ? cardCopy.title : copy.title}
      </h1>
      {d.step > 2 && (
        <div className="-mt-4">
          {/* UI1: the rail shows the steps at md+; phones get this line (steps 1 and 2 have it in a sticky bar). */}
          <p className="text-caption text-inkMuted md:hidden">{w.stepOf(d.step, w.steps[d.step - 1])}</p>
          <h2 className="font-display text-h2 font-semibold md:text-h2-md">{w.steps[d.step - 1]}</h2>
        </div>
      )}
      {d.step === 1 && (
        <WelcomeStep
          d={d}
          set={set}
          cuisines={cuisines}
          actions={actions}
          onNext={() => {
            focusCard.current = true;
            go(2);
          }}
        />
      )}
      {d.step === 2 && (
        <BusinessStep d={d} set={set} cuisines={cuisines} actions={actions} focusRef={focusCard} onNext={() => go(3)} />
      )}
      {d.step === 3 && <CompetitorsStep d={d} set={set} actions={actions} onBack={() => go(2)} onNext={() => go(4)} />}
      {d.step === 4 && <QuestionsStep d={d} set={set} actions={actions} onBack={() => go(3)} />}
    </div>
  );
}

type StepProps = { d: Draft; set: (p: Partial<Draft>) => void };

// X24 + the founder rule (never a silent disabled button): the muted line beside a not-ready Next, which
// the button points at, plus a polite region that says it again when Next is pressed early.
function Reason({ id, text, said }: { id: string; text: string | null; said: string }) {
  return (
    <>
      {text && (
        <p id={id} className="text-caption text-inkMuted">
          {text}
        </p>
      )}
      <span role="status" className="sr-only">
        {text ? said : ""}
      </span>
    </>
  );
}

// An early press: clear, then set, so a repeat is announced too.
function useNudge() {
  const [said, setSaid] = useState("");
  const nudge = (text: string) => {
    setSaid("");
    setTimeout(() => setSaid(text));
  };
  return [said, nudge] as const;
}

const notReady = "aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

// Back + the one primary button; a sticky bar on phones (pinned: at every width, for step 3's long list).
function Bar({
  onBack,
  pinned = false,
  step,
  children,
}: {
  onBack?: () => void;
  pinned?: boolean;
  // UI3 (OC6): on phones the bar names the step where Back would sit.
  step?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-border bg-paper px-5 py-3 ${pinned ? "md:mx-0 md:px-0" : "md:static md:mx-0 md:border-0 md:px-0"}`}
    >
      {onBack ? (
        <button type="button" onClick={onBack} className={ghost}>
          {copy.back}
        </button>
      ) : step ? (
        <p className="min-w-0 truncate text-caption text-text2 md:hidden">{step}</p>
      ) : (
        <span />
      )}
      {/* Wraps at 375 so a reason or the count never pushes the page sideways. */}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">{children}</div>
    </div>
  );
}

// UI1 (O1, README §10): the task on the left, an Example result on the right (below the task on phones), and
// one primary. Below md the field's own button hides and a sticky bar holds the step and "Read my site".
function WelcomeStep({
  d,
  set,
  cuisines,
  actions,
  onNext,
}: StepProps & { cuisines: readonly string[]; actions: OnboardingActions; onNext: () => void }) {
  const [domainError, setDomainError] = useState(false);
  // UI2: what each real reading stage returned, for the live log.
  const [read, setRead] = useState<{ home: SiteProfile | null; services: SiteServices | null }>({
    home: null,
    services: null,
  });
  const field = useRef<HTMLDivElement>(null);
  const nextId = useId();
  const b = d.business;
  const loading = d.site === "loading";

  const submitDomain = async (raw: string) => {
    const domain = normalizeDomain(raw);
    setDomainError(!domain);
    if (!domain) return;
    setRead({ home: null, services: null });
    set({ site: "loading", business: { ...b, domain } });
    // Stages 1–3, then 4: two server actions, so the log only ticks on real progress.
    const home = await actions
      .readHome(domain)
      .catch((): SiteProfile => ({ status: "unreadable", areaServed: [], sameAs: [], sources: {} }));
    if (home.status !== "ok") {
      set({ site: "unreadable", siteCuisine: false, business: { ...emptyDraft.business, domain } });
      return onNext();
    }
    setRead({ home, services: null });
    const services = await actions
      .readServices(domain)
      .catch((): SiteServices => ({ status: "unreadable", services: [], source: null }));
    setRead({ home, services });
    const cuisine = home.cuisine && cuisines.includes(home.cuisine) ? home.cuisine : "";
    set({
      site: "ok",
      siteCuisine: Boolean(cuisine),
      // UI3: the card, filled from the site; each field keeps its source for the tags.
      business: {
        ...emptyDraft.business,
        domain,
        name: home.name ?? "",
        kind: kindOf(home.vertical),
        vertical: home.vertical,
        category: home.category ?? "",
        cuisine,
        city: home.city ?? "",
        state: home.state ?? "",
        address: home.address ?? "",
        phone: home.phone ?? "",
        serviceArea: home.areaServed.join(", "),
        services: services.services,
        servicesFound: services.services.length,
        sources: home.sources,
      },
    });
    onNext();
  };

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] md:gap-12">
      <div className="flex flex-col gap-8">
        <p className="-mt-4 text-body text-text2">{copy.sub}</p>
        <div className="flex flex-col gap-2">
          {/* The visible label; the field keeps its own (screen-reader) label. */}
          <p aria-hidden className="text-ui font-medium text-ink">
            {w.label}
          </p>
          <div data-step-field ref={field} className="max-md:[&_[data-field]_button]:hidden">
            <DomainField
              label={w.label}
              placeholder={copy.domain.placeholder}
              buttonLabel={w.read}
              loadingLabel={reading.button}
              state={loading ? "loading" : domainError ? "error" : "default"}
              errorText={copy.domain.noEnding}
              defaultValue={b.domain}
              onSubmit={submitDomain}
            />
          </div>
          <p className="text-caption text-text2">
            {w.time}{" "}
            <button
              type="button"
              onClick={() => {
                set({ site: "manual", business: { ...emptyDraft.business } });
                onNext();
              }}
              className="font-medium text-accent underline underline-offset-2 max-md:inline-flex max-md:min-h-11 max-md:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
            >
              {w.manual}
            </button>
          </p>
        </div>
        {/* While reading, the left column is just the field (the log on the right is the feedback). */}
        <div hidden={loading}>
          <p id={nextId} className="text-ui font-medium text-ink">
            {w.nextTitle}
          </p>
          <ol aria-labelledby={nextId} className="mt-3 border-t border-border">
            {w.next.map((line, i) => (
              <li key={i} className="flex gap-3 border-b border-border py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-fieldBorder font-mono text-caption text-text2">
                  {i + 2}
                </span>
                <span className="flex flex-col">
                  <span className="text-ui font-medium text-ink">{w.steps[i + 1]}</span>
                  <span className="text-caption text-text2">{line(MAX_ACTIVE_QUESTIONS)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {loading ? <ReadingLog domain={b.domain} home={read.home} services={read.services} /> : <ExamplePanel />}
      {/* OC3/OC6: below md the step and the one primary sit in a sticky bar (44px, over the home indicator). */}
      <div
        data-step-bar
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-white px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      >
        <p className="min-w-0 truncate text-caption text-text2">{w.stepOf(1, w.steps[0])}</p>
        <Button
          type="button"
          loading={loading}
          className="min-h-11 shrink-0"
          onClick={() => field.current?.querySelector("form")?.requestSubmit()}
        >
          {loading ? reading.button : w.read}
        </Button>
      </div>
    </div>
  );
}

// UI3 (O1, README §10): the business card, filled from the site, with the questions it makes on the right.
function BusinessStep({
  d,
  set,
  cuisines,
  actions,
  focusRef,
  onNext,
}: StepProps & {
  cuisines: readonly string[];
  actions: OnboardingActions;
  focusRef: { current: boolean };
  onNext: () => void;
}) {
  const reasonId = useId();
  const [said, nudge] = useNudge();
  const b = d.business;
  const setB = (patch: Partial<Business>) => set({ business: { ...b, ...patch } });
  // After a site read (or "No website?"), focus moves to the first field the user fills in.
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!focusRef.current) return;
    focusRef.current = false;
    form.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
  }, [focusRef]);

  // The landmarks and areas Rank1 knows for this city (none: the pickers stay hidden).
  const [places, setPlaces] = useState<LocalPlace[]>([]);
  const city = b.city.trim();
  const state = b.state.trim();
  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () =>
        actions
          .places(city, state)
          .then((p) => live && setPlaces(p))
          .catch(() => live && setPlaces([])),
      city && state ? 300 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [actions, city, state]);

  const attention = d.site === "ok" && b.kind === "restaurant" && !d.siteCuisine && !b.cuisine;
  // X24: the first missing field, in form order.
  const missing = !b.kind
    ? cardCopy.missingType
    : !b.name.trim()
      ? copy.missing.name
      : b.kind === "restaurant" && !b.cuisine
        ? copy.missing.cuisine
        : !city
          ? copy.missing.city
          : !state
            ? copy.missing.state
            : null;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] md:gap-12">
      <form
        ref={form}
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (missing) nudge(missing);
          else onNext();
        }}
      >
        {/* OC2: one line says where the card came from; only exceptions get a tag. */}
        {d.site === "ok" && b.domain && (
          <p className="-mt-4 text-caption text-text2">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span aria-hidden className="size-1.5 rounded-full bg-moss" />
              {cardCopy.filled(b.domain)}
            </span>{" "}
            {cardCopy.change}
          </p>
        )}
        {/* Q8: an unreadable site opens the same card, empty, with one line. */}
        {d.site === "unreadable" && <p className="-mt-4 text-ui font-medium text-ink">{reading.unreadable}</p>}
        <div className="md:hidden">
          <QuestionPreview phone business={templateBusiness(b)} picks={d.picks} />
        </div>
        <BusinessCard
          b={b}
          setB={setB}
          picks={d.picks}
          setPicks={(picks) => set({ picks })}
          places={places}
          cuisines={cuisines}
          attention={attention}
        />
        <Bar step={w.stepOf(2, w.steps[1])}>
          <Reason id={reasonId} text={missing} said={said} />
          <Button
            type="submit"
            aria-disabled={missing ? true : undefined}
            aria-describedby={missing ? reasonId : undefined}
            className={notReady}
          >
            {cardCopy.next}
          </Button>
          <span className="text-caption text-text2 max-md:hidden">{cardCopy.later}</span>
        </Bar>
      </form>
      <div className="max-md:hidden">
        <QuestionPreview business={templateBusiness(b)} picks={d.picks} />
      </div>
    </div>
  );
}

function CompetitorsStep({
  d,
  set,
  actions,
  onBack,
  onNext,
}: StepProps & { actions: OnboardingActions; onBack: () => void; onNext: () => void }) {
  const b = d.business;
  const key = searchKey(b);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState(false);
  const reasonId = useId();
  const [said, nudge] = useNudge();

  useEffect(() => {
    if (d.search?.key === key) return;
    set({ search: { key, result: null }, competitors: [] });
    actions
      .findCompetitors({ cuisine: searchTerm(b), city: b.city, state: b.state, domain: b.domain })
      .catch((): CompetitorSearch => ({ status: "error", items: [] }))
      .then((result) =>
        set({
          search: { key, result },
          competitors: result.items.map((c) => ({
            name: c.name,
            domain: c.domain ?? null,
            rating: c.rating ?? null,
            cid: c.cid,
            checked: true,
          })),
        }),
      );
    // Runs once per business: Back from step 3 keeps the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const result = d.search?.key === key ? d.search.result : null;
  const add = () => {
    const n = name.trim();
    const dom = domain.trim() ? normalizeDomain(domain) : null;
    setDomainError(Boolean(domain.trim()) && !dom);
    if (!n || (domain.trim() && !dom)) return;
    set({ manual: [...d.manual, { name: n, domain: dom, rating: null, cid: null, checked: true }] });
    setName("");
    setDomain("");
  };
  const toggle = (list: "competitors" | "manual", i: number) =>
    set({ [list]: d[list].map((c, j) => (j === i ? { ...c, checked: !c.checked } : c)) });

  return (
    <div className="flex flex-col gap-5">
      {!result ? (
        <LoadingState message={copy.finding(searchTerm(b), b.city)} />
      ) : result.status !== "ok" ? (
        <Banner tone="error">{copy.loadFailed}</Banner>
      ) : result.items.length === 0 ? (
        <p className="text-body-lg">{copy.noneFound(searchTerm(b), b.city)}</p>
      ) : null}

      {(d.competitors.length > 0 || d.manual.length > 0) && (
        <ul className="flex flex-col gap-2">
          {d.competitors.map((c, i) => (
            <CompetitorRow key={`m${i}`} c={c} onToggle={() => toggle("competitors", i)} />
          ))}
          {d.manual.map((c, i) => (
            <CompetitorRow
              key={`u${i}`}
              c={c}
              onToggle={() => toggle("manual", i)}
              onRemove={() => set({ manual: d.manual.filter((_, j) => j !== i) })}
            />
          ))}
        </ul>
      )}

      {result && (
        <form
          noValidate
          className="flex flex-col gap-3 rounded-surface bg-white p-4 shadow-card md:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          {result.status === "ok" && result.items.length > 0 && result.items.length < 3 && (
            <p className="text-ui">{copy.fewFound}</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <PillField
              label={copy.competitorName}
              name="competitor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <PillField
              label={copy.competitorDomain}
              name="competitor-domain"
              icon="globe"
              value={domain}
              error={domainError ? copy.domain.noEnding : undefined}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div>
            <button type="submit" className={ghost}>
              {copy.addCompetitor}
            </button>
          </div>
        </form>
      )}

      <Bar onBack={onBack}>
        <Reason id={reasonId} text={result ? null : copy.missing.places} said={said} />
        <Button
          onClick={() => (result ? onNext() : nudge(copy.missing.places))}
          aria-disabled={!result || undefined}
          aria-describedby={result ? undefined : reasonId}
          className={notReady}
        >
          {copy.next}
        </Button>
      </Bar>
    </div>
  );
}

function CompetitorRow({ c, onToggle, onRemove }: { c: Competitor; onToggle: () => void; onRemove?: () => void }) {
  const id = useId();
  return (
    <li className="flex items-center gap-3 rounded-card border border-border bg-white px-3 md:px-4">
      <label className="flex min-h-14 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={c.checked}
          onChange={onToggle}
          aria-labelledby={`${id}-name`}
          aria-describedby={`${id}-detail`}
          className="size-5 shrink-0 accent-jellyDeep"
        />
        <span className="min-w-0 flex-1 md:grid md:grid-cols-[2fr_1fr_2fr] md:items-center md:gap-4">
          <span id={`${id}-name`} data-computed className="block truncate text-ui font-semibold">
            {c.name}
          </span>
          <span id={`${id}-detail`} className="contents">
            <span className="block text-caption text-inkMuted tabular-nums">
              {c.rating !== null && (
                <>
                  {copy.rating} <span data-computed>{c.rating.toFixed(1)}</span>
                </>
              )}
            </span>
            <span data-computed className="block truncate text-caption text-inkMuted">
              {c.domain}
            </span>
          </span>
        </span>
      </label>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 px-2 text-caption font-semibold text-link underline underline-offset-4"
        >
          {copy.remove}
        </button>
      )}
    </li>
  );
}

function QuestionsStep({ d, set, actions, onBack }: StepProps & { actions: OnboardingActions; onBack: () => void }) {
  const b = d.business;
  const key = questionKey(b, d.picks);
  const [empty, setEmpty] = useState<number | null>(null);
  // X23: one row's editor open at a time.
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // Built from the templates once per business + picks; edits survive Back and Next.
  const rows =
    d.questions?.key === key
      ? d.questions.rows
      : buildQuestions(templateBusiness(b), d.picks).map((q): Question => ({
          short: q.short_text,
          long: q.long_text,
          template: { short: q.short_text, long: q.long_text, key: q.key },
          active: true,
          level: "city",
        }));
  useEffect(() => {
    if (d.questions?.key !== key) set({ questions: { key, rows } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = (i: number, patch: Partial<Question>) =>
    set({ questions: { key, rows: rows.map((q, j) => (j === i ? { ...q, ...patch } : q)) } });

  const finish = async () => {
    const bad = rows.findIndex((q) => q.active && (!q.short.trim() || !q.long.trim()));
    setEmpty(bad >= 0 ? bad : null);
    if (bad >= 0) return setOpen(bad);
    const input: OnboardingInput = {
      business: {
        name: b.name.trim(),
        // No website: null, never "" or a placeholder (#203 B1).
        domain: b.domain || null,
        cuisine: b.kind === "restaurant" ? b.cuisine : "",
        city: b.city.trim(),
        state: b.state.trim(),
        country: "US",
        aliases: [],
        // UI3: the card's type and profile fields (BE1), each with where it came from.
        vertical: verticalOf(b),
        category: b.category.trim() || null,
        address: b.address.trim() || null,
        phone: b.phone.trim() || null,
        services: b.services,
        service_area: serviceAreaOf(b) || null,
        profile_sources: b.sources,
      },
      competitors: [
        ...d.competitors.map((c) => ({ c, source: "maps" as const })),
        ...d.manual.map((c) => ({ c, source: "manual" as const })),
      ]
        .filter(({ c }) => c.checked)
        .map(({ c, source }) => ({ name: c.name, domain: c.domain, rating: c.rating, maps_cid: c.cid, source })),
      questions: rows.map((q) => ({
        short_text: q.short.trim(),
        long_text: q.long.trim(),
        active_form: "long",
        active: q.active,
        location_level: q.level,
        country: "US",
        state: q.level === "country" ? null : b.state.trim(),
        city: q.level === "city" ? b.city.trim() : null,
        template_key: q.template.key,
        template_short: q.template.short,
        template_long: q.template.long,
      })),
      question_picks: d.picks,
    };
    setSaving(true);
    setFailed(false);
    const r = await actions.finish(input).catch(() => ({ error: "save_failed" }));
    if (r?.error) {
      setSaving(false);
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {failed && <Banner tone="error">{copy.saveFailed}</Banner>}
      <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-white">
        {rows.map((q, i) => (
          <QuestionRow
            key={i}
            n={i + 1}
            q={q}
            error={empty === i}
            open={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
            onChange={(p) => update(i, p)}
          />
        ))}
      </ol>
      <Bar onBack={onBack} pinned>
        <p data-computed className="text-caption text-inkMuted tabular-nums">
          {copy.tracked(rows.filter((q) => q.active).length, MAX_ACTIVE_QUESTIONS)}
        </p>
        <Button onClick={finish} loading={saving}>
          {copy.finish}
        </Button>
      </Bar>
    </div>
  );
}

// X23: one line (Track, the short form, the location tag); tapping the short form opens the editor.
function QuestionRow({
  n,
  q,
  error,
  open,
  onToggle,
  onChange,
}: {
  n: number;
  q: Question;
  error: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: (p: Partial<Question>) => void;
}) {
  const id = useId();
  const short = useRef<HTMLInputElement>(null);
  const edited = q.short !== q.template.short || q.long !== q.template.long;
  const field =
    "w-full rounded-control border border-fieldBorder bg-white px-3 text-ui focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";
  useEffect(() => {
    if (open) short.current?.focus();
  }, [open]);
  return (
    <li>
      <fieldset
        aria-describedby={error ? `${id}-error` : undefined}
        className={`flex min-w-0 flex-col ${q.active ? "" : "opacity-75"} ${error ? "border-2 border-brick" : ""}`}
      >
        <legend className="sr-only">{n}</legend>
        {/* min-w-0 on the fieldset too: fieldsets default to min-content, which defeats the truncate. */}
        <div className="flex min-h-11 items-center gap-3 px-3 md:min-h-10">
          <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center md:min-h-10">
            <input
              type="checkbox"
              checked={q.active}
              onChange={() => onChange({ active: !q.active })}
              aria-label={`${copy.track}: ${q.short.trim() || copy.shortForm}`}
              className="size-5 accent-jellyDeep"
            />
          </label>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-edit`}
            onClick={onToggle}
            data-computed
            className="min-h-11 min-w-0 flex-1 truncate text-left text-ui md:min-h-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
          >
            {/* Emptied: the muted field name keeps the line named and shows what's missing. */}
            {q.short.trim() ? q.short : <span className="text-inkMuted">{copy.shortForm}</span>}
          </button>
          {edited && <Badge tone="warn">{copy.edited}</Badge>}
          {/* Neutral: info blue is for You only (#164). */}
          <Badge tone="neutral">{copy.levels[q.level]}</Badge>
        </div>
        {open && (
          <div id={`${id}-edit`} className="flex flex-col gap-3 border-t border-border p-3 md:p-4">
            <div>
              <label htmlFor={`${id}-short`} className="mb-1 block text-caption font-semibold">
                {copy.shortForm}
              </label>
              <input
                ref={short}
                id={`${id}-short`}
                value={q.short}
                onChange={(e) => onChange({ short: e.target.value })}
                className={`${field} h-11`}
              />
            </div>
            <div>
              <label htmlFor={`${id}-long`} className="mb-1 block text-caption font-semibold">
                {copy.longForm}
              </label>
              <textarea
                id={`${id}-long`}
                rows={3}
                value={q.long}
                onChange={(e) => onChange({ long: e.target.value })}
                className={`${field} py-2`}
              />
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
              <div className="md:w-48">
                <label htmlFor={`${id}-level`} className="mb-1 block text-caption font-semibold">
                  {copy.level}
                </label>
                <Select
                  wrap="w-full"
                  id={`${id}-level`}
                  value={q.level}
                  onChange={(e) => onChange({ level: e.target.value as Level })}
                  className={`${select} border-fieldBorder`}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {copy.levels[l]}
                    </option>
                  ))}
                </Select>
              </div>
              {q.level !== "country" && (
                <ul className="flex flex-col gap-1 text-caption text-inkMuted md:pt-6">
                  {["ChatGPT", "Gemini"].map((e) => (
                    <li key={e} data-computed title={copy.cityNote(e)}>
                      {copy.cityNote(e)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {error && (
          <p id={`${id}-error`} data-computed className="px-3 pb-3 text-caption font-semibold text-brick">
            {copy.emptyQuestion(n)}
          </p>
        )}
      </fieldset>
    </li>
  );
}
