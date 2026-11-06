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

// X10: the next send's date ("2026-12-01"). The 1st before 08:00 LA is still today's send; after that it's
// next month's.
export function nextReportDate(now: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, Number(x.value)]),
  );
  const thisMonth = p.day === 1 && p.hour <= HOUR;
  const [y, m] = thisMonth ? [p.year, p.month] : p.month === 12 ? [p.year + 1, 1] : [p.year, p.month + 1];
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

// "2026-12-01" → "Dec 1" (UTC, like monthLabel).
export const shortDate = (day: string) =>
  new Date(`${day.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
