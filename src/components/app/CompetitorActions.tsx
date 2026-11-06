"use client";
import { useState } from "react";
import { PillField } from "@/components/forms/PillField";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import type { CompetitorInput } from "@/lib/queries/shell";
import { normalizeDomain } from "@/lib/spam/validate";
import { appCopy as c } from "./copy";

export type CompetitorActions = {
  add: (c: CompetitorInput) => Promise<unknown>;
  dismiss: (c: CompetitorInput) => Promise<unknown>;
};

// v3 alt control (D35): 6px, raised fill, a control-edge hairline; 44px below md, 32px from md.
const ghost =
  "inline-flex h-11 shrink-0 items-center rounded-control border border-fieldBorder bg-raised px-3 text-ui font-medium text-ink hover:bg-overlay md:h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

const input = (s: LocalCompetitor): CompetitorInput => ({
  name: s.name,
  domain: s.domain ?? null,
  maps_cid: s.cid,
  rating: s.rating ?? null,
});

// Maps suggestions with Add / Not a competitor. Shared by /app Competitors and the team workspace.
export function CompetitorSuggestions({
  suggestions,
  actions,
}: {
  suggestions: LocalCompetitor[];
  actions: CompetitorActions;
}) {
  const [done, setDone] = useState<string[]>([]);
  const act = async (fn: CompetitorActions["add"], s: LocalCompetitor) => {
    await fn(input(s));
    setDone((d) => [...d, s.cid]);
  };
  return (
    <ul className="flex flex-col gap-2">
      {suggestions
        .filter((s) => !done.includes(s.cid))
        .map((s) => (
          <li
            key={s.cid}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-3"
          >
            <span className="flex min-w-0 flex-col">
              <span data-computed className="text-ui font-semibold">
                {s.name}
              </span>
              <span data-computed className="text-caption text-inkMuted">
                {s.domain}
              </span>
            </span>
            <span className="flex gap-2">
              <button type="button" className={ghost} onClick={() => act(actions.add, s)}>
                {c.add}
              </button>
              <button type="button" className={ghost} onClick={() => act(actions.dismiss, s)}>
                {c.notCompetitor}
              </button>
            </span>
          </li>
        ))}
    </ul>
  );
}

// COPY.md "UX (lead, 2026-11-06)" X26 (WCAG 3.3.1).
const addNameFirst = "Add a name first.";

// Add a competitor by name (and optional domain).
export function AddCompetitorForm({ add }: { add: CompetitorActions["add"] }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [missing, setMissing] = useState(false);
  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-surface bg-white p-4 shadow-card md:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        // X26: Add stays enabled; an empty submit says why and puts the cursor where the name goes.
        if (!name.trim()) {
          setMissing(true);
          (e.currentTarget.elements.namedItem("competitor-name") as HTMLInputElement | null)?.focus();
          return;
        }
        await add({ name: name.trim(), domain: domain.trim() ? normalizeDomain(domain) : null });
        setName("");
        setDomain("");
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <PillField
          label="Name"
          name="competitor-name"
          value={name}
          error={missing ? addNameFirst : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setMissing(false);
          }}
        />
        <PillField
          label="Domain"
          name="competitor-domain"
          icon="globe"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
      </div>
      <div>
        {/* X26: "Add", so the form isn't a second "Add competitor" beside the disclosure that opens it. */}
        <button type="submit" className={ghost}>
          Add
        </button>
      </div>
    </form>
  );
}
