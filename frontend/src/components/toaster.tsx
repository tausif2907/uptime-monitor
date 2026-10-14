"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";

/** Messages for `?toast=<key>` after a redirecting server action. */
const FLASH: Record<string, string> = {
  "project-created": "Project created — now add your first monitor.",
  "project-deleted": "Project deleted.",
  "monitor-created": "Monitor created — the first check runs within a minute.",
  "monitor-saved": "Monitor saved.",
  "monitor-deleted": "Monitor deleted.",
  welcome: "Welcome! Let's set up your first monitor.",
};

function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.get("toast");

  useEffect(() => {
    if (!key) return;
    const message = FLASH[key];
    if (message) toast.success(message);
    // Remove the param so a refresh doesn't show it again.
    const next = new URLSearchParams(params);
    next.delete("toast");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [key, params, pathname, router]);

  return null;
}

export function Toaster() {
  return (
    <>
      <Sonner richColors closeButton position="bottom-right" toastOptions={{ duration: 4000 }} />
      <Suspense>
        <FlashToast />
      </Suspense>
    </>
  );
}
