"use client";

import { useEffect, useRef } from "react";

type TurnstileOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};
type TurnstileApi = {
  render(el: HTMLElement, options: TurnstileOptions): string;
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

// Tokens are single-use, so the form bumps resetSignal after every submit. onToken gets the token, or
// null when it expires (the widget is reset then) or errors; onUnavailable when the script can't load.
export function Turnstile({
  resetSignal,
  onToken,
  onUnavailable,
}: {
  resetSignal: number;
  onToken?: (token: string | null) => void;
  onUnavailable?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const handlers = useRef({ onToken, onUnavailable });
  useEffect(() => {
    handlers.current = { onToken, onUnavailable };
  });

  useEffect(() => {
    if (!sitekey) return;
    let gone = false;
    loadScript()
      .then(() => {
        if (!gone && ref.current && window.turnstile)
          widget.current = window.turnstile.render(ref.current, {
            sitekey,
            callback: (token) => handlers.current.onToken?.(token),
            "expired-callback": () => {
              handlers.current.onToken?.(null);
              if (widget.current) window.turnstile?.reset(widget.current);
            },
            "error-callback": () => handlers.current.onToken?.(null),
          });
      })
      .catch(() => {
        // No widget means no token; the server rejects the submit and the form shows its error state.
        if (!gone) handlers.current.onUnavailable?.();
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
