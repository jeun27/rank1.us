"use client";
import { useState } from "react";
import { PillField } from "@/components/forms/PillField";
import { Banner } from "@/components/ui/Banner";
import type { InviteStatus } from "@/lib/queries/clients";

type Result = Promise<{ error: string } | undefined | void>;
export type ClientUserView = { user_id: string; email: string };
export type ClientsActions = {
  invite: (email: string) => Promise<{ status: InviteStatus }>;
  remove: (userId: string) => Result;
  setVisible: (visible: boolean) => Result;
};

// docs/COPY.md "Client invites (lead, 2026-11-05)".
const c = {
  clients: "Clients",
  invite: "Invite client",
  email: "Email",
  send: "Send invite",
  remove: "Remove access",
  showFixes: "Show fix list to client",
  emailError: "Add a valid email, like you@ramenhouse.com",
  sendFailed: "That didn't send. Try again in a minute.",
  saveFailed: "We couldn't save that. Try again.",
  status: {
    invited: (email: string) => `Invite sent to ${email}.`,
    existing_account: () => "This email already has a Rank1 account.",
    already_invited: () => "Already invited.",
  },
};

const ghost =
  "inline-flex min-h-11 items-center rounded-full border border-fieldBorder bg-white px-4 text-ui font-semibold hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

// The team's Clients tab for one DFY client: its client users, Invite client, Remove access and the
// fix-list toggle. Emails show here only (team UI); nothing logs them.
export function ClientsPanel({
  users,
  fixListVisible,
  actions,
}: {
  users: ClientUserView[];
  fixListVisible: boolean;
  actions: ClientsActions;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | null>(null);
  const [visible, setVisible] = useState(fixListVisible);
  const [busy, setBusy] = useState(false);
  const failed = (r: Awaited<Result>) => Boolean(r && "error" in r);

  return (
    <div className="flex flex-col gap-6">
      {banner && <Banner tone="error">{banner}</Banner>}

      <label className="flex min-h-11 items-center gap-3 text-ui">
        <input
          type="checkbox"
          checked={visible}
          onChange={async (e) => {
            const next = e.target.checked;
            setVisible(next);
            const r = await actions.setVisible(next).catch(() => ({ error: "failed" }));
            if (failed(r)) {
              setVisible(!next);
              setBanner(c.saveFailed);
            }
          }}
          className="size-5 accent-jellyDeep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
        />
        {c.showFixes}
      </label>

      <ul aria-label={c.clients} className="flex flex-col gap-2">
        {users.map((u) => (
          <li
            key={u.user_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border px-4 py-3"
          >
            <span data-computed className="min-w-0 break-all text-ui">
              {u.email}
            </span>
            <button
              type="button"
              className={ghost}
              onClick={async () => {
                const r = await actions.remove(u.user_id).catch(() => ({ error: "failed" }));
                if (failed(r)) setBanner(c.saveFailed);
              }}
            >
              {c.remove}
            </button>
          </li>
        ))}
      </ul>

      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setStatus("");
          setFieldError(undefined);
          setBanner(null);
          const sent = email.trim();
          const { status: s } = await actions.invite(sent).catch(() => ({ status: "error" as const }));
          setBusy(false);
          if (s === "invalid_email") return setFieldError(c.emailError);
          if (s === "error") return setBanner(c.sendFailed);
          setStatus(c.status[s](sent));
          if (s === "invited") setEmail("");
        }}
      >
        <h3 className="text-ui font-semibold">{c.invite}</h3>
        <PillField
          label={c.email}
          name="client-email"
          type="email"
          autoComplete="off"
          value={email}
          error={fieldError}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={ghost}>
            {c.send}
          </button>
          <p role="status" data-computed className="text-caption text-inkMuted">
            {status}
          </p>
        </div>
      </form>
    </div>
  );
}
