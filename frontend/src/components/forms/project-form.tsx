"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, Input } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ProjectForm({
  action,
  defaults,
  submitLabel = "Create project",
}: {
  action: Action;
  defaults?: { name: string; slug: string };
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Project name" htmlFor="name" errors={state.fieldErrors?.name}>
        <Input id="name" name="name" required maxLength={80} defaultValue={defaults?.name} placeholder="My portfolio" />
      </Field>
      <Field
        label="Status page slug"
        htmlFor="slug"
        errors={state.fieldErrors?.slug}
        hint="Your public status page will be /status/<slug>. Leave empty to generate it from the name."
      >
        <Input id="slug" name="slug" maxLength={48} defaultValue={defaults?.slug} placeholder="my-portfolio" />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {state.message && <span className="text-sm text-green-600">{state.message}</span>}
      </div>
    </form>
  );
}
