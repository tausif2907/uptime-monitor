"use client";

import { slugify } from "@uptime/shared";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
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
  const [name, setName] = useState(defaults?.name ?? "");
  const [slug, setSlug] = useState(defaults?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(defaults));
  const preview = slug || slugify(name) || "your-project";

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Project name" htmlFor="name" errors={state.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="My websites"
        />
      </Field>
      <Field
        label="Status page address"
        htmlFor="slug"
        errors={state.fieldErrors?.slug}
        help="Your public status page lives at /status/<this-name>. Share it with customers so they can check if something is down."
      >
        <div className="flex items-center rounded-xl border border-zinc-300 bg-zinc-50 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-900">
          <span className="pl-3.5 text-sm text-zinc-500">/status/</span>
          <input
            id="slug"
            name="slug"
            maxLength={48}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            className="w-full rounded-r-xl bg-transparent py-2.5 pr-3.5 text-sm outline-none"
            placeholder="my-websites"
          />
        </div>
      </Field>
      <p className="truncate text-xs text-zinc-500">
        Public page: <span className="font-mono text-zinc-700 dark:text-zinc-300">/status/{preview}</span>
      </p>
      <SubmitButton className="w-full sm:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}
