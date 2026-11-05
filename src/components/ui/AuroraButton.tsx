import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Icon";

// The aurora ring: Google sign-in only, and the only gradient in the product.
export function AuroraButton({
  loading = false,
  children,
  disabled,
  className,
  ...rest
}: { loading?: boolean; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      {...rest}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={[
        "aurora-ring inline-flex h-12.5 items-center justify-center gap-2.5 rounded-full px-6.5 font-sans text-ui font-semibold text-jellyDeep shadow-aurora focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep disabled:cursor-wait",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
