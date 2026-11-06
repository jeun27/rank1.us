import type { Email } from "@/lib/email/resend";
import { readinessSet, type Industry } from "./recommend";

// G3 "Ready for GAS": after every connection change, recompute businesses.gas_ready_at (backend's
// refresh_gas_ready) and email the team once when a business has just become ready. The destination is
// TEAM_NOTIFY_EMAIL (founder TBD): unset = no email. Strings are the lead's GAS copy.
export type ReadinessDeps = {
  business: (businessId: string) => Promise<{ name: string; vertical: string } | null>;
  refresh: (businessId: string, recommended: string[]) => Promise<{ ready: boolean; newlyReady: boolean }>;
  send: (email: Email, idempotencyKey: string) => Promise<boolean>;
  env?: Record<string, string | undefined>;
  log?: (line: string) => void;
};

const LABEL: Record<string, string> = { gbp: "Business Profile", search_console: "Search Console", ga4: "Analytics" };
const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

// Never throws (a readiness hiccup must not undo a connect or revoke). Logs carry the PG code only.
export async function refreshReadiness(businessId: string, deps: ReadinessDeps, now = new Date()) {
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((l: string) => console.error(l));
  const none = { ready: false, newlyReady: false, emailed: false };
  try {
    const b = await deps.business(businessId);
    if (!b) return none;
    const set = readinessSet(b.vertical as Industry);
    const r = await deps.refresh(businessId, set);
    const to = env.TEAM_NOTIFY_EMAIL;
    const from = env.CONTACT_FROM_EMAIL;
    if (!r.newlyReady || !to || !from) return { ...r, emailed: false };
    const site = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
    const emailed = await deps.send(
      {
        from,
        to,
        reply_to: to,
        subject: `${b.name} is ready for GAS`,
        text: `${and(set.map((c) => LABEL[c] ?? c))} connected.\n\nStart on the fix list: ${site}/team`,
      },
      `gas-ready-${businessId}-${now.toISOString().slice(0, 10)}`,
    );
    return { ...r, emailed };
  } catch (e) {
    log(`connections: gas readiness failed (${codeOf(e)})`);
    return none;
  }
}
