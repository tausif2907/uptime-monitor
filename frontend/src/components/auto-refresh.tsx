"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetch the server components on an interval so statuses stay live without a reload. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
