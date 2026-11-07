import { useId, useState, type ReactNode } from "react";
import { PillField } from "@/components/forms/PillField";
import { connectionsCopy } from "@/components/connections/copy";
import { Select } from "@/components/ui/Select";
import { VERTICALS, type Vertical } from "@/lib/queries/onboarding";
import { familyOf, type Picks } from "@/lib/questions/templates";
import type { LocalPlace, SiteProfile } from "./contract";
import { card as c, copy } from "./copy";

export const DIETARY = ["vegan", "vegetarian", "gluten-free", "halal", "kosher"];
export const OCCASIONS = ["date night", "birthday", "business lunch", "large group"];
const MAX_PLACES = 3;

// UI3: the five business types on the card. Local service narrows to a local vertical under "What you do".
export const KINDS = ["restaurant", "local", "dtc", "saas", "other"] as const;
export type Kind = (typeof KINDS)[number];
const LOCAL = VERTICALS.filter((v) => familyOf(v) === "local");
export const kindOf = (v: Vertical | undefined): Kind | "" =>
  !v ? "" : v === "restaurant" || v === "dtc" || v === "saas" || v === "other" ? v : "local";

export type CardSources = SiteProfile["sources"];
export type CardBusiness = {
  domain: string;
  name: string;
  // "" = nothing picked yet ("Pick one"): an unread or undetected site never preselects a type.
  kind: Kind | "";
  vertical?: Vertical;
  category: string;
  cuisine: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  serviceArea: string;
  services: string[];
  // How many services the site listed ("{n} found in your menu").
  servicesFound: number;
  sources: CardSources;
};

// The vertical a card saves: the type, narrowed by "What you do" for a local service.
export const verticalOf = (b: CardBusiness): Vertical =>
  b.kind === "local" ? (b.vertical && familyOf(b.vertical) === "local" ? b.vertical : "other") : b.kind || "other";

// "Area you serve": the site's areaServed, else "{city} and nearby cities" until the owner edits it.
export const serviceAreaOf = (b: CardBusiness) => {
  if (!b.kind || b.kind === "restaurant") return "";
  const defaulted = !b.sources.areaServed || b.sources.areaServed === "default";
  return b.serviceArea || (defaulted && b.city.trim() ? c.nearby(b.city.trim()) : "");
};

const select =
  "h-11 w-full rounded-control border border-fieldBorder bg-paper px-3 text-ui text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep md:h-9";
const chip =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-fieldBorder bg-white px-4 text-ui has-checked:border-jellyDeep has-checked:bg-infoBg has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-jellyDeep";

// OC2: only exceptions carry a tag, amber "Not on your site".
function Tag({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-caption ${warn ? "text-warnText" : "text-text2"}`}>
      {warn && <span aria-hidden className="size-1.5 rounded-full bg-amber" />}
      {children}
    </span>
  );
}

// A field with a tag on its label row (the tag sits over PillField's own label line).
function Tagged({ tag, children, className }: { tag?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {tag && <span className="absolute top-0 right-0">{tag}</span>}
      {children}
    </div>
  );
}

// UI3 (O1, README §10): the business card. Business type first (OC1), then the fields for that type.
// UI5 reuses it in Settings with showSources={false} (no tags, no "Detected" line).
export function BusinessCard({
  b,
  setB,
  picks,
  setPicks,
  places,
  cuisines,
  showSources = true,
  attention = false,
}: {
  b: CardBusiness;
  setB: (patch: Partial<CardBusiness>) => void;
  picks: Picks;
  setPicks: (p: Picks) => void;
  places: LocalPlace[];
  cuisines: readonly string[];
  showSources?: boolean;
  attention?: boolean;
}) {
  const typeId = useId();
  const cuisineId = useId();
  const whatId = useId();
  const kind = b.kind;
  // A user edit turns a field's source into "user", which clears its tag.
  const edit = (field: keyof CardSources, patch: Partial<CardBusiness>) =>
    setB({ ...patch, sources: { ...b.sources, [field]: "user" } });
  const fromSite = (field: keyof CardSources) => {
    const s = b.sources[field];
    return Boolean(s && s !== "default" && s !== "user");
  };
  const ofKind = (k: LocalPlace["kind"]) => places.filter((p) => p.kind === k).map((p) => p.name);
  const pick = (k: keyof Picks) => (v: string[]) => setPicks({ ...picks, [k]: v });
  const areaDefault = !b.sources.areaServed || b.sources.areaServed === "default";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <p id={typeId} className="text-caption font-semibold">
            {c.type}
          </p>
          {showSources && fromSite("vertical") && <Tag>{c.detected}</Tag>}
        </div>
        <div
          role="radiogroup"
          aria-labelledby={typeId}
          className="inline-flex max-w-full flex-wrap gap-1 rounded-nested border border-border bg-white p-1"
        >
          {KINDS.map((k) => (
            <label
              key={k}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-control px-3 text-ui text-text2 has-checked:bg-raised has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-jellyDeep md:min-h-8"
            >
              <input
                type="radio"
                name={typeId}
                className="sr-only"
                checked={kind === k}
                onChange={() =>
                  edit("vertical", {
                    kind: k,
                    vertical: k === "local" ? (kindOf(b.vertical) === "local" ? b.vertical : undefined) : k,
                  })
                }
              />
              {c.kinds[k]}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-caption text-text2">{c.typeHint}</p>
      </div>

      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        <PillField
          label={copy.name}
          name="name"
          value={b.name}
          onChange={(e) => edit("name", { name: e.target.value })}
        />
        {kind === "restaurant" && (
          <div>
            <label htmlFor={cuisineId} className="mb-1.5 block text-caption font-semibold">
              {copy.cuisine}
            </label>
            <Select
              wrap="w-full"
              id={cuisineId}
              value={b.cuisine}
              data-attention={attention || undefined}
              onChange={(e) => edit("cuisine", { cuisine: e.target.value })}
              className={`${select} ${attention ? "border-2 border-amber" : ""}`}
            >
              <option value="" />
              {cuisines.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </div>
        )}
        {kind === "local" && (
          <div>
            <label htmlFor={whatId} className="mb-1.5 block text-caption font-semibold">
              {c.whatYouDo}
            </label>
            <Select
              wrap="w-full"
              id={whatId}
              value={b.vertical && familyOf(b.vertical) === "local" ? b.vertical : ""}
              onChange={(e) => edit("category", { vertical: e.target.value as Vertical, category: "" })}
              className={select}
            >
              <option value="">{c.pickOne}</option>
              {LOCAL.map((v) => (
                <option key={v} value={v}>
                  {connectionsCopy.card.verticals[v]}
                </option>
              ))}
            </Select>
          </div>
        )}
        {(kind === "dtc" || kind === "saas" || kind === "other") && (
          <PillField
            label={c.whatYouDo}
            name="category"
            value={b.category}
            onChange={(e) => edit("category", { category: e.target.value })}
          />
        )}
        <PillField
          label={copy.city}
          name="city"
          value={b.city}
          onChange={(e) => edit("city", { city: e.target.value })}
        />
        <PillField
          label={copy.state}
          name="state"
          value={b.state}
          onChange={(e) => edit("state", { state: e.target.value })}
        />
        <PillField
          className="md:col-span-2"
          label={c.address}
          name="address"
          value={b.address}
          onChange={(e) => edit("address", { address: e.target.value })}
        />
        <PillField
          label={c.phone}
          name="phone"
          value={b.phone}
          onChange={(e) => edit("phone", { phone: e.target.value })}
        />
        {kind && kind !== "restaurant" && (
          <Tagged tag={showSources && areaDefault && <Tag warn>{c.notOnSite}</Tag>}>
            <PillField
              label={c.areaServed}
              name="serviceArea"
              value={serviceAreaOf(b)}
              onChange={(e) => edit("areaServed", { serviceArea: e.target.value })}
            />
            {showSources && areaDefault && <p className="mt-1.5 text-caption text-text2">{c.areaHint}</p>}
          </Tagged>
        )}
      </div>

      {kind && (
        <Chips
          label={kind === "restaurant" ? c.menu : c.services}
          add={kind === "restaurant" ? c.addDish : c.addService}
          tag={showSources && b.servicesFound > 0 ? <Tag>{c.found(b.servicesFound)}</Tag> : null}
          items={b.services}
          onChange={(services) => setB({ services })}
        />
      )}

      {kind === "restaurant" && (
        <>
          <Checks
            legend={c.dietary}
            tag={showSources && <Tag warn>{c.notOnSite}</Tag>}
            hint={c.dietaryHint}
            options={DIETARY}
            picked={picks.dietary}
            onChange={pick("dietary")}
          />
          <Checks legend={copy.occasion} options={OCCASIONS} picked={picks.occasion} onChange={pick("occasion")} />
          <Checks
            legend={c.landmarks}
            tag={<Tag>{c.places(b.city)}</Tag>}
            hint={c.landmarksHint}
            options={ofKind("landmark")}
            picked={picks.landmarks}
            onChange={pick("landmarks")}
            max={MAX_PLACES}
          />
          <Checks
            legend={copy.areas}
            options={ofKind("area")}
            picked={picks.areas}
            onChange={pick("areas")}
            max={MAX_PLACES}
          />
        </>
      )}
    </div>
  );
}

function Checks({
  legend,
  tag,
  hint,
  options,
  picked,
  onChange,
  max,
}: {
  legend: string;
  tag?: ReactNode;
  hint?: string;
  options: string[];
  picked: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  if (!options.length) return null;
  return (
    <fieldset>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <legend className="text-caption font-semibold">{legend}</legend>
        {tag}
      </div>
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
      {hint && <p className="mt-1.5 text-caption text-text2">{hint}</p>}
    </fieldset>
  );
}

// OC4: 44px chips, each with a 40×44 × named "Remove {item}"; the dashed chip adds one on Enter.
function Chips({
  label,
  add,
  tag,
  items,
  onChange,
}: {
  label: string;
  add: string;
  tag: ReactNode;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (v && !items.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div role="group" aria-labelledby={id}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p id={id} className="text-caption font-semibold">
          {label}
        </p>
        {tag}
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((s) => (
          <li
            key={s}
            className="inline-flex h-11 items-center rounded-control border border-fieldBorder bg-white pl-3 text-ui"
          >
            <span data-computed>{s}</span>
            <button
              type="button"
              aria-label={`${copy.remove} ${s}`}
              onClick={() => onChange(items.filter((x) => x !== s))}
              className="flex h-11 w-10 items-center justify-center text-inkMuted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
            >
              ×
            </button>
          </li>
        ))}
        <li>
          <input
            aria-label={add}
            placeholder={add}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            onBlur={commit}
            className="h-11 w-40 rounded-control border border-dashed border-fieldBorder bg-transparent px-3 text-ui text-ink placeholder:text-text2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
          />
        </li>
      </ul>
    </div>
  );
}
