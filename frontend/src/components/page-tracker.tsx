"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Sends one anonymous page view per route change to /api/track (no cookies). */
export function PageTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname) return;
    // External referrer only matters for the first page of a visit.
    const referrer = first.current ? document.referrer : "";
    first.current = false;
    const body = JSON.stringify({ path: pathname, referrer });
    try {
      if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {
      // analytics must never break the page
    }
  }, [pathname]);

  return null;
}
