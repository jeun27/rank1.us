"use client";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { billingCopy as c } from "./copy";

// A modal: focus moves in (to Cancel), Tab stays inside, Esc closes, and focus returns to the opener.
export function Dialog({
  message,
  confirm,
  onConfirm,
  onClose,
}: {
  message: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const label = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => opener?.focus();
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      return onClose();
    }
    if (e.key !== "Tab" || !ref.current) return;
    const f = [...ref.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
    if (!f.length) return;
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 md:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={label}
        onKeyDown={onKey}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-5 rounded-t-surface bg-paper p-5 shadow-card md:rounded-surface md:p-6"
      >
        <p id={label} data-computed className="text-body-lg">
          {message}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full border border-fieldBorder bg-white px-5 text-ui font-semibold hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
          >
            {c.cancel}
          </button>
          <Button onClick={onConfirm}>{confirm}</Button>
        </div>
      </div>
    </div>
  );
}
