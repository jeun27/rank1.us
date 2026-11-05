import { Icon } from "./Icon";

export function formatAge(checkedAt: Date, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - checkedAt.getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

export function Freshness({ checkedAt, answers, now = new Date() }: { checkedAt: Date | string; answers: number; now?: Date }) {
  const n = `${answers.toLocaleString("en-US")} ${answers === 1 ? "answer" : "answers"}`;
  return (
    <p className="flex items-center gap-2 text-caption text-inkMuted tabular-nums">
      <Icon name="clock" className="size-4" />
      {`Checked ${formatAge(new Date(checkedAt), now)} ago · ${n} · API-measured, directional`}
    </p>
  );
}
