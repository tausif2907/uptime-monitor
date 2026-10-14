"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./ui";

/** A submit button that disables itself while its form's server action runs. */
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
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...props}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </Button>
  );
}
