"use client";

import { useState, type FormEvent } from "react";
import { PillField } from "@/components/forms/PillField";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { authCopy as c } from "@/lib/auth/copy";
import { isEmail } from "@/lib/spam/validate";
import { createClient } from "@/lib/supabase/client";

type Notice = { tone: "error" | "info"; text: string } | null;

const callback = (next: string | null, via?: "email") => {
  const q = new URLSearchParams();
  if (next) q.set("next", next);
  if (via) q.set("via", via);
  const qs = q.toString();
  return `${location.origin}/auth/callback${qs ? `?${qs}` : ""}`;
};

// Auth serves raw JSON when a provider is off, so check first and show the banner instead.
// One check per page load; a failed fetch isn't kept, so "Try again" really retries.
let googleCheck: Promise<boolean> | undefined;
function googleEnabled() {
  googleCheck ??= fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`settings ${res.status}`);
      return (await res.json()).external?.google === true;
    })
    .catch(() => {
      googleCheck = undefined;
      return false;
    });
  return googleCheck;
}

export function SignInForm({ next, error }: { next: string | null; error?: "google" | "link" }) {
  const [notice, setNotice] = useState<Notice>(
    error ? { tone: "error", text: error === "google" ? c.googleError : c.linkExpired } : null,
  );
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<string>();

  async function google() {
    setOpening(true);
    setNotice(null);
    if (!(await googleEnabled())) {
      setOpening(false);
      setNotice({ tone: "error", text: c.googleError });
      return;
    }
    // On success the browser leaves for Google, so the loading label stays up.
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
    if (error) {
      setOpening(false);
      setNotice({ tone: "error", text: c.googleError });
    }
  }

  async function emailLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!isEmail(email)) return setEmailError(c.emailError);
    setEmailError(undefined);
    setSending(true);
    setNotice(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback(next, "email") },
    });
    setSending(false);
    setNotice(error ? { tone: "error", text: c.sendError } : { tone: "info", text: c.linkSent(email) });
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
      <Button onClick={google} loading={opening} className="w-full">
        {opening ? c.openingGoogle : c.google}
      </Button>
      <form noValidate onSubmit={emailLink} className="flex flex-col gap-3">
        <PillField label={c.emailLabel} name="email" type="email" autoComplete="email" error={emailError} />
        <Button type="submit" variant="secondary" disabled={sending} className="self-start">
          {c.sendLink}
        </Button>
      </form>
    </div>
  );
}
