import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, Spinner } from "./Icon";

export type Action = { label: string; href?: string; onClick?: () => void };

const base =
  "inline-flex items-center justify-center gap-2 font-sans text-ui font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep disabled:cursor-not-allowed";

const pill = "h-12 shrink-0 whitespace-nowrap px-5 rounded-full text-white shadow-button";

const variants = {
  // One per screen. Pill (Final set, Jeun 2026-11-05).
  primary: `${pill} bg-jellyDeep hover:bg-[color-mix(in_srgb,var(--color-jellyDeep),black_8%)]`,
  // Lighter blue while loading: white text 4.99:1.
  loading: `${pill} bg-jellyLoading disabled:cursor-wait`,
  // WCAG 1.4.3 exempts disabled controls, so the faded label is fine on a real <button disabled>.
  disabled: "h-12.5 px-6.5 gap-2.5 rounded-full border-[1.5px] border-ink/14 bg-white/55 text-inkMuted",
  secondary: "min-h-11 px-1.5 text-jellyDeep underline-offset-4 hover:underline",
  // Sits on the full-width ink band.
  final: "h-11 px-5 rounded-card bg-amber text-ink",
};

type Props = {
  variant?: "primary" | "secondary" | "final";
  href?: string;
  loading?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({ variant = "primary", href, loading = false, className, children, disabled, ...rest }: Props) {
  const look = variant === "primary" && loading ? "loading" : variant === "primary" && disabled ? "disabled" : variant;
  const cls = [base, variants[look], className].filter(Boolean).join(" ");
  const label =
    variant === "secondary" ? (
      <>
        {children}
        <Icon name="arrowRight" className="size-4" />
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
