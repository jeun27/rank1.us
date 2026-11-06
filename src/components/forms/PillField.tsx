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

// A labeled input in the v3 field look (UI.md: radius 6, page fill, 1px edge, no shadow): 44px tall below md,
// 36px from md. The 16px-below-md text (R2) is globals.css's field rule. Focus keeps the info-blue ring.
export function PillField({ label, name, error, icon, errorClassName = "text-brick", className, ...rest }: Props) {
  const id = useId();
  // An inset ring, not a border, so the input itself is the full 44px target.
  const edge = error ? "ring-2 ring-inset ring-brick" : "ring-1 ring-inset ring-fieldBorder";
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-caption font-semibold">
        {label}
      </label>
      <div
        className={`flex h-11 items-center gap-2.5 rounded-control bg-paper px-3 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-jellyDeep md:h-9 ${edge}`}
      >
        {icon && <Icon name={icon} className="size-4 text-inkMuted" />}
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
