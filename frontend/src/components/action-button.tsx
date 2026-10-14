"use client";

import { Loader2 } from "lucide-react";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { FormState } from "@/lib/form-state";
import { Button, type ButtonVariant } from "./ui";

/**
 * Runs a (pre-bound) server action on click and shows the result as a toast.
 * Server actions that redirect simply navigate; everything else reports success or error.
 */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  confirm,
  className,
  title,
}: {
  action: () => Promise<FormState | void>;
  children: ReactNode;
  variant?: ButtonVariant;
  confirm?: string;
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      title={title}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
          else if (result?.message) toast.success(result.message);
        });
      }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
