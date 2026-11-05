// Monthly report: the 1st of the month at 07:xx America/Los_Angeles. Vercel Cron is UTC, so the route is
// scheduled at 14:00 and 15:00 UTC on the 1st (PDT and PST) and only the 07:xx LA fire proceeds.
export const MONTHLY_SCHEDULE = "0 14,15 1 * *";
const TZ = "America/Los_Angeles";
const HOUR = 7;

export function isMonthlyWindow(now: Date): boolean {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return Number(parts.day) === 1 && Number(parts.hour) === HOUR;
}

// "2026-10-01" → "October 2026" (UTC, so the label never shifts by a day).
export const monthLabel = (periodStart: string) =>
  new Date(`${periodStart.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
