import { DomainField, type DomainFieldProps } from "./DomainField";
import { Jelly } from "./Jelly";

// Empty uses Field + Button, so the next step is typing the domain.
export function EmptyState({
  message,
  field,
  decorativeJelly,
}: {
  message: string;
  field: DomainFieldProps;
  decorativeJelly?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-5 text-center md:py-3">
      <Jelly size={80} decorative={decorativeJelly} />
      <p className="max-w-prose text-body-lg">{message}</p>
      <DomainField {...field} />
    </div>
  );
}
