import { Suspense } from "react";
import { AppHeader } from "@/components/auth/AppHeader";
import { AreaGate } from "@/components/auth/AreaGate";

// Self-serve owners and members only.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense>
      <AreaGate area="/app">
        <AppHeader />
        {children}
      </AreaGate>
    </Suspense>
  );
}
