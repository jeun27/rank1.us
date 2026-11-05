import { Spinner } from "./Icon";
import { Jelly } from "./Jelly";
import { ProgressBar } from "./ProgressBar";

export function LoadingState({
  message,
  done,
  total,
  decorativeJelly,
}: {
  message: string;
  // Omit both when there is nothing to count (one lookup, not n answers).
  done?: number;
  total?: number;
  decorativeJelly?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-5 py-5 text-center md:py-3">
      <Jelly
        size={80}
        decorative={decorativeJelly}
        className="origin-bottom animate-squish motion-reduce:animate-none"
      />
      <p className="flex items-center gap-2.5 text-jellyDeep">
        <Spinner />
        <span className="text-ink">{message}</span>
      </p>
      {total !== undefined && <ProgressBar done={done ?? 0} total={total} />}
    </div>
  );
}
