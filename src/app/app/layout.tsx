import { Suspense } from "react";
import { AppHeader } from "@/components/auth/AppHeader";
import { AreaGate } from "@/components/auth/AreaGate";
import { AppNav } from "@/components/app/AppNav";

// Self-serve owners and members only.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense>
      <AreaGate area="/app">
        <AppHeader />
        <div className="mx-auto flex max-w-page flex-col md:flex-row">
          <AppNav />
          {children}
        </div>
      </AreaGate>
    </Suspense>
  );
}
