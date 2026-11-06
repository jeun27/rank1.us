import { Suspense } from "react";
import { AreaGate } from "@/components/auth/AreaGate";
import { AppShell } from "@/components/app/AppShell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { HeaderSwitcher } from "./HeaderSwitcher";

// Self-serve owners and members only. v3 shell: the dark rail + the breadcrumb top bar, whose business
// crumb is the Business switcher (D42; the name only with one business).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense>
      <AreaGate area="/app">
        <AppShell
          business={
            <Suspense>
              <HeaderSwitcher />
            </Suspense>
          }
          actions={<ThemeToggle />}
          settings={process.env.ENABLE_CONNECTIONS === "true"}
        >
          <div className="mx-auto flex w-full max-w-page">{children}</div>
        </AppShell>
      </AreaGate>
    </Suspense>
  );
}
