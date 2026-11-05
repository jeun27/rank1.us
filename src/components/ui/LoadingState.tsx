import { Jelly } from "./Jelly";

export function LoadingState({ message, decorativeJelly }: { message: string; decorativeJelly?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-12 text-center">
      <Jelly size={80} decorative={decorativeJelly} className="origin-bottom animate-squish motion-reduce:animate-none" />
      <p className="tabular-nums">{message}</p>
    </div>
  );
}
