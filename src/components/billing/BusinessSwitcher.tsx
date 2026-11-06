"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatPercent } from "@/components/ui/StatNumber";
import type { Metric } from "@/types/metrics";
import { billingCopy as c } from "./copy";
import { Dialog } from "./Dialog";
import { Icon } from "@/components/ui/Icon";

export type SwitcherBusiness = {
  id: string;
  name: string;
  city: string | null;
  // The latest complete/partial run's visibility, or null before a run.
  visibility: Metric | null;
  active: boolean;
};
type Result = Promise<{ error: string } | undefined | void>;
export type SwitcherActions = {
  select: (id: string) => Result;
  // Quantity +1 (paid) or Checkout (unpaid: the action redirects).
  add: () => Result;
  remove: (id: string) => Result;
  // The workspace's seats_quantity now; it rises once the webhook lands.
  seats: () => Promise<number>;
};

const POLL_MS = 2000;
const POLL_MAX_MS = 30_000;
const SEARCH_OVER = 8;
const row =
  "flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";

// UI.md 4b "Business switcher": in the app header, left of the account menu. Hidden (name only) with one
// business. A popover on wide screens, a bottom sheet on phones.
export function BusinessSwitcher({
  businesses,
  currentId,
  seats,
  periodEnd,
  actions,
}: {
  businesses: SwitcherBusiness[];
  currentId: string;
  seats: number;
  periodEnd: string | null;
  actions: SwitcherActions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "remove"; b: SwitcherBusiness } | null>(null);
  const [adding, setAdding] = useState<"polling" | "waiting" | null>(null);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const current = businesses.find((b) => b.id === currentId) ?? businesses[0];
  if (businesses.length < 2)
    return (
      <span data-crumb-name data-crumb-static className="min-w-0 truncate text-ui font-semibold">
        {current?.name}
      </span>
    );

  const close = () => {
    setOpen(false);
    setMenu(null);
    trigger.current?.focus();
  };
  // Waits for the webhook to raise seats_quantity, then onboarding for the new business. No error at the
  // time limit: the change may still land, so it keeps the note and offers a manual retry.
  const poll = (started: number) => {
    setAdding("polling");
    timer.current = setTimeout(async () => {
      const now = await actions.seats().catch(() => seats);
      if (now > seats) return router.push("/app/onboarding");
      if (Date.now() - started >= POLL_MAX_MS) return setAdding("waiting");
      poll(started);
    }, POLL_MS);
  };
  const shown = businesses.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div
      // A shrinking column, so the trigger narrows with the breadcrumb and its name ends in an ellipsis (C5).
      className="relative flex min-w-0 flex-col"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open && !dialog) close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 max-w-56 min-w-0 items-center gap-1 rounded-control px-2 text-ui font-medium hover:bg-raised md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
      >
        <span data-crumb-name className="min-w-0 truncate">
          {current.name}
        </span>
        {/* #186 follow-up: the same chevron as the selects; aria-hidden keeps it out of the name. */}
        <Icon name="chevronDown" className="size-4 text-inkMuted" />
      </button>
      {adding && (
        <p role="status" className="mt-1 flex items-center gap-2 text-caption text-inkMuted">
          {c.adding}
          {adding === "waiting" && (
            <button
              type="button"
              onClick={() => poll(Date.now())}
              className="min-h-11 px-1 text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
            >
              {c.retry}
            </button>
          )}
        </p>
      )}
      {failed && (
        <p role="alert" className="mt-1 text-caption text-brick">
          {c.saveFailed}
        </p>
      )}
      {open && (
        <div
          data-testid="switcher-panel"
          className="z-20 flex flex-col gap-2 border border-border bg-overlay p-2 shadow-overlay max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-surface md:absolute md:left-0 md:mt-1 md:w-80 md:rounded-surface"
        >
          {businesses.length > SEARCH_OVER && (
            <label className="flex flex-col gap-1 px-2 pt-1 text-caption font-semibold">
              {c.search}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 rounded-control border border-fieldBorder bg-white px-4 text-ui font-normal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
              />
            </label>
          )}
          <ul aria-label={c.switcher} className="max-h-[360px] overflow-y-auto">
            {shown.map((b) => (
              <li key={b.id} className="relative flex items-center">
                <button
                  type="button"
                  aria-current={b.id === current.id ? "true" : undefined}
                  onClick={async () => {
                    close();
                    await actions.select(b.id);
                  }}
                  className={`${row} rounded-card ${b.id === current.id ? "bg-raised" : ""}`}
                >
                  <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${b.active ? "bg-moss" : "bg-brick"}`} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span data-computed className="truncate text-ui font-semibold">
                      {b.name}
                    </span>
                    <span className="flex flex-wrap gap-x-2 text-caption text-inkMuted">
                      {b.city && <span data-computed>{b.city}</span>}
                      <span data-computed className="tabular-nums">
                        {b.visibility?.denominator
                          ? `${formatPercent(b.visibility)} · ${b.visibility.denominator} answers`
                          : "–"}
                      </span>
                    </span>
                  </span>
                  <span className="sr-only">{b.active ? c.active : c.paused}</span>
                </button>
                <button
                  type="button"
                  aria-label={c.more(b.name)}
                  aria-haspopup="menu"
                  aria-expanded={menu === b.id}
                  onClick={() => setMenu((m) => (m === b.id ? null : b.id))}
                  className="grid size-11 shrink-0 place-items-center rounded-card text-inkMuted hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
                >
                  <span aria-hidden>⋯</span>
                </button>
                {menu === b.id && (
                  <div role="menu" className="absolute top-12 right-0 z-10 rounded-card bg-white p-1 shadow-card">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(null);
                        setDialog({ kind: "remove", b });
                      }}
                      className={`${row} min-h-11 rounded-card text-ui text-brick`}
                    >
                      {c.remove}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDialog({ kind: "add" })}
            className={`${row} rounded-card text-ui font-semibold text-link`}
          >
            {c.addRow}
          </button>
          <p className="px-3 pb-1 text-caption text-inkMuted">
            {c.agency}{" "}
            <Link
              href="/contact"
              className="text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
            >
              {c.contact}
            </Link>
          </p>
        </div>
      )}
      {dialog?.kind === "add" && (
        <Dialog
          message={c.addDialog(seats)}
          confirm={c.addConfirm}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null);
            setOpen(false);
            setFailed(false);
            const r = await actions.add().catch(() => ({ error: "failed" }));
            if (r && "error" in r) return setFailed(true);
            poll(Date.now());
          }}
        />
      )}
      {dialog?.kind === "remove" && (
        <Dialog
          message={c.removeDialog(dialog.b.name, periodEnd, seats)}
          confirm={c.remove}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const id = dialog.b.id;
            setDialog(null);
            const r = await actions.remove(id).catch(() => ({ error: "failed" }));
            if (r && "error" in r) setFailed(true);
          }}
        />
      )}
    </div>
  );
}
