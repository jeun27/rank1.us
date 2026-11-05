"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// WAI-ARIA tabs with automatic activation: Left/Right wrap, Home/End jump.
export function ScreenshotTabs({ tabs }: { tabs: { label: string; panel: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: active === last ? 0 : active + 1, ArrowLeft: active === 0 ? last : active - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="rounded-surface border border-ink bg-white">
      <div role="tablist" aria-label="Example screens" onKeyDown={onKeyDown} className="flex flex-wrap border-b border-ink">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`shot-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`shot-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`min-h-11 px-3 text-ui md:px-4 font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep ${
              i === active ? "text-jellyDeep underline decoration-2 underline-offset-8" : "text-inkMuted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.label}
          role="tabpanel"
          id={`shot-panel-${i}`}
          aria-labelledby={`shot-tab-${i}`}
          tabIndex={0}
          hidden={i !== active}
          className="p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep md:p-6"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
