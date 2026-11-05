"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

// Below md: shows once the hero has left the viewport, hides while #pricing or #audit is on screen,
// so only one primary button is visible at a time.
export function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const visible: Record<string, boolean> = { hero: true, pricing: false, audit: false };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible[e.target.id] = e.isIntersecting;
      setShow(!visible.hero && !visible.pricing && !visible.audit);
    });
    for (const id of Object.keys(visible)) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <div data-sticky-cta hidden={!show} className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-paper px-5 py-3 md:hidden">
      <Button href="#audit" className="w-full">
        Get my free audit
      </Button>
    </div>
  );
}
