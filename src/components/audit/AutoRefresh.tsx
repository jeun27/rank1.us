"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While a run is queued or running, re-render the server page every 5 s (UI.md: progress updates).
export function AutoRefresh({ active, ms = 5000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return null;
}
