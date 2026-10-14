"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/**
 * Slim brand-coloured bar across the top of the page while a navigation is in flight.
 * Starts when an internal link is clicked; completes when the new route renders.
 */
function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start on clicks that will trigger a client-side navigation to a different page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setVisible(true);
      setProgress(8);
      if (timer.current) clearInterval(timer.current);
      // Ease towards 90% until the route actually changes.
      timer.current = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p)), 200);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Finish when the new route is on screen.
  useEffect(() => {
    if (!timer.current) return;
    clearInterval(timer.current);
    timer.current = null;
    setProgress(100);
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(hide);
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 250ms ease" }}
    >
      <div
        className="h-full bg-gradient-to-r from-brand-400 via-brand-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]"
        style={{ width: `${progress}%`, transition: "width 200ms ease-out" }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense>
      <Bar />
    </Suspense>
  );
}
