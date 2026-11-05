import { useId } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

export type DomainFieldProps = {
  label: string; // screen-reader label of the input
  placeholder: string;
  buttonLabel: string;
  loadingLabel?: string;
  state?: "default" | "loading" | "error";
  errorText?: string;
  defaultValue?: string;
  name?: string;
  // Shows the focus edge without real focus, for the /dev/ui gallery only.
  focused?: boolean;
};

// 2px jellyDeep edge drawn inside the border, so focus does not shift the layout.
const focusEdge = "outline-2 -outline-offset-2 outline-jellyDeep";
const focusWithinEdge = "focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-jellyDeep";

// Field + Button: pill field with a globe icon and the primary button inside it. When the field is
// narrower than 21rem (phones, small cards) the button drops below the input so the domain stays readable.
export function DomainField({
  label,
  placeholder,
  buttonLabel,
  loadingLabel,
  state = "default",
  errorText,
  defaultValue,
  name = "domain",
  focused = false,
}: DomainFieldProps) {
  const id = useId();
  const error = state === "error" && Boolean(errorText);
  const loading = state === "loading";
  const edge = error ? "border-2 border-brick" : "border border-fieldBorder";
  return (
    <form noValidate className="@container w-full max-w-110">
      <div
        data-field
        className={`flex flex-col gap-1.5 rounded-banner bg-white p-1.5 shadow-field @min-[21rem]:h-15 @min-[21rem]:flex-row @min-[21rem]:items-center @min-[21rem]:gap-2.5 @min-[21rem]:rounded-full @min-[21rem]:pl-5 ${edge} ${focused ? focusEdge : focusWithinEdge}`}
      >
        <div className="flex h-12 items-center gap-2.5 px-3.5 @min-[21rem]:contents">
          <Icon name="globe" className="size-4.5 text-inkMuted" />
          <label htmlFor={id} className="sr-only">
            {label}
          </label>
          <input
            id={id}
            name={name}
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder={placeholder}
            defaultValue={defaultValue}
            aria-invalid={error || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-full w-0 min-w-0 flex-1 bg-transparent text-ui text-ink outline-none placeholder:text-inkMuted"
          />
        </div>
        <Button type="submit" loading={loading} className="w-full @min-[21rem]:w-auto">
          {loading && loadingLabel ? loadingLabel : buttonLabel}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-caption text-brick">
          {errorText}
        </p>
      )}
    </form>
  );
}
