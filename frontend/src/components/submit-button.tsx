"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./ui";

/** A submit button that shows a spinner and disables itself while its form's action runs. */
export function SubmitButton({
  children,
  pendingText,
  variant,
  confirm,
  ...props
}: ComponentProps<"button"> & {
  pendingText?: string;
  variant?: ButtonVariant;
  /** Ask "are you sure?" before submitting (for destructive actions). */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending || props.disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...props}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? (pendingText ?? "Saving…") : children}
    </Button>
  );
}
