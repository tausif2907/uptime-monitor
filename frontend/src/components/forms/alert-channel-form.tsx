"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, Input, Select } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function AlertChannelForm({ action, defaultEmail }: { action: Action; defaultEmail: string }) {
  const [state, formAction] = useActionState(action, {});
  const [type, setType] = useState<"EMAIL" | "WEBHOOK">("WEBHOOK");

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
      <p className="text-sm font-medium">Add a channel</p>
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field label="Type" htmlFor="type">
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as "EMAIL" | "WEBHOOK")}>
            <option value="WEBHOOK">Webhook</option>
            <option value="EMAIL">Email</option>
          </Select>
        </Field>
        <Field
          label={type === "EMAIL" ? "Email address" : "Webhook URL"}
          htmlFor="target"
          errors={state.fieldErrors?.target}
          help={
            type === "EMAIL"
              ? "Alerts can be sent to your own verified email address."
              : "Paste a Slack or Discord incoming-webhook URL, or your own endpoint. We POST JSON with text (Slack) and content (Discord)."
          }
        >
          <Input
            key={type}
            id="target"
            name="target"
            type={type === "EMAIL" ? "email" : "url"}
            required
            defaultValue={type === "EMAIL" ? defaultEmail : ""}
            readOnly={type === "EMAIL"}
            placeholder={type === "EMAIL" ? "you@example.com" : "https://hooks.slack.com/services/…"}
          />
        </Field>
        <SubmitButton variant="secondary">Add</SubmitButton>
      </div>
    </form>
  );
}
