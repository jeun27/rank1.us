import { Button } from "./Button";
import { DomainField, type DomainFieldProps } from "./DomainField";
import { Jelly } from "./Jelly";

export type FirstCheck = "running" | "monday";

// An empty screen points to one next step (X25): a domain field, or one action, or nothing when the
// only next step is waiting (a first check is already running).
export function EmptyState({
  message,
  field,
  action,
  decorativeJelly,
}: {
  message: string;
  field?: DomainFieldProps;
  action?: { label: string; href: string; primary?: boolean };
  decorativeJelly?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-5 text-center md:py-3">
      <Jelly size={56} decorative={decorativeJelly} />
      <p className="max-w-prose text-body-lg">{message}</p>
      {field && <DomainField {...field} />}
      {action && (
        <Button variant={action.primary ? "primary" : "secondary"} href={action.href}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
