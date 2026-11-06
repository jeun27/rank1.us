import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, Spinner } from "./Icon";

export type Action = { label: string; href?: string; onClick?: () => void };

const base =
  "inline-flex items-center justify-center gap-2 font-sans text-ui font-medium transition-transform duration-100 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep disabled:cursor-not-allowed";

// v3 (D35): 6px controls, 32px tall from md (40px for size lg) and 44px below md (lead O2), press =
// translateY(1px) (D24 feedback kept).
const control = "shrink-0 whitespace-nowrap px-3 rounded-control active:translate-y-px";
const heights = { md: "h-11 md:h-8", lg: "h-11 md:h-10 px-4" };

const variants = {
  // One per screen: the accent fill (Jelly blue in dark, jellyDeep in light) with onAccent text.
  primary: `${control} bg-accent text-onAccent hover:bg-jellyLoading`,
  loading: `${control} bg-jellyLoading text-onAccent disabled:cursor-wait`,
  // WCAG 1.4.3 exempts disabled controls, so the faded label is fine on a real <button disabled>.
  disabled: `${control} gap-2.5 border border-fieldBorder bg-transparent text-inkMuted active:translate-y-0`,
  // D35 .alt: the raised fill with a control-edge hairline.
  alt: `${control} border border-fieldBorder bg-raised text-ink hover:bg-overlay`,
  secondary: "group min-h-11 px-1.5 text-link underline underline-offset-4",
  // The final CTA uses the accent (D34: amber is no longer a button colour).
  final: `${control} bg-accent text-onAccent hover:bg-jellyLoading`,
};

type Props = {
  variant?: "primary" | "secondary" | "alt" | "final";
  size?: "md" | "lg";
  href?: string;
  loading?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({
  variant = "primary",
  size,
  href,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  const filled = variant === "primary" || variant === "final";
  const look = filled && loading ? "loading" : filled && disabled ? "disabled" : variant;
  const height = variant === "secondary" ? "" : heights[size ?? (variant === "final" ? "lg" : "md")];
  const cls = [base, variants[look], height, className].filter(Boolean).join(" ");
  const label =
    variant === "secondary" ? (
      <>
        {children}
        <Icon
          name="arrowRight"
          className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </>
    ) : look === "disabled" ? (
      <>
        <span className="opacity-75">{children}</span>
        <Icon name="lock" className="size-3.5 opacity-60" />
      </>
    ) : (
      children
    );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" {...rest} className={cls} disabled={loading || disabled} aria-busy={loading || undefined}>
      {loading && <Spinner />}
      {label}
    </button>
  );
}

export function ActionButton({ action, variant }: { action: Action; variant?: Props["variant"] }) {
  return (
    <Button variant={variant} href={action.href} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
