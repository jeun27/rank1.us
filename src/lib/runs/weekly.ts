// The weekly check runs Monday 06:00 America/Los_Angeles (handoff §6). Vercel Cron is UTC, so the route is
// scheduled at 13:00 and 14:00 UTC on Mondays and only the fire that lands at 06:xx LA time proceeds.
export const WEEKLY_TZ = "America/Los_Angeles";
export const WEEKLY_SCHEDULE = "0 13,14 * * 1";
const WEEKLY_HOUR = 6;

function laParts(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: WEEKLY_TZ,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { weekday: parts.weekday, hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
}

// True only on a Monday between 06:00 and 06:59 in Los Angeles (Intl handles PDT/PST).
export function isWeeklyWindow(now: Date): boolean {
  const p = laParts(now);
  return p.weekday === "Mon" && p.hour === WEEKLY_HOUR;
}

// The LA date of the Monday that starts now's ISO week ("YYYY-MM-DD"): the per-week idempotency key.
export function laWeekStart(now: Date): string {
  const { date } = laParts(now);
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export type EnqueueResult = { enqueued: number; skipped: number; failed?: number };
export type PruneResult = { lookup_cache: number; rate_events: number };

export type WeeklyDeps = {
  enqueue: (weekStart: string) => Promise<EnqueueResult>;
  prune: () => Promise<PruneResult>;
  now?: () => Date;
  log?: (line: string) => void;
};

export type WeeklyOutcome =
  | { status: 200; body: { skipped: "outside_window" } }
  | { status: 200; body: { week_start: string } & EnqueueResult & { pruned: PruneResult } }
  | { status: 500; body: { error: "enqueue_failed" | "prune_failed" } };

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String(e.code) : "error");

// Enqueue only (the run-jobs cron drains), then prune; prune runs even when enqueue failed. Logs carry
// counts and PG error codes only, never business data or DB error text.
export async function runWeekly(deps: WeeklyDeps): Promise<WeeklyOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? ((l: string) => console.error(l));
  if (!isWeeklyWindow(now)) return { status: 200, body: { skipped: "outside_window" } };
  const weekStart = laWeekStart(now);
  const enq = await deps.enqueue(weekStart).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason }),
  );
  const pr = await Promise.resolve()
    .then(() => deps.prune())
    .then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    );
  const e = enq.status === "fulfilled" ? enq.value : null;
  const p = pr.status === "fulfilled" ? pr.value : null;
  log(
    `weekly ${weekStart}: ` +
      (e
        ? `enqueued=${e.enqueued} skipped=${e.skipped} failed=${e.failed ?? 0}`
        : `enqueue_error=${codeOf((enq as { reason: unknown }).reason)}`) +
      " " +
      (p
        ? `pruned lookup_cache=${p.lookup_cache} rate_events=${p.rate_events}`
        : `prune_error=${codeOf((pr as { reason: unknown }).reason)}`),
  );
  if (!e) return { status: 500, body: { error: "enqueue_failed" } };
  if (!p) return { status: 500, body: { error: "prune_failed" } };
  return { status: 200, body: { week_start: weekStart, ...e, pruned: p } };
}
