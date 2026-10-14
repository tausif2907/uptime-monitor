"use client";

import { DEFAULT_TIMEOUT_MS, INTERVAL_OPTIONS, MAX_TIMEOUT_MS } from "@uptime/shared";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, Input, Select } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export interface MonitorDefaults {
  name: string;
  url: string;
  method: string;
  intervalSec: number;
  timeoutMs: number;
  expectedStatus: number;
}

export function MonitorForm({
  action,
  defaults,
  submitLabel = "Create monitor",
}: {
  action: Action;
  defaults?: MonitorDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Name" htmlFor="name" errors={errors.name}>
        <Input id="name" name="name" required maxLength={100} defaultValue={defaults?.name} placeholder="Marketing site" />
      </Field>
      <Field label="URL" htmlFor="url" errors={errors.url} hint="Must be publicly reachable (http or https).">
        <Input id="url" name="url" type="url" required defaultValue={defaults?.url} placeholder="https://example.com" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method" htmlFor="method" errors={errors.method}>
          <Select id="method" name="method" defaultValue={defaults?.method ?? "GET"}>
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
            <option value="POST">POST</option>
          </Select>
        </Field>
        <Field label="Check every" htmlFor="intervalSec" errors={errors.intervalSec}>
          <Select id="intervalSec" name="intervalSec" defaultValue={defaults?.intervalSec ?? 60}>
            {INTERVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s / 60} minute{s === 60 ? "" : "s"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Timeout (ms)" htmlFor="timeoutMs" errors={errors.timeoutMs}>
          <Input
            id="timeoutMs"
            name="timeoutMs"
            type="number"
            min={1000}
            max={MAX_TIMEOUT_MS}
            step={500}
            defaultValue={defaults?.timeoutMs ?? DEFAULT_TIMEOUT_MS}
          />
        </Field>
        <Field label="Expected status code" htmlFor="expectedStatus" errors={errors.expectedStatus}>
          <Input
            id="expectedStatus"
            name="expectedStatus"
            type="number"
            min={100}
            max={599}
            defaultValue={defaults?.expectedStatus ?? 200}
          />
        </Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
