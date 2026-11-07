"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PillField } from "@/components/forms/PillField";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { DomainField } from "@/components/ui/DomainField";
import { LoadingState } from "@/components/ui/LoadingState";
import { connectionsCopy } from "@/components/connections/copy";
import { VERTICALS, type Vertical } from "@/lib/queries/onboarding";
import { MAX_ACTIVE_QUESTIONS, buildQuestions, type Picks } from "@/lib/questions/templates";
import { normalizeDomain } from "@/lib/spam/validate";
import type { CompetitorSearch, LocalPlace, OnboardingActions, OnboardingInput } from "./contract";
import { copy } from "./copy";
import { Select } from "@/components/ui/Select";

// docs/UI.md Question templates: {dietary} and {occasion} lists; landmarks and areas max 3 each.
export const DIETARY = ["vegan", "vegetarian", "gluten-free", "halal", "kosher"];
export const OCCASIONS = ["date night", "birthday", "business lunch", "large group"];
const MAX_PLACES = 3;
const LEVELS = ["country", "state", "city"] as const;
type Level = (typeof LEVELS)[number];

export type Business = {
  domain: string;
  name: string;
  cuisine: string;
  city: string;
  state: string;
  sells: string[];
  // C-b: only with ENABLE_CONNECTIONS (the page passes verticals); Restaurant until picked.
  vertical?: Vertical;
};
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
  step: 1 | 2 | 3;
  site: "idle" | "loading" | "ok" | "unreadable";
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
  business: { domain: "", name: "", cuisine: "", city: "Irvine", state: "CA", sells: ["", "", ""] },
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
const chip =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-fieldBorder bg-white px-4 text-ui has-checked:border-jellyDeep has-checked:bg-infoBg has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-jellyDeep";

const searchKey = (b: Business) => [b.cuisine, b.city, b.state, b.domain].join("|");
const questionKey = (b: Business, p: Picks) => JSON.stringify([b.cuisine, b.city, b.state, p]);

export function Onboarding({
  places,
  cuisines,
  actions,
  initial = emptyDraft,
  syncUrl = true,
  verticals = false,
}: {
  places: LocalPlace[];
  cuisines: readonly string[];
  actions: OnboardingActions;
  initial?: Draft;
  syncUrl?: boolean;
  verticals?: boolean;
}) {
  const [d, setD] = useState<Draft>(initial);
  const reached = useRef(initial.step);
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
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-caption text-inkMuted">{copy.step(d.step)}</p>
        {/* OB2: one heading per step. Step 1 is the page's own H1 ("Add your business"). */}
        {d.step > 1 && <h2 className="font-display text-h2 font-semibold md:text-h2-md">{copy.titles[d.step - 1]}</h2>}
      </div>
      {d.step === 1 && (
        <BusinessStep
          d={d}
          set={set}
          places={places}
          cuisines={cuisines}
          actions={actions}
          verticals={verticals}
          onNext={() => go(2)}
        />
      )}
      {d.step === 2 && <CompetitorsStep d={d} set={set} actions={actions} onBack={() => go(1)} onNext={() => go(3)} />}
      {d.step === 3 && <QuestionsStep d={d} set={set} actions={actions} verticals={verticals} onBack={() => go(2)} />}
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
function Bar({ onBack, pinned = false, children }: { onBack?: () => void; pinned?: boolean; children: ReactNode }) {
  return (
    <div
      className={`sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-border bg-paper px-5 py-3 ${pinned ? "md:mx-0 md:px-0" : "md:static md:mx-0 md:border-0 md:px-0"}`}
    >
      {onBack ? (
        <button type="button" onClick={onBack} className={ghost}>
          {copy.back}
        </button>
      ) : (
        <span />
      )}
      {/* Wraps at 375 so a reason or the count never pushes the page sideways. */}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">{children}</div>
    </div>
  );
}

function Checks({
  legend,
  options,
  picked,
  onChange,
  max,
}: {
  legend: string;
  options: string[];
  picked: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  if (!options.length) return null;
  return (
    <fieldset>
      <legend className="mb-1.5 text-caption font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = picked.includes(o);
          return (
            <label key={o} className={chip}>
              <input
                type="checkbox"
                checked={on}
                disabled={!on && max !== undefined && picked.length >= max}
                onChange={() => onChange(on ? picked.filter((p) => p !== o) : [...picked, o])}
                className="size-4 accent-jellyDeep"
              />
              <span data-computed>{o}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function BusinessStep({
  d,
  set,
  places,
  cuisines,
  actions,
  verticals,
  onNext,
}: StepProps & {
  places: LocalPlace[];
  cuisines: readonly string[];
  actions: OnboardingActions;
  verticals: boolean;
  onNext: () => void;
}) {
  const [domainError, setDomainError] = useState(false);
  const cuisineId = useId();
  const verticalId = useId();
  const sellsId = useId();
  const reasonId = useId();
  const [said, nudge] = useNudge();
  const b = d.business;
  const setB = (patch: Partial<Business>) => set({ business: { ...b, ...patch } });
  const read = d.site === "ok" || d.site === "unreadable";

  // After a site read, focus moves to the first field the user fills in.
  const form = useRef<HTMLFormElement>(null);
  const wasRead = useRef(read);
  useEffect(() => {
    if (read && !wasRead.current) form.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    wasRead.current = read;
  }, [read]);

  const submitDomain = async (raw: string) => {
    const domain = normalizeDomain(raw);
    setDomainError(!domain);
    if (!domain) return;
    set({ site: "loading", business: { ...b, domain } });
    const r = await actions.readSite(domain).catch(() => ({ status: "unreadable" as const }));
    const name = "name" in r ? r.name : undefined;
    const cuisine = "cuisine" in r && r.cuisine && cuisines.includes(r.cuisine) ? r.cuisine : "";
    set({
      site: r.status,
      siteCuisine: Boolean(cuisine),
      business: { ...b, domain, name: r.status === "ok" ? (name ?? "") : "", cuisine },
    });
  };

  if (!read)
    return (
      <div className="flex flex-col gap-4">
        <DomainField
          label={copy.domain.label}
          placeholder={copy.domain.placeholder}
          buttonLabel={copy.next}
          state={d.site === "loading" ? "loading" : domainError ? "error" : "default"}
          errorText={copy.domain.noEnding}
          defaultValue={b.domain}
          onSubmit={submitDomain}
        />
        {d.site === "loading" && (
          <div role="status" className="flex flex-col gap-3">
            <p className="text-caption text-inkMuted">{copy.readingSite}</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-control bg-white motion-reduce:animate-none md:h-9" />
            ))}
          </div>
        )}
      </div>
    );

  const attention = d.site === "ok" && !d.siteCuisine && !b.cuisine;
  // X24: the first missing field, in form order.
  const missing = !b.name.trim()
    ? copy.missing.name
    : !b.cuisine
      ? copy.missing.cuisine
      : !b.city.trim()
        ? copy.missing.city
        : !b.state.trim()
          ? copy.missing.state
          : null;
  const ready = !missing;
  const ofKind = (k: LocalPlace["kind"]) => places.filter((p) => p.kind === k).map((p) => p.name);
  const pick = (k: keyof Picks) => (v: string[]) => set({ picks: { ...d.picks, [k]: v } });

  return (
    <form
      ref={form}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (missing) nudge(missing);
        else onNext();
      }}
    >
      <PillField label={copy.domain.label} name="domain" value={b.domain} readOnly icon="globe" />
      {d.site === "unreadable" && (
        <fieldset className="flex flex-col gap-2">
          <legend id={sellsId} className="mb-1.5 text-ui font-semibold text-brick">
            {copy.unreadable}
          </legend>
          {b.sells.map((v, i) => (
            <input
              key={i}
              aria-labelledby={sellsId}
              value={v}
              onChange={(e) => setB({ sells: b.sells.map((x, j) => (j === i ? e.target.value : x)) })}
              className="h-11 rounded-control border border-fieldBorder bg-paper px-3 text-ui focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep md:h-9"
            />
          ))}
        </fieldset>
      )}
      {verticals && (
        <div>
          <label htmlFor={verticalId} className="mb-1.5 block text-caption font-semibold">
            {connectionsCopy.card.industry}
          </label>
          <Select
            wrap="w-full"
            id={verticalId}
            value={b.vertical ?? "restaurant"}
            onChange={(e) => setB({ vertical: e.target.value as Vertical })}
            className={`${select} border-fieldBorder`}
          >
            {VERTICALS.map((v) => (
              <option key={v} value={v}>
                {connectionsCopy.card.verticals[v]}
              </option>
            ))}
          </Select>
        </div>
      )}
      <PillField label={copy.name} name="name" value={b.name} onChange={(e) => setB({ name: e.target.value })} />
      <div>
        <label htmlFor={cuisineId} className="mb-1.5 block text-caption font-semibold">
          {copy.cuisine}
        </label>
        <Select
          wrap="w-full"
          id={cuisineId}
          value={b.cuisine}
          data-attention={attention || undefined}
          onChange={(e) => setB({ cuisine: e.target.value })}
          className={`${select} ${attention ? "border-2 border-amber" : "border-fieldBorder"}`}
        >
          <option value="" />
          {cuisines.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <PillField label={copy.city} name="city" value={b.city} onChange={(e) => setB({ city: e.target.value })} />
        <PillField label={copy.state} name="state" value={b.state} onChange={(e) => setB({ state: e.target.value })} />
      </div>
      <Checks
        legend={copy.landmarks}
        options={ofKind("landmark")}
        picked={d.picks.landmarks}
        onChange={pick("landmarks")}
        max={MAX_PLACES}
      />
      <Checks
        legend={copy.areas}
        options={ofKind("area")}
        picked={d.picks.areas}
        onChange={pick("areas")}
        max={MAX_PLACES}
      />
      <Checks legend={copy.dietary} options={DIETARY} picked={d.picks.dietary} onChange={pick("dietary")} />
      <Checks legend={copy.occasion} options={OCCASIONS} picked={d.picks.occasion} onChange={pick("occasion")} />
      <Bar>
        <Reason id={reasonId} text={missing} said={said} />
        <Button
          type="submit"
          aria-disabled={!ready || undefined}
          aria-describedby={missing ? reasonId : undefined}
          className={notReady}
        >
          {copy.next}
        </Button>
      </Bar>
    </form>
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
      .findCompetitors({ cuisine: b.cuisine, city: b.city, state: b.state, domain: b.domain })
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
        <LoadingState message={copy.finding(b.cuisine, b.city)} />
      ) : result.status !== "ok" ? (
        <Banner tone="error">{copy.loadFailed}</Banner>
      ) : result.items.length === 0 ? (
        <p className="text-body-lg">{copy.noneFound(b.cuisine, b.city)}</p>
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

function QuestionsStep({
  d,
  set,
  actions,
  verticals,
  onBack,
}: StepProps & { actions: OnboardingActions; verticals: boolean; onBack: () => void }) {
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
      : buildQuestions({ cuisine: b.cuisine, city: b.city, state: b.state }, d.picks).map((q): Question => ({
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
        domain: b.domain,
        cuisine: b.cuisine,
        city: b.city.trim(),
        state: b.state.trim(),
        country: "US",
        aliases: [],
        ...(verticals && { vertical: b.vertical ?? "restaurant" }),
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
