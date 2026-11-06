"use client";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { OAuthConnector } from "@/lib/connections/oauth";
import { connectionsCopy as c } from "./copy";

// Shared by the hub (C-a) and the connect card (C-b).
export const startUrl = (businessId: string, connector: string, returnTo: string) =>
  `/api/connections/google/start?business=${encodeURIComponent(businessId)}&connector=${connector}&return=${encodeURIComponent(returnTo)}`;

// The consent sheet: a modal with the exact scope text, then Continue to Google. Esc closes; focus stays
// inside and returns to the opener.
export function Consent({
  connector,
  href,
  onClose,
}: {
  connector: OAuthConnector;
  href: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const title = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => opener?.focus();
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      return onClose();
    }
    if (e.key !== "Tab" || !ref.current) return;
    const f = [...ref.current.querySelectorAll<HTMLElement>("a, button")];
    const [first, last] = [f[0], f[f.length - 1]];
    const to = e.shiftKey
      ? document.activeElement === first
        ? last
        : null
      : document.activeElement === last
        ? first
        : null;
    if (to) {
      e.preventDefault();
      to.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[rgb(0_0_0/0.6)] p-4" onKeyDown={onKey}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        className="flex w-full max-w-lg flex-col gap-4 rounded-card border border-border bg-overlay p-5 shadow-overlay"
      >
        <h2 id={title} className="text-ui font-semibold">
          {c.names[connector]}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-ui text-text2">
          {c.consent[connector].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button href={href}>{c.continue}</Button>
          <Button variant="alt" onClick={onClose}>
            {c.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
