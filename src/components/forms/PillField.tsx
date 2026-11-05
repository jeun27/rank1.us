import { useId, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

type Props = {
  label: string;
  name: string;
  error?: string;
  icon?: "globe";
  // Error text sits on the form's own background, so it can follow the text color (paper on the ink band).
  errorClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

// The Field + Button pill look (DomainField, Final set) as a plain labeled input.
export function PillField({ label, name, error, icon, errorClassName = "text-brick", className, ...rest }: Props) {
  const id = useId();
  const edge = error ? "border-2 border-brick" : "border border-fieldBorder";
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-caption font-semibold">
        {label}
      </label>
      <div
        className={`flex h-12 items-center gap-2.5 rounded-full bg-white px-5 shadow-field focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-jellyDeep ${edge}`}
      >
        {icon && <Icon name={icon} className="size-4.5 text-inkMuted" />}
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-full w-0 min-w-0 flex-1 bg-transparent text-ui text-ink outline-none placeholder:text-inkMuted"
          {...rest}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className={`mt-1.5 text-caption ${errorClassName}`}>
          {error}
        </p>
      )}
    </div>
  );
}
