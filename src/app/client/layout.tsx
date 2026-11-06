import { Suspense } from "react";
import { AppHeader } from "@/components/auth/AppHeader";
import { AreaGate } from "@/components/auth/AreaGate";

// Done-for-you clients only.
export default function ClientLayout({ children }: LayoutProps<"/client">) {
  return (
    <Suspense>
      <AreaGate area="/client">
        <AppHeader connections={process.env.ENABLE_CONNECTIONS === "true"} />
        {children}
      </AreaGate>
    </Suspense>
  );
}
