import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Action = { label: string; href?: string; onClick?: () => void };

const base =
  "inline-flex items-center justify-center gap-2 font-sans text-ui font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep disabled:cursor-not-allowed";

const variants = {
  // One per screen.
  primary: "h-11 px-5 rounded-card bg-jellyDeep text-white hover:bg-[color-mix(in_srgb,var(--color-jellyDeep),black_8%)]",
  secondary: "min-h-11 text-jellyDeep underline-offset-4 hover:underline",
  // Sits on the full-width ink band.
  final: "h-11 px-5 rounded-card bg-amber text-ink",
};

type Props = {
  variant?: keyof typeof variants;
  href?: string;
  loading?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({ variant = "primary", href, loading = false, className, children, disabled, ...rest }: Props) {
  const cls = [base, variants[variant], className].filter(Boolean).join(" ");
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...rest} className={cls} disabled={loading || disabled} aria-busy={loading || undefined}>
      {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
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
