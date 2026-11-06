"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { narrativeCopy } from "@/components/narrative/copy";
import { Icon } from "@/components/ui/Icon";
import type { TeamExtras } from "./team";

const focus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";
const row = "flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left text-ui md:min-h-8";

// v3 D20: the /team client switcher in the breadcrumb. One GET form serves both paths. Without JS its
// select and Show submit it; with JS (html.js, set by the head script before paint) a listbox of clients
// drives the same form. CSS shows one of the two, so nothing swaps after load.
export function ClientSwitcher({
  team,
  onClients,
  onConnections,
  onNarrative,
}: {
  team: Pick<TeamExtras, "businesses" | "businessId" | "formAction" | "hidden">;
  onClients?: () => void;
  // C-c: the Connections document (ENABLE_CONNECTIONS).
  onConnections?: () => void;
  // C-c D3: "How AI describes {Business}" (ENABLE_NARRATIVE).
  onNarrative?: () => void;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { businesses } = team;
  const at = Math.max(
    0,
    businesses.findIndex((b) => b.id === team.businessId),
  );
  const current = businesses[at];
  const option = (i: number) => `${id}-option-${i}`;

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const pick = (i: number) => {
    close();
    if (businesses[i].id === team.businessId) return;
    select.current!.value = businesses[i].id;
    form.current!.submit();
  };
  const onKey = (e: KeyboardEvent) => {
    const last = businesses.length - 1;
    const to = { ArrowDown: Math.min(active + 1, last), ArrowUp: Math.max(active - 1, 0), Home: 0, End: last }[e.key];
    if (to !== undefined) setActive(to);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape") close();
    else return;
    // Escape also collapses an expanded document (Workspace's window listener); stop it here.
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <form
      ref={form}
      method="get"
      action={team.formAction}
      className="relative flex min-w-0 items-center gap-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {Object.entries(team.hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor={`${id}-select`} className="nojs-only text-caption font-semibold">
        Client
      </label>
      <select
        ref={select}
        id={`${id}-select`}
        name="b"
        defaultValue={team.businessId}
        className={`nojs-only h-11 min-w-0 rounded-control border border-fieldBorder bg-white px-2 text-ui md:h-8 ${focus}`}
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className={`nojs-only inline-flex h-11 items-center rounded-control border border-fieldBorder bg-raised px-3 text-ui font-medium hover:bg-overlay md:h-8 ${focus}`}
      >
        Show
      </button>

      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setActive(at);
          setOpen((o) => !o);
        }}
        className={`js-only inline-flex min-h-11 min-w-0 max-w-56 items-center gap-1.5 rounded-control px-2 font-medium text-ink hover:bg-raised md:min-h-8 ${focus}`}
      >
        <span className="sr-only">Client</span>{" "}
        <span
          aria-hidden
          data-computed
          className="grid size-5 shrink-0 place-items-center rounded-[4px] bg-overlay text-caption font-semibold text-ink"
        >
          {current.name[0]}
        </span>
        <span data-computed className="truncate">
          {current.name}
        </span>
        <Icon name="chevronDown" className="size-3.5 text-inkMuted" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-card border border-border bg-overlay p-1 shadow-overlay">
          <ul
            ref={list}
            role="listbox"
            aria-label="Client"
            tabIndex={-1}
            aria-activedescendant={option(active)}
            onKeyDown={onKey}
            className="max-h-[360px] overflow-y-auto rounded-control focus-visible:outline-2 focus-visible:outline-jellyDeep"
          >
            {businesses.map((b, i) => (
              <li
                key={b.id}
                id={option(i)}
                role="option"
                aria-selected={b.id === team.businessId}
                onClick={() => pick(i)}
                onMouseMove={() => setActive(i)}
                className={`${row} cursor-pointer ${i === active ? "bg-raised" : ""} ${b.id === team.businessId ? "font-medium text-ink" : "text-text2"}`}
              >
                <span data-computed className="truncate">
                  {b.name}
                </span>
              </li>
            ))}
          </ul>
          {onClients && (
            <button
              type="button"
              onClick={() => {
                close(false);
                onClients();
              }}
              className={`${row} mt-1 border-t border-border text-text2 hover:bg-raised hover:text-ink ${focus}`}
            >
              <Icon name="users" className="size-4" />
              Clients
            </button>
          )}
          {onConnections && (
            <button
              type="button"
              onClick={() => {
                close(false);
                onConnections();
              }}
              className={`${row} text-text2 hover:bg-raised hover:text-ink ${focus}`}
            >
              <Icon name="link" className="size-4" />
              Connections
            </button>
          )}
          {onNarrative && (
            <button
              type="button"
              onClick={() => {
                close(false);
                onNarrative();
              }}
              className={`${row} text-text2 hover:bg-raised hover:text-ink ${focus}`}
            >
              <Icon name="file" className="size-4" />
              <span data-computed className="truncate">
                {narrativeCopy.teamTitle(current.name)}
              </span>
            </button>
          )}
        </div>
      )}
    </form>
  );
}
