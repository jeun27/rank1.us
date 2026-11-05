import { ActionButton, type Action } from "./Button";
import { Jelly } from "./Jelly";

export function EmptyState({ message, action, decorativeJelly }: { message: string; action: Action; decorativeJelly?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Jelly size={80} decorative={decorativeJelly} />
      <p className="max-w-prose text-body-lg">{message}</p>
      <ActionButton action={action} />
    </div>
  );
}
