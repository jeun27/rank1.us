"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render(el: HTMLElement, options: { sitekey: string }): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Explicit rendering (Cloudflare docs, SPAs). Inside a <form> the widget adds the hidden
// cf-turnstile-response input, so the form's FormData carries the token.
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile script"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

// Tokens are single-use, so the form bumps resetSignal after every submit.
export function Turnstile({ resetSignal }: { resetSignal: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!sitekey) return;
    let gone = false;
    loadScript()
      .then(() => {
        if (!gone && ref.current && window.turnstile)
          widget.current = window.turnstile.render(ref.current, { sitekey });
      })
      .catch(() => {
        // No widget means no token; the server rejects the submit and the form shows its error state.
      });
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [sitekey]);

  useEffect(() => {
    if (resetSignal && widget.current) window.turnstile?.reset(widget.current);
  }, [resetSignal]);

  if (!sitekey) return null;
  return <div ref={ref} data-turnstile className="min-h-16.25" />;
}
