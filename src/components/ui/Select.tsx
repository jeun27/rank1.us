import type { SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

// Founder fix (lead 17:09): every select is this one. The native arrow is hidden (appearance-none) and the
// ui/Icon chevron, 16px and muted, sits at right-3 inside a fixed pr-10, vertically centred, so it never
// touches the control's corner. The caller keeps its own size, radius, edge and focus classes; `wrap`
// sizes the wrapper (w-full, or nojs-only for a select that only shows without JavaScript).
export function Select({
  className,
  wrap = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { wrap?: string; ref?: React.Ref<HTMLSelectElement> }) {
  return (
    <span className={`relative inline-flex min-w-0 ${wrap}`}>
      <select {...rest} className={`w-full appearance-none pr-10 ${className ?? ""}`} />
      <Icon
        name="chevronDown"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-inkMuted"
      />
    </span>
  );
}
