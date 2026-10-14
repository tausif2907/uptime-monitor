"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, Input, Select } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function AlertChannelForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const [type, setType] = useState<"EMAIL" | "WEBHOOK">("EMAIL");

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field label="Type" htmlFor="type">
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "EMAIL" | "WEBHOOK")}
          >
            <option value="EMAIL">Email</option>
            <option value="WEBHOOK">Webhook</option>
          </Select>
        </Field>
        <Field
          label={type === "EMAIL" ? "Email address" : "Webhook URL"}
          htmlFor="target"
          errors={state.fieldErrors?.target}
        >
          <Input
            id="target"
            name="target"
            type={type === "EMAIL" ? "email" : "url"}
            required
            placeholder={type === "EMAIL" ? "you@example.com" : "https://hooks.slack.com/services/…"}
          />
        </Field>
        <SubmitButton variant="secondary">Add</SubmitButton>
      </div>
      {type === "WEBHOOK" && (
        <p className="text-xs text-zinc-500">
          We POST JSON with <code>text</code> (Slack) and <code>content</code> (Discord) fields.
        </p>
      )}
    </form>
  );
}
