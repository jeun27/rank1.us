"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { formCopy as c } from "@/components/forms/copy";
import { ContactForm } from "./ContactForm";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

// <ContactUsLink>Contact us</ContactUsLink>: opens the Contact us modal. Without JS it is a plain link to /contact.
export function ContactUsLink({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab keeps working
    e.preventDefault();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    link.current?.focus();
  }

  return (
    <>
      <a
        ref={link}
        href="/contact"
        onClick={onClick}
        aria-haspopup="dialog"
        className={
          className ??
          "inline-flex min-h-11 items-center text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
        }
      >
        {children}
      </a>
      {open && <ContactDialog onClose={close} />}
    </>
  );
}

// Modal <dialog>: the page behind is inert, Esc closes, Tab cycles inside. Full screen below md.
function ContactDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.showModal();
    return () => d.close();
  }, []);

  // Close the modal first: while it is open the page (and the link) is inert and cannot take focus.
  function close() {
    ref.current?.close();
    onClose();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={onKeyDown}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-paper p-5 text-ink backdrop:bg-ink/60 md:m-auto md:h-auto md:max-h-[90dvh] md:max-w-lg md:rounded-surface md:p-8 md:shadow-card"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 id={titleId} className="font-display text-h2 font-semibold">
          {c.contactTitle}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={c.close}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-h3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-4"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>
      <ContactForm />
    </dialog>
  );
}
